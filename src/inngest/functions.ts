import { inngest } from "./client";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateQuestions } from "@/lib/ai/question-generator";
import { generateImage, isImageGenAvailable } from "@/lib/image-gen";
import { generateWorksheetPDF } from "@/lib/pdf/generator";
import { getTheme } from "@/lib/pdf/templates/themes";
import { defaultConfigValues, getWorksheetConfigSpec } from "@/lib/worksheet-configs";
import type { Grade, Subject, Chapter, School, GradeBand, WorksheetConfigValues } from "@/types";

export const processWorksheet = inngest.createFunction(
  { id: "process-worksheet", triggers: [{ event: "worksheet/generate.requested" }] },
  async ({ event, step }) => {
    const { worksheetId, chapterId, schoolId, config: incomingConfig } = event.data as {
      worksheetId: string;
      chapterId: string;
      schoolId: string;
      config?: WorksheetConfigValues;
    };

    // Step 1: Mark as processing and load all metadata
    const metadata = await step.run("load-metadata", async () => {
      await supabaseAdmin
        .from("worksheets")
        .update({ status: "processing" })
        .eq("id", worksheetId);

      const { data: chapter, error: chapterError } = await supabaseAdmin
        .from("chapters")
        .select("*, subject:subjects(*, grade:grades(*))")
        .eq("id", chapterId)
        .single();

      if (chapterError || !chapter) throw new Error("Chapter not found");

      const { data: school, error: schoolError } = await supabaseAdmin
        .from("schools")
        .select("*")
        .eq("id", schoolId)
        .single();

      if (schoolError || !school) throw new Error("School not found");

      const { data: materials } = await supabaseAdmin
        .from("source_materials")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("type")
        .order("page_number");

      if (!materials || materials.length === 0) {
        throw new Error("No source materials found for this chapter.");
      }

      return { chapter, school, materials };
    });

    // Step 2: Download images and convert to base64
    const imageBase64s = await step.run("download-images", async () => {
      const images: string[] = [];
      for (const material of metadata.materials) {
        try {
          const response = await fetch(material.file_url as string);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            images.push(base64);
          }
        } catch (e) {
          console.warn(`Failed to fetch image: ${material.file_url}`, e);
        }
      }

      if (images.length === 0) {
        throw new Error("Could not load any source material images.");
      }

      return images;
    });

    // Step 3: Generate questions via AI (the long-running part)
    const { chapter, school } = metadata;
    const subjectData = chapter.subject as unknown as Subject & { grade: Grade };
    const gradeData = subjectData.grade;

    const config: WorksheetConfigValues = {
      ...defaultConfigValues(getWorksheetConfigSpec(gradeData.number, subjectData.slug)),
      ...incomingConfig,
    };

    const questions = await step.run("generate-questions", async () => {
      return await generateQuestions(
        imageBase64s,
        {
          gradeNumber: gradeData.number,
          gradeName: gradeData.name,
          subjectSlug: subjectData.slug,
          subjectName: subjectData.name,
          chapterName: chapter.name as string,
        },
        config,
      );
    });

    // Step 3.5: Generate case-study images in parallel (if any imagePrompts emitted)
    if (await isImageGenAvailable()) {
      const imageJobs: { sectionIdx: number; csIdx: number; prompt: string }[] = [];
      questions.sections.forEach((section, sIdx) => {
        section.caseStudies?.forEach((cs, csIdx) => {
          if (cs.imagePrompt && cs.imagePrompt.trim().length > 0) {
            imageJobs.push({ sectionIdx: sIdx, csIdx, prompt: cs.imagePrompt });
          }
        });
      });

      if (imageJobs.length > 0) {
        const imageResults = await Promise.all(
          imageJobs.map((job, idx) =>
            step.run(`generate-image-${idx}`, async () => {
              try {
                const img = await generateImage(job.prompt);
                const ext = img.mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
                const path = `images/${worksheetId}/case-${job.sectionIdx}-${job.csIdx}.${ext}`;
                const { error: uploadError } = await supabaseAdmin.storage
                  .from("worksheets")
                  .upload(path, img.buffer, { contentType: img.mimeType, upsert: true });
                if (uploadError) {
                  console.warn(`Image upload failed for case ${job.sectionIdx}-${job.csIdx}: ${uploadError.message}`);
                  return null;
                }
                const { data: { publicUrl } } = supabaseAdmin.storage
                  .from("worksheets")
                  .getPublicUrl(path);
                return { sectionIdx: job.sectionIdx, csIdx: job.csIdx, url: publicUrl };
              } catch (err) {
                console.warn(`Image gen failed for case ${job.sectionIdx}-${job.csIdx}:`, err);
                return null;
              }
            }),
          ),
        );

        imageResults.forEach((r) => {
          if (r && questions.sections[r.sectionIdx]?.caseStudies?.[r.csIdx]) {
            questions.sections[r.sectionIdx].caseStudies![r.csIdx].imageUrl = r.url;
          }
        });
      }
    }

    // Step 4: Generate PDF
    const pdfBuffer = await step.run("generate-pdf", async () => {
      const theme = getTheme(gradeData.band as GradeBand, subjectData.slug, {
        primary: (school as School).primary_color,
        secondary: (school as School).secondary_color,
      });

      const { count } = await supabaseAdmin
        .from("worksheets")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chapterId);

      const worksheetNumber = count || 1;

      const buffer = await generateWorksheetPDF({
        school: school as School,
        grade: gradeData as Grade,
        subject: subjectData as Subject,
        chapter: chapter as unknown as Chapter,
        questions,
        worksheetNumber,
        theme,
      });

      // Return as base64 string so it can be serialized between steps
      return {
        base64: Buffer.from(buffer).toString("base64"),
        worksheetNumber,
      };
    });

    // Step 5: Upload PDF and mark completed
    await step.run("upload-and-complete", async () => {
      const buffer = Buffer.from(pdfBuffer.base64, "base64");
      const worksheetNumber = pdfBuffer.worksheetNumber;

      const gradeName = gradeData.name.replace(/\s+/g, "-");
      const subjectSlug = subjectData.slug;
      const chapterLabel = `Ch${chapter.number}-${(chapter.name as string).replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "")}`;
      const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
      const pdfPath = `${schoolId}/${gradeName}/${subjectSlug}/${chapterLabel}-WS${worksheetNumber}-${timestamp}.pdf`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("worksheets")
        .upload(pdfPath, buffer, { contentType: "application/pdf" });

      let pdfUrl: string | null = null;
      if (!uploadError) {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from("worksheets")
          .getPublicUrl(pdfPath);
        pdfUrl = publicUrl;
      }

      await supabaseAdmin
        .from("worksheets")
        .update({
          status: "completed",
          pdf_url: pdfUrl,
          questions_json: questions,
          page_count: Math.min(4, Math.ceil(questions.metadata.totalQuestions / 8)),
        })
        .eq("id", worksheetId);
    });

    return { worksheetId, status: "completed" };
  },
);
