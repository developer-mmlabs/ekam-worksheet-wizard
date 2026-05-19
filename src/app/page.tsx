"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Grade, Subject, Chapter, WorksheetStatus, WorksheetConfigValues, WorksheetControl } from "@/types";
import { getWorksheetConfigSpec, defaultConfigValues } from "@/lib/worksheet-configs";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableControlRow({
  control,
  value,
  onChange,
}: {
  control: WorksheetControl;
  value: number;
  onChange: (n: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: control.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-lg"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 touch-none"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <label className="flex-1 text-sm text-gray-700">{control.label}</label>
      <input
        type="number"
        value={value || ""}
        min={control.min}
        max={control.max}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        onBlur={() => onChange(Math.min(control.max, Math.max(control.min, value)))}
        className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}

export default function GeneratePage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");

  const [configValues, setConfigValues] = useState<WorksheetConfigValues>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive the active config spec from the selected grade + subject objects
  const selectedGradeObj = useMemo(
    () => grades.find((g) => g.id === selectedGrade) ?? null,
    [grades, selectedGrade],
  );
  const selectedSubjectObj = useMemo(
    () => subjects.find((s) => s.id === selectedSubject) ?? null,
    [subjects, selectedSubject],
  );
  const configSpec = useMemo(() => {
    if (!selectedGradeObj || !selectedSubjectObj) return null;
    return getWorksheetConfigSpec(selectedGradeObj.number, selectedSubjectObj.slug);
  }, [selectedGradeObj, selectedSubjectObj]);

  // When the (grade, subject) combination changes, reset config values + section order to spec defaults
  useEffect(() => {
    if (configSpec) {
      setConfigValues(defaultConfigValues(configSpec));
      setSectionOrder(configSpec.controls.map((c) => c.id));
    }
  }, [configSpec]);

  const totalQuestions = useMemo(
    () => Object.values(configValues).reduce((sum, n) => sum + (n || 0), 0),
    [configValues],
  );

  // Controls displayed in the user's chosen order (defaults to spec order)
  const orderedControls = useMemo(() => {
    if (!configSpec) return [] as WorksheetControl[];
    const byId = new Map(configSpec.controls.map((c) => [c.id, c]));
    const out: WorksheetControl[] = [];
    for (const id of sectionOrder) {
      const c = byId.get(id);
      if (c) out.push(c);
    }
    for (const c of configSpec.controls) {
      if (!sectionOrder.includes(c.id)) out.push(c);
    }
    return out;
  }, [configSpec, sectionOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(String(active.id));
    const newIndex = sectionOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setSectionOrder(arrayMove(sectionOrder, oldIndex, newIndex));
  }

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  function pollForCompletion(worksheetId: string) {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/status?id=${worksheetId}`);
        if (!res.ok) return;

        const data = await res.json();
        const status: WorksheetStatus = data.status;

        if (status === "processing") {
          setProgress("AI is generating your worksheet...");
        }

        if (status === "completed") {
          stopPolling();
          setPdfUrl(data.pdfUrl);
          setProgress("Worksheet ready!");
          setGenerating(false);
        }

        if (status === "failed") {
          stopPolling();
          setError(data.errorMessage || "Generation failed");
          setGenerating(false);
        }
      } catch {
        // Network error — keep polling
      }
    }, 30_000);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setError("Generation is taking longer than expected. Check the admin dashboard for your worksheet.");
      setGenerating(false);
    }, 900_000);
  }

  useEffect(() => {
    async function loadGrades() {
      const { data } = await supabase
        .from("grades")
        .select("*")
        .order("number");
      if (data) setGrades(data);
    }
    loadGrades();
  }, []);

  useEffect(() => {
    if (!selectedGrade) {
      setSubjects([]);
      setSelectedSubject("");
      return;
    }
    async function loadSubjects() {
      const { data } = await supabase
        .from("subjects")
        .select("*")
        .eq("grade_id", selectedGrade)
        .order("name");
      if (data) setSubjects(data);
    }
    loadSubjects();
  }, [selectedGrade]);

  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      setSelectedChapter("");
      return;
    }
    async function loadChapters() {
      const { data } = await supabase
        .from("chapters")
        .select("*")
        .eq("subject_id", selectedSubject)
        .order("number");
      if (data) setChapters(data);
    }
    loadChapters();
  }, [selectedSubject]);

  function updateControl(id: string, value: number) {
    setConfigValues((prev) => ({ ...prev, [id]: value }));
  }

  async function handleGenerate() {
    if (!selectedChapter) return;

    setGenerating(true);
    setError(null);
    setPdfUrl(null);
    setProgress("Submitting generation request...");

    try {
      const schoolRes = await fetch("/api/school-settings");
      if (!schoolRes.ok) {
        throw new Error("No school configured. Go to Admin > Settings first.");
      }
      const school = await schoolRes.json();

      if (!school?.id) {
        throw new Error("No school configured. Go to Admin > Settings first.");
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: selectedChapter,
          schoolId: school.id,
          config: configValues,
          sectionOrder,
        }),
      });

      if (!response.ok) {
        let message = `Server error (${response.status})`;
        try {
          const errBody = await response.json();
          if (errBody.error) message = errBody.error;
        } catch {
          // Response wasn't JSON
        }
        throw new Error(message);
      }

      const result = await response.json();

      if (!result.success || !result.worksheetId) {
        throw new Error(result.error || "Generation failed");
      }

      setProgress("Generating questions with AI (this may take up to 2 minutes)...");
      pollForCompletion(result.worksheetId);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Generate Worksheet</h1>
        <p className="text-gray-500 mb-8">
          Select a grade, subject, and chapter to generate a print-ready PDF worksheet.
        </p>

        <div className="space-y-6">
          {/* Grade selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedSubject("");
                setSelectedChapter("");
                setPdfUrl(null);
              }}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a grade...</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Subject selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedChapter("");
                setPdfUrl(null);
              }}
              disabled={!selectedGrade}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {selectedGrade ? "Select a subject..." : "Select a grade first"}
              </option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Chapter selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chapter</label>
            <select
              value={selectedChapter}
              onChange={(e) => {
                setSelectedChapter(e.target.value);
                setPdfUrl(null);
              }}
              disabled={!selectedSubject}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {selectedSubject ? "Select a chapter..." : "Select a subject first"}
              </option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  Ch {c.number}: {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Config-driven Question Options */}
          {selectedChapter && configSpec && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <span>Question Options ({totalQuestions} questions)</span>
                <svg
                  className={`w-4 h-4 transition-transform ${showOptions ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showOptions && (
                <div className="p-4 space-y-3">
                  {configSpec.helperText && (
                    <p className="text-xs text-gray-500 italic">{configSpec.helperText}</p>
                  )}
                  <p className="text-xs text-gray-400">Drag the rows to reorder. Sections appear in the worksheet in the order listed.</p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {orderedControls.map((control) => (
                          <SortableControlRow
                            key={control.id}
                            control={control}
                            value={configValues[control.id] ?? control.default}
                            onChange={(n) => updateControl(control.id, n)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-sm font-medium text-gray-700">
                      Total: {totalQuestions} questions
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!selectedChapter || generating}
            className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? "Generating..." : "Generate Worksheet"}
          </button>

          {generating && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="text-sm text-blue-700">{progress}</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {pdfUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-green-700">
                  Worksheet generated successfully!
                </p>
                <a
                  href={pdfUrl}
                  download
                  className="inline-flex items-center gap-2 bg-green-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download PDF</span>
                </a>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                <iframe
                  src={pdfUrl}
                  className="w-full"
                  style={{ height: "80vh" }}
                  title="Worksheet Preview"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
