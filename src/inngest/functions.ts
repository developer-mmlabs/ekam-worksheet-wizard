import { inngest } from "./client";
import type { GetFunctionInput } from "inngest";
import { errorMessage, expireAttempts, requireAttempt, updateAttempt } from "@/lib/worksheet-attempts";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateQuestions } from "@/lib/ai/question-generator";
import { generateMultiChapter, multiDependencies } from "@/lib/ai/multi-chapter-generator";
import { controlOrder, planBatches } from "@/lib/ai/multi-chapter-plan";
import { generateImage, isImageGenAvailable } from "@/lib/image-gen";
import { generateWorksheetPDF } from "@/lib/pdf/generator";
import { getTheme } from "@/lib/pdf/templates/themes";
import { defaultConfigValues, getWorksheetConfigSpec } from "@/lib/worksheet-configs";
import { chapterTitle } from "@/lib/worksheet-scope";
import type { Grade, Subject, Chapter, School, GradeBand, WorksheetConfigValues, WorksheetQuestions } from "@/types";

// Failure events contain serialized errors, not necessarily Error instances.
async function handleFunctionFailure(worksheetId: string, attemptId: string, error: unknown) {
  if (attemptId) await updateAttempt(worksheetId, attemptId, "fail", { error_message: errorMessage(error) });
}

