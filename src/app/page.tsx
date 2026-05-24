"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type {
  Grade,
  Subject,
  Chapter,
  WorksheetStatus,
  WorksheetConfigValues,
  WorksheetControl,
  ChapterStatusResponse,
  WorksheetQuestions,
  QuestionSection,
  Question,
  QuestionUpdate,
} from "@/types";
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

// ============================================================
// Sortable control row (drag-and-drop question type reordering)
// ============================================================

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

// ============================================================
// Worksheet Set Progress Panel
// ============================================================

interface WorksheetSlot {
  id: string;
  setNumber: number;
  status: WorksheetStatus;
  isFinalized: boolean;
  pdfUrl: string | null;
  createdAt: string;
}

function SetProgressPanel({
  slots,
  nextSetNumber,
  onViewWorksheet,
}: {
  slots: WorksheetSlot[];
  nextSetNumber: number | null;
  onViewWorksheet: (slot: WorksheetSlot) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Worksheet Set Progress</h3>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((n) => {
          const slot = slots.find((s) => s.setNumber === n);
          const isEmpty = !slot;
          const isFinalized = slot?.isFinalized;
          const isCompleted = slot?.status === "completed" && !isFinalized;
          const isPending = slot?.status === "pending" || slot?.status === "processing";

          return (
            <div
              key={n}
              className={`rounded-lg border-2 p-3 text-center ${
                isFinalized
                  ? "border-green-400 bg-green-50"
                  : isCompleted
                  ? "border-blue-400 bg-blue-50"
                  : isPending
                  ? "border-yellow-400 bg-yellow-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="text-xs font-medium text-gray-500 mb-1">Set {n}</div>
              {isFinalized && (
                <>
                  <div className="text-green-700 text-xs font-semibold mb-2">Finalized</div>
                  <button
                    onClick={() => slot && onViewWorksheet(slot)}
                    className="text-xs text-green-600 hover:text-green-800 underline"
                  >
                    View PDF
                  </button>
                </>
              )}
              {isCompleted && (
                <>
                  <div className="text-blue-700 text-xs font-semibold mb-2">Ready for Review</div>
                  <button
                    onClick={() => slot && onViewWorksheet(slot)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Review
                  </button>
                </>
              )}
              {isPending && (
                <div className="text-yellow-700 text-xs font-semibold">Generating...</div>
              )}
              {isEmpty && (
                <div className="text-gray-400 text-xs">
                  {nextSetNumber === n ? "Next" : "Empty"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Question Edit Modal
// ============================================================

function QuestionEditModal({
  worksheetId,
  questionsJson,
  onClose,
  onSaved,
}: {
  worksheetId: string;
  questionsJson: WorksheetQuestions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sections, setSections] = useState<QuestionSection[]>(questionsJson.sections);
  const [editCount, setEditCount] = useState(0);
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [updates, setUpdates] = useState<QuestionUpdate[]>([]);
  const maxEdits = 5;

  function markEdited(key: string) {
    if (!editedCells.has(key)) {
      setEditedCells((prev) => new Set(prev).add(key));
      setEditCount((c) => c + 1);
    }
  }

  function updateQuestion(
    sectionIdx: number,
    questionIdx: number,
    field: keyof Question,
    value: string,
    caseStudyIdx?: number,
  ) {
    const key = `${sectionIdx}-${caseStudyIdx ?? "q"}-${questionIdx}-${field}`;
    markEdited(key);

    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as QuestionSection[];
      let q: Question;
      if (caseStudyIdx !== undefined) {
        q = next[sectionIdx].caseStudies![caseStudyIdx].questions[questionIdx];
      } else {
        q = next[sectionIdx].questions![questionIdx];
      }
      (q as unknown as Record<string, unknown>)[field] = value;
      return next;
    });

    // Track the update
    setUpdates((prev) => {
      const existing = prev.findIndex(
        (u) =>
          u.sectionIndex === sectionIdx &&
          u.questionIndex === questionIdx &&
          u.caseStudyIndex === caseStudyIdx,
      );
      const changes: Partial<Question> = { [field]: value };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], changes: { ...next[existing].changes, ...changes } };
        return next;
      }
      return [
        ...prev,
        { sectionIndex: sectionIdx, questionIndex: questionIdx, caseStudyIndex: caseStudyIdx, changes },
      ];
    });
  }

  async function handleSave() {
    if (updates.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/generate/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worksheetId, updates }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to save changes");
        return;
      }
      onSaved();
    } catch {
      alert("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 mb-8">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Questions</h2>
            <p className="text-xs text-gray-500 mt-1">
              {editCount}/{maxEdits} edits used. Click on a question to edit it.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl p-1">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Section {section.id}: {section.title}
              </h3>

              {/* Regular questions */}
              {section.questions?.map((q, qIdx) => (
                <div key={qIdx} className="mb-3 p-3 border border-gray-100 rounded-lg hover:border-gray-300">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-gray-400 mt-1 shrink-0">Q{q.number}</span>
                    <div className="flex-1">
                      {section.type === "assertion_reason" ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs text-gray-500">Assertion (A):</label>
                            <textarea
                              value={q.assertion || ""}
                              disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-q-${qIdx}-assertion`)}
                              onChange={(e) => updateQuestion(sIdx, qIdx, "assertion", e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded p-2 mt-1 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Reason (R):</label>
                            <textarea
                              value={q.reason || ""}
                              disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-q-${qIdx}-reason`)}
                              onChange={(e) => updateQuestion(sIdx, qIdx, "reason", e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded p-2 mt-1 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                              rows={2}
                            />
                          </div>
                        </div>
                      ) : (
                        <textarea
                          value={q.text}
                          disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-q-${qIdx}-text`)}
                          onChange={(e) => updateQuestion(sIdx, qIdx, "text", e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded p-2 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                          rows={2}
                        />
                      )}
                      {q.options && (
                        <div className="mt-2 space-y-1">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2 text-sm">
                              <span className="text-gray-400 text-xs">({opt.label})</span>
                              <span className="text-gray-700">{opt.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Case study questions */}
              {section.caseStudies?.map((cs, csIdx) => (
                <div key={csIdx} className="mb-3 p-3 border border-gray-100 rounded-lg">
                  <div className="text-xs text-gray-500 mb-2">Case Study {cs.number}</div>
                  <textarea
                    value={cs.stimulus}
                    disabled
                    className="w-full text-sm border border-gray-200 rounded p-2 resize-none bg-gray-50 text-gray-600 mb-2"
                    rows={3}
                  />
                  {cs.questions.map((q, qIdx) => (
                    <div key={qIdx} className="ml-4 mb-2 p-2 border border-gray-50 rounded hover:border-gray-200">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-gray-400 mt-1 shrink-0">{cs.number}.{q.number}</span>
                        <div className="flex-1">
                          <textarea
                            value={q.text}
                            disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-${csIdx}-${qIdx}-text`)}
                            onChange={(e) => updateQuestion(sIdx, qIdx, "text", e.target.value, csIdx)}
                            className="w-full text-sm border border-gray-200 rounded p-2 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                            rows={1}
                          />
                          {q.options && (
                            <div className="mt-1 space-y-1">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-400 text-xs">({opt.label})</span>
                                  <span className="text-gray-700">{opt.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            {updates.length} question{updates.length !== 1 ? "s" : ""} modified
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updates.length === 0 || saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? "Saving & Re-rendering..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

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
  const [activeWorksheetId, setActiveWorksheetId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [activeSetNumber, setActiveSetNumber] = useState<number | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chapter status (worksheet set progress)
  const [chapterStatus, setChapterStatus] = useState<ChapterStatusResponse | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editQuestionsJson, setEditQuestionsJson] = useState<WorksheetQuestions | null>(null);

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

  // Load school on mount
  useEffect(() => {
    async function loadSchool() {
      const res = await fetch("/api/school-settings");
      if (res.ok) {
        const data = await res.json();
        if (data?.id) setSchoolId(data.id);
      }
    }
    loadSchool();
  }, []);

  // Load chapter status when chapter + school are selected
  const loadChapterStatus = useCallback(async () => {
    if (!selectedChapter || !schoolId) {
      setChapterStatus(null);
      return;
    }
    const res = await fetch(
      `/api/generate/chapter-status?chapterId=${selectedChapter}&schoolId=${schoolId}`
    );
    if (res.ok) {
      const data: ChapterStatusResponse = await res.json();
      setChapterStatus(data);
    }
  }, [selectedChapter, schoolId]);

  useEffect(() => {
    loadChapterStatus();
  }, [loadChapterStatus]);

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
          setActiveSetNumber(data.setNumber);
          setIsFinalized(data.isFinalized);
          setProgress("Worksheet ready!");
          setGenerating(false);
          loadChapterStatus();
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

  function resetWorksheetView() {
    setPdfUrl(null);
    setActiveWorksheetId(null);
    setActiveSetNumber(null);
    setIsFinalized(false);
    setError(null);
  }

  async function handleGenerate() {
    if (!selectedChapter || !schoolId) return;

    setGenerating(true);
    setError(null);
    setPdfUrl(null);
    setProgress("Submitting generation request...");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: selectedChapter,
          schoolId,
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

      setActiveWorksheetId(result.worksheetId);
      setActiveSetNumber(result.setNumber);
      setProgress("Generating questions with AI (this may take up to 2 minutes)...");
      pollForCompletion(result.worksheetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setGenerating(false);
    }
  }

  async function handleFinalize() {
    if (!activeWorksheetId) return;

    try {
      const res = await fetch("/api/generate/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worksheetId: activeWorksheetId }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Finalization failed");
        return;
      }

      setIsFinalized(true);
      loadChapterStatus();
    } catch {
      setError("Network error during finalization");
    }
  }

  async function handleEditQuestions() {
    if (!activeWorksheetId) return;

    try {
      const res = await fetch(`/api/generate/status?id=${activeWorksheetId}&include=questions`);
      if (!res.ok) {
        setError("Failed to load questions");
        return;
      }
      const data = await res.json();
      if (data.questionsJson) {
        setEditQuestionsJson(data.questionsJson);
        setShowEditModal(true);
      }
    } catch {
      setError("Failed to load questions for editing");
    }
  }

  function handleViewWorksheet(slot: WorksheetSlot) {
    setActiveWorksheetId(slot.id);
    setPdfUrl(slot.pdfUrl);
    setActiveSetNumber(slot.setNumber);
    setIsFinalized(slot.isFinalized);
    setError(null);
  }

  function handleEditSaved() {
    setShowEditModal(false);
    setEditQuestionsJson(null);
    // The PDF is being re-rendered — poll for completion
    if (activeWorksheetId) {
      setGenerating(true);
      setProgress("Re-rendering PDF with your changes...");
      pollForCompletion(activeWorksheetId);
    }
  }

  const allFinalized = chapterStatus?.nextSetNumber === null && (chapterStatus?.worksheets.length ?? 0) > 0;
  const canGenerate = selectedChapter && schoolId && !generating && !allFinalized;
  const generateLabel = chapterStatus?.nextSetNumber
    ? `Generate Worksheet ${chapterStatus.nextSetNumber}`
    : allFinalized
    ? "All 3 Worksheets Finalized"
    : "Generate Worksheet";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Generate Worksheet</h1>
        <p className="text-gray-500 mb-8">
          Select a grade, subject, and chapter to generate a set of 3 unique PDF worksheets.
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
                resetWorksheetView();
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
                resetWorksheetView();
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
                resetWorksheetView();
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

          {/* Worksheet Set Progress */}
          {chapterStatus && chapterStatus.worksheets.length > 0 && (
            <SetProgressPanel
              slots={chapterStatus.worksheets}
              nextSetNumber={chapterStatus.nextSetNumber}
              onViewWorksheet={handleViewWorksheet}
            />
          )}

          {/* Config-driven Question Options */}
          {selectedChapter && configSpec && !allFinalized && (
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
            disabled={!canGenerate}
            className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? "Generating..." : generateLabel}
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

          {pdfUrl && !generating && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-green-700">
                  {isFinalized
                    ? `Worksheet Set ${activeSetNumber} — Finalized`
                    : `Worksheet Set ${activeSetNumber} — Ready for Review`}
                </p>
                <div className="flex gap-2">
                  {!isFinalized && (
                    <>
                      <button
                        onClick={handleEditQuestions}
                        className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 font-medium py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Questions
                      </button>
                      <button
                        onClick={handleFinalize}
                        className="inline-flex items-center gap-1.5 bg-green-600 text-white font-medium py-2 px-3 rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Finalize
                      </button>
                    </>
                  )}
                  <a
                    href={pdfUrl}
                    download
                    className="inline-flex items-center gap-1.5 bg-blue-600 text-white font-medium py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </a>
                </div>
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

      {/* Edit Modal */}
      {showEditModal && editQuestionsJson && activeWorksheetId && (
        <QuestionEditModal
          worksheetId={activeWorksheetId}
          questionsJson={editQuestionsJson}
          onClose={() => {
            setShowEditModal(false);
            setEditQuestionsJson(null);
          }}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
}
