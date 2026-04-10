"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Grade, Subject, Chapter, SourceMaterial } from "@/types";

export default function UploadPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [materials, setMaterials] = useState<SourceMaterial[]>([]);

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [materialType, setMaterialType] = useState<"textbook" | "past_paper">("textbook");

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New subject/chapter form
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newChapterName, setNewChapterName] = useState("");
  const [newChapterNumber, setNewChapterNumber] = useState(1);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [showNewChapter, setShowNewChapter] = useState(false);

  useEffect(() => {
    supabase.from("grades").select("*").order("number").then(({ data }) => {
      if (data) setGrades(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedGrade) { setSubjects([]); setSelectedSubject(""); return; }
    supabase.from("subjects").select("*").eq("grade_id", selectedGrade).order("name").then(({ data }) => {
      if (data) setSubjects(data);
    });
  }, [selectedGrade]);

  useEffect(() => {
    if (!selectedSubject) { setChapters([]); setSelectedChapter(""); return; }
    supabase.from("chapters").select("*").eq("subject_id", selectedSubject).order("number").then(({ data }) => {
      if (data) setChapters(data);
    });
  }, [selectedSubject]);

  const loadMaterials = useCallback(async () => {
    if (!selectedChapter) { setMaterials([]); return; }
    const { data } = await supabase
      .from("source_materials")
      .select("*")
      .eq("chapter_id", selectedChapter)
      .order("type")
      .order("page_number");
    if (data) setMaterials(data);
  }, [selectedChapter]);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  async function handleCreateSubject() {
    if (!newSubjectName.trim() || !selectedGrade) return;
    const slug = newSubjectName.toLowerCase().replace(/\s+/g, "_");
    const { data, error } = await supabase
      .from("subjects")
      .insert({ name: newSubjectName.trim(), slug, grade_id: selectedGrade })
      .select()
      .single();
    if (error) { setError(error.message); return; }
    setSubjects((prev) => [...prev, data]);
    setSelectedSubject(data.id);
    setNewSubjectName("");
    setShowNewSubject(false);
  }

  async function handleCreateChapter() {
    if (!newChapterName.trim() || !selectedSubject) return;
    const { data, error } = await supabase
      .from("chapters")
      .insert({ name: newChapterName.trim(), number: newChapterNumber, subject_id: selectedSubject })
      .select()
      .single();
    if (error) { setError(error.message); return; }
    setChapters((prev) => [...prev, data].sort((a, b) => a.number - b.number));
    setSelectedChapter(data.id);
    setNewChapterName("");
    setNewChapterNumber(1);
    setShowNewChapter(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedChapter) return;

    setUploading(true);
    setError(null);

    try {
      const sortedFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        setUploadProgress(`Uploading ${i + 1} of ${sortedFiles.length}: ${file.name}`);

        const filePath = `${selectedChapter}/${materialType}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("source-materials")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("source-materials")
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase
          .from("source_materials")
          .insert({
            chapter_id: selectedChapter,
            type: materialType,
            file_url: publicUrl,
            page_number: i + 1,
            file_name: file.name,
          });

        if (insertError) throw insertError;
      }

      setUploadProgress(`Successfully uploaded ${sortedFiles.length} files!`);
      loadMaterials();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteMaterial(id: string, fileUrl: string) {
    // Extract file path from URL
    const pathMatch = fileUrl.match(/source-materials\/(.+)$/);
    if (pathMatch) {
      await supabase.storage.from("source-materials").remove([pathMatch[1]]);
    }
    await supabase.from("source_materials").delete().eq("id", id);
    loadMaterials();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Source Materials</h1>
      <p className="text-gray-500 mb-8">Upload textbook pages and question papers for worksheet generation.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Selection + Upload */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            {/* Grade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
              <select
                value={selectedGrade}
                onChange={(e) => { setSelectedGrade(e.target.value); setSelectedSubject(""); setSelectedChapter(""); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select grade...</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                {selectedGrade && (
                  <button onClick={() => setShowNewSubject(!showNewSubject)} className="text-xs text-blue-600 hover:text-blue-800">
                    + New
                  </button>
                )}
              </div>
              {showNewSubject ? (
                <div className="flex gap-2">
                  <input
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="e.g. Science"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button onClick={handleCreateSubject} className="bg-blue-600 text-white text-sm px-3 py-2 rounded-lg">Add</button>
                </div>
              ) : (
                <select
                  value={selectedSubject}
                  onChange={(e) => { setSelectedSubject(e.target.value); setSelectedChapter(""); }}
                  disabled={!selectedGrade}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Chapter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Chapter</label>
                {selectedSubject && (
                  <button onClick={() => setShowNewChapter(!showNewChapter)} className="text-xs text-blue-600 hover:text-blue-800">
                    + New
                  </button>
                )}
              </div>
              {showNewChapter ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newChapterNumber}
                      onChange={(e) => setNewChapterNumber(parseInt(e.target.value) || 1)}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                      min={1}
                    />
                    <input
                      value={newChapterName}
                      onChange={(e) => setNewChapterName(e.target.value)}
                      placeholder="Chapter name"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button onClick={handleCreateChapter} className="w-full bg-blue-600 text-white text-sm px-3 py-2 rounded-lg">Add Chapter</button>
                </div>
              ) : (
                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  disabled={!selectedSubject}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
                >
                  <option value="">Select chapter...</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>Ch {c.number}: {c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Material type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={materialType === "textbook"}
                    onChange={() => setMaterialType("textbook")}
                    className="text-blue-600"
                  />
                  Textbook
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={materialType === "past_paper"}
                    onChange={() => setMaterialType("past_paper")}
                    className="text-blue-600"
                  />
                  Past Paper
                </label>
              </div>
            </div>

            {/* Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload JPEG Pages</label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                multiple
                onChange={handleFileUpload}
                disabled={!selectedChapter || uploading}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                {uploadProgress}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>

        {/* Right: Material browser */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Uploaded Materials {materials.length > 0 && `(${materials.length})`}
            </h2>

            {!selectedChapter ? (
              <p className="text-sm text-gray-400">Select a chapter to view uploaded materials.</p>
            ) : materials.length === 0 ? (
              <p className="text-sm text-gray-400">No materials uploaded for this chapter yet.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {materials.map((m) => (
                  <div key={m.id} className="relative group">
                    <div className="aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      <img
                        src={m.file_url}
                        alt={m.file_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500 truncate">
                        {m.type === "textbook" ? "📗" : "📝"} p.{m.page_number}
                      </span>
                      <button
                        onClick={() => handleDeleteMaterial(m.id, m.file_url)}
                        className="text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