async function processGeneration({ event, step, runId }: GetFunctionInput<typeof inngest>) {
    const { worksheetId, attemptId, generationId, chapterId, chapterIds: requestedChapterIds, schoolId, config: incomingConfig, sectionOrder, previousQuestions } = event.data as {
      worksheetId: string;
      attemptId: string;
      generationId?: string;
      chapterId: string;
      chapterIds?: string[];
      schoolId: string;
      config?: WorksheetConfigValues;
      sectionOrder?: string[];
      previousQuestions?: string[];
    };
    const chapterIds = requestedChapterIds ?? [chapterId];

    // Step 1: Mark as processing and load all metadata
    const metadata = await step.run("load-metadata", async () => {
      await requireAttempt(worksheetId, attemptId, chapterIds.length > 1 ? "progress" : "start",
        { run_id: runId, progress: "Loading chapter sources" });

      const { data: chapters, error: chapterError } = await supabaseAdmin
        .from("chapters")
        .select("*, subject:subjects(*, grade:grades(*))")
        .in("id", chapterIds)
        .order("number");

      if (chapterError || !chapters || chapters.length !== chapterIds.length) throw new Error("Chapter not found");
      const chapter = chapters[0];
      if (chapters.some((item) => item.subject_id !== chapter.subject_id)) throw new Error("Chapters must share a grade and subject.");

      const { data: school, error: schoolError } = await supabaseAdmin
        .from("schools")
        .select("*")
        .eq("id", schoolId)
        .single();

      if (schoolError || !school) throw new Error("School not found");

      const materialGroups = await Promise.all(chapters.map(async (item) => {
        const { data, error } = await supabaseAdmin.from("source_materials").select("*")
          .eq("chapter_id", item.id).order("type").order("page_number").order("id");
        if (error || !data?.length) throw new Error(`No source pages available for Ch ${item.number}: ${item.name}.`);
        return data;
      }));
      const materials = materialGroups.flatMap((pages, i) => pages.map((page) => ({
        ...page, sourceLabel: `Ch ${chapters[i].number}: ${chapters[i].name} - Page ${page.page_number}`,
      })));
      if (chapters.length > 1) {
        const subject = chapter.subject as unknown as Subject & { grade: Grade };
        const context = { gradeNumber: subject.grade.number, subjectSlug: subject.slug,
          gradeName: subject.grade.name, subjectName: subject.name, chapterName: chapter.name };
        const config = { ...defaultConfigValues(getWorksheetConfigSpec(subject.grade.number, subject.slug)), ...incomingConfig };
        const batches = planBatches(chapters.length, config, controlOrder(context, sectionOrder));
        await requireAttempt(worksheetId, attemptId, "start", { run_id: runId,
          execution_minutes: Math.min(120, Math.max(20, materials.length * 2 + batches.length * 3 + 10)) });
      }
      return { chapter, chapters: chapters.map(({ id, number, name }) => ({ id, number, name })), school, materials };
    });

    // Step 2: Download images + generate questions in a single step
    // (combined to avoid serializing large base64 image data as step output)
    const { chapter, school } = metadata;
    const subjectData = chapter.subject as unknown as Subject & { grade: Grade };
    const gradeData = subjectData.grade;

    const config: WorksheetConfigValues = {
      ...defaultConfigValues(getWorksheetConfigSpec(gradeData.number, subjectData.slug)),
      ...incomingConfig,
    };

    const multiOptions = {
      worksheetId, attemptId, generationId: generationId ?? worksheetId,
      context: { gradeNumber: gradeData.number, gradeName: gradeData.name, subjectSlug: subjectData.slug,
        subjectName: subjectData.name, chapterName: chapterTitle(metadata.chapters), chapters: metadata.chapters },
      config, sectionOrder, previousQuestions, pages: metadata.materials,
    };
    const questions = metadata.chapters.length > 1
      ? await generateMultiChapter(multiOptions, multiDependencies(multiOptions,
        async <T>(id: string, work: () => Promise<T>) => await step.run(id, work) as T))
      : await step.run("generate-questions", async () => {
      await requireAttempt(worksheetId, attemptId, "progress", { progress: "Generating questions" });
      // Pass public URLs directly to the LLM — no need to download images
      const imageUrls = metadata.materials.map((m) => m.file_url as string);

      if (imageUrls.length === 0) {
        throw new Error("No source material images found.");
      }

      return await generateQuestions(
        imageUrls,
        {
          gradeNumber: gradeData.number,
          gradeName: gradeData.name,
          subjectSlug: subjectData.slug,
          subjectName: subjectData.name,
          chapterName: metadata.chapters.length > 1 ? chapterTitle(metadata.chapters) : chapter.name as string,
          chapters: metadata.chapters.length > 1 ? metadata.chapters : undefined,
          sourcePageLabels: metadata.materials.map((page) => page.sourceLabel),
        },
        config,
        sectionOrder,
        previousQuestions,
      );
    });

    // Step 3.5: Generate case-study images in parallel via AI image gen.
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
              await requireAttempt(worksheetId, attemptId, "progress", { progress: "Creating illustrations" });
              try {
                const img = await generateImage(job.prompt);
                const ext = img.mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
                const path = `images/${worksheetId}/${attemptId}/case-${job.sectionIdx}-${job.csIdx}.${ext}`;
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

    // Step 4: Generate PDF, upload, and mark completed
    // (combined to avoid serializing large PDF buffer as step output)
    await step.run("generate-pdf-and-upload", async () => {
      await requireAttempt(worksheetId, attemptId, "progress", { progress: metadata.chapters.length > 1
        ? `${metadata.chapters.length}/${metadata.chapters.length} chapters complete; creating PDF` : "Creating PDF" });
      const theme = getTheme(gradeData.band as GradeBand, subjectData.slug, {
        primary: (school as School).primary_color,
        secondary: (school as School).secondary_color,
      });

      // Use the worksheet's set_number (1, 2, or 3) as the display number
      const { data: wsRow } = await supabaseAdmin
        .from("worksheets")
        .select("set_number")
        .eq("id", worksheetId)
        .single();
      const worksheetNumber = wsRow?.set_number || 1;

      const buffer = await generateWorksheetPDF({
        school: school as School,
        grade: gradeData as Grade,
        subject: subjectData as Subject,
        chapter: chapter as unknown as Chapter,
        questions,
        worksheetNumber,
        theme,
      });

      const gradeName = gradeData.name.replace(/\s+/g, "-");
      const subjectSlug = subjectData.slug;
      const chapterLabel = `Ch${chapter.number}-${(chapter.name as string).replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "")}`;
      const timestamp = new Date().toISOString().replace(/[T:.]/g, "-");
      const pdfPath = `${schoolId}/${gradeName}/${subjectSlug}/${metadata.chapters.length > 1 ? "Multi-Chapter" : chapterLabel}-WS${worksheetNumber}-${worksheetId}-${attemptId}-${timestamp}.pdf`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("worksheets")
        .upload(pdfPath, buffer, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw new Error("Failed to upload worksheet PDF.");

      let pdfUrl: string | null = null;
      if (!uploadError) {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from("worksheets")
          .getPublicUrl(pdfPath);
        pdfUrl = publicUrl;
      }

      await requireAttempt(worksheetId, attemptId, "complete", {
        pdf_url: pdfUrl, questions_json: questions,
        page_count: Math.min(4, Math.ceil(questions.metadata.totalQuestions / 8)),
      });
    });

    return { worksheetId, status: "completed" };
}

const generationFailure = async ({ event }: { event: { data: { event: { data: { worksheetId?: string; attemptId?: string } }; error: unknown } } }) => {
  const data = event.data.event.data;
  if (data.worksheetId) await handleFunctionFailure(data.worksheetId, data.attemptId!, event.data.error);
};

export const processWorksheet = inngest.createFunction({
  id: "process-worksheet", triggers: [{ event: "worksheet/generate.requested" }],
  cancelOn: [{ event: "worksheet/attempt.cancelled", match: "data.attemptId" }],
  timeouts: { finish: "15m" }, onFailure: generationFailure,
}, processGeneration);

export const processMultiWorksheet = inngest.createFunction({
  id: "process-multi-worksheet", triggers: [{ event: "worksheet/multi.generate.requested" }],
  cancelOn: [{ event: "worksheet/attempt.cancelled", match: "data.attemptId" }],
  retries: 2, checkpointing: false, // One bounded AI operation per HTTP invocation on Vercel.
  timeouts: { finish: "2h" }, onFailure: generationFailure,
}, processGeneration);

// ============================================================
// PDF Regeneration (after question edits — skips AI generation)
// ============================================================

export const regeneratePDF = inngest.createFunction(
  {
    id: "regenerate-pdf",
    triggers: [{ event: "worksheet/pdf.regenerate" }],
    cancelOn: [{ event: "worksheet/attempt.cancelled", match: "data.attemptId" }],
    timeouts: { finish: "15m" },
    onFailure: async ({ event }) => {
      const worksheetId = event.data.event.data?.worksheetId as string | undefined;
      if (worksheetId) await handleFunctionFailure(worksheetId, event.data.event.data?.attemptId as string, event.data.error);
    },
  },
  async ({ event, step, runId }) => {
    const { worksheetId, attemptId } = event.data as { worksheetId: string; attemptId: string };

    const metadata = await step.run("load-metadata", async () => {
      await requireAttempt(worksheetId, attemptId, "start", { run_id: runId });
      const { data: worksheet, error: wsError } = await supabaseAdmin
        .from("worksheets")
        .select("*, chapter:chapters(*, subject:subjects(*, grade:grades(*)))")
        .eq("id", worksheetId)
        .single();

      if (wsError || !worksheet) throw new Error("Worksheet not found");

      const { data: school, error: schoolError } = await supabaseAdmin
        .from("schools")
        .select("*")
        .eq("id", worksheet.school_id)
        .single();

      if (schoolError || !school) throw new Error("School not found");

      return { worksheet, school };
    });

    const { worksheet, school } = metadata;
    const chapter = worksheet.chapter as unknown as Chapter & {
      subject: Subject & { grade: Grade };
    };
    const subjectData = chapter.subject;
    const gradeData = subjectData.grade;
    const questions = worksheet.questions_json as unknown as WorksheetQuestions;

    await step.run("generate-pdf-and-upload", async () => {
      await requireAttempt(worksheetId, attemptId, "progress", { progress: "Creating PDF" });
      const theme = getTheme(gradeData.band as GradeBand, subjectData.slug, {
        primary: (school as School).primary_color,
        secondary: (school as School).secondary_color,
      });

      // Use set_number from the worksheet row (already loaded in metadata)
      const worksheetNumber = (worksheet as unknown as { set_number: number }).set_number || 1;

      const buffer = await generateWorksheetPDF({
        school: school as School,
        grade: gradeData as Grade,
        subject: subjectData as Subject,
        chapter: chapter as Chapter,
        questions,
        worksheetNumber,
        theme,
      });

      const gradeName = gradeData.name.replace(/\s+/g, "-");
      const subjectSlug = subjectData.slug;
      const chapterLabel = `Ch${chapter.number}-${chapter.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "")}`;
      const timestamp = new Date().toISOString().replace(/[T:.]/g, "-");
      const pdfPath = `${worksheet.school_id}/${gradeName}/${subjectSlug}/${questions.metadata.chapters?.length ? "Multi-Chapter" : chapterLabel}-WS${worksheetNumber}-${worksheetId}-${attemptId}-${timestamp}.pdf`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("worksheets")
        .upload(pdfPath, buffer, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw new Error("Failed to upload worksheet PDF.");

      let pdfUrl: string | null = null;
      if (!uploadError) {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from("worksheets")
          .getPublicUrl(pdfPath);
        pdfUrl = publicUrl;
      }

      await requireAttempt(worksheetId, attemptId, "complete", {
        pdf_url: pdfUrl, questions_json: questions,
        page_count: Math.min(4, Math.ceil(questions.metadata.totalQuestions / 8)),
      });
    });

    return { worksheetId, status: "completed" };
  },
);

// Expire abandoned attempts even when nobody has the Generate page open.
export const expireWorksheetAttempts = inngest.createFunction(
  { id: "expire-worksheet-attempts", triggers: [{ cron: "* * * * *" }] },
  async () => { await expireAttempts(); },
);
