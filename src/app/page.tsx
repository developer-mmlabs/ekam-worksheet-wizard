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
// Sortable control row
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
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 py-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      <span className="flex-1 text-sm text-gray-600">{control.label}</span>
      <input
        type="number"
        value={value || ""}
        min={control.min}
        max={control.max}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        onBlur={() => onChange(Math.min(control.max, Math.max(control.min, value)))}
        className="w-16 rounded-md border border-gray-200 px-2 py-1.5 text-gray-900 text-sm text-center focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}

// ============================================================
// Set Progress Stepper
// ============================================================

interface WorksheetSlot {
  id: string;
  setNumber: number;
  status: WorksheetStatus;
  isFinalized: boolean;
  pdfUrl: string | null;
  createdAt: string;
}

function SetStepper({
  slots,
  nextSetNumber,
  activeSetNumber,
  onSelect,
}: {
  slots: WorksheetSlot[];
  nextSetNumber: number | null;
  activeSetNumber: number | null;
  onSelect: (slot: WorksheetSlot) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((n, i) => {
        const slot = slots.find((s) => s.setNumber === n);
        const isFinalized = slot?.isFinalized;
        const isReady = slot?.status === "completed" && !isFinalized;
        const isPending = slot?.status === "pending" || slot?.status === "processing";
        const isActive = activeSetNumber === n;

        return (
          <div key={n} className="flex items-center">
            {i > 0 && (
              <div className={`w-6 h-px mx-1 ${isFinalized || (slot && slots.find(s => s.setNumber === n - 1)?.isFinalized) ? "bg-green-300" : "bg-gray-200"}`} />
            )}
            <button
              onClick={() => slot && onSelect(slot)}
              disabled={!slot}
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all
                ${isFinalized ? "bg-green-500 text-white shadow-sm" : ""}
                ${isReady ? "bg-blue-500 text-white shadow-sm ring-2 ring-blue-200" : ""}
                ${isPending ? "bg-yellow-400 text-yellow-900 animate-pulse" : ""}
                ${!slot ? "bg-gray-100 text-gray-400" : ""}
                ${isActive && !isFinalized && !isPending ? "ring-2 ring-blue-300" : ""}
                ${slot && !isFinalized ? "hover:scale-110 cursor-pointer" : ""}
                ${!slot ? "cursor-default" : ""}
              `}
              title={
                isFinalized ? `Set ${n} — Finalized` :
                isReady ? `Set ${n} — Ready for review` :
                isPending ? `Set ${n} — Generating...` :
                `Set ${n} — Not started`
              }
            >
              {isFinalized ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : n}
            </button>
          </div>
        );
      })}
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

  function updateOption(
    sectionIdx: number,
    questionIdx: number,
    optionIdx: number,
    value: string,
    caseStudyIdx?: number,
  ) {
    const key = `${sectionIdx}-${caseStudyIdx ?? "q"}-${questionIdx}-opt${optionIdx}`;
    markEdited(key);

    setSections((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as QuestionSection[];
      let q: Question;
      if (caseStudyIdx !== undefined) {
        q = next[sectionIdx].caseStudies![caseStudyIdx].questions[questionIdx];
      } else {
        q = next[sectionIdx].questions![questionIdx];
      }
      if (q.options?.[optionIdx]) {
        q.options[optionIdx].text = value;
      }
      return next;
    });

    setSections((cur) => {
      const section = cur[sectionIdx];
      let q: Question;
      if (caseStudyIdx !== undefined) {
        q = section.caseStudies![caseStudyIdx].questions[questionIdx];
      } else {
        q = section.questions![questionIdx];
      }
      const updatedOptions = q.options ? [...q.options] : [];

      setUpdates((prev) => {
        const existing = prev.findIndex(
          (u) =>
            u.sectionIndex === sectionIdx &&
            u.questionIndex === questionIdx &&
            u.caseStudyIndex === caseStudyIdx,
        );
        const changes: Partial<Question> = { options: updatedOptions };
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

      return cur;
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Manual Edit</h2>
            <p className="text-xs text-gray-400 mt-0.5">{editCount}/{maxEdits} edits</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Section {section.id} — {section.title}
              </h3>

              {section.questions?.map((q, qIdx) => (
                <div key={qIdx} className="mb-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-gray-300 mt-1.5 shrink-0 w-6">{q.number}</span>
                    <div className="flex-1">
                      {section.type === "assertion_reason" ? (
                        <div className="space-y-2">
                          <textarea value={q.assertion || ""} disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-q-${qIdx}-assertion`)} onChange={(e) => updateQuestion(sIdx, qIdx, "assertion", e.target.value)} className="w-full text-sm border-0 border-b border-gray-100 focus:border-blue-300 rounded-none p-1 resize-none focus:ring-0 disabled:text-gray-300" rows={2} placeholder="Assertion (A)" />
                          <textarea value={q.reason || ""} disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-q-${qIdx}-reason`)} onChange={(e) => updateQuestion(sIdx, qIdx, "reason", e.target.value)} className="w-full text-sm border-0 border-b border-gray-100 focus:border-blue-300 rounded-none p-1 resize-none focus:ring-0 disabled:text-gray-300" rows={2} placeholder="Reason (R)" />
                        </div>
                      ) : (
                        <textarea value={q.text} disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-q-${qIdx}-text`)} onChange={(e) => updateQuestion(sIdx, qIdx, "text", e.target.value)} className="w-full text-sm border-0 border-b border-gray-100 focus:border-blue-300 rounded-none p-1 resize-none focus:ring-0 disabled:text-gray-300" rows={2} />
                      )}
                      {q.options && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-1.5">
                              <span className="text-gray-300 text-xs">({opt.label})</span>
                              <input type="text" value={opt.text} disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-q-${qIdx}-opt${oIdx}`)} onChange={(e) => updateOption(sIdx, qIdx, oIdx, e.target.value)} className="flex-1 text-sm border-0 border-b border-gray-100 focus:border-blue-300 rounded-none px-1 py-0.5 focus:ring-0 disabled:text-gray-300" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {section.caseStudies?.map((cs, csIdx) => (
                <div key={csIdx} className="mb-3 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">Case Study {cs.number}</p>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{cs.stimulus}</p>
                  {cs.questions.map((q, qIdx) => (
                    <div key={qIdx} className="ml-4 mb-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-gray-300 mt-1 shrink-0">{cs.number}.{q.number}</span>
                        <div className="flex-1">
                          <textarea value={q.text} disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-${csIdx}-${qIdx}-text`)} onChange={(e) => updateQuestion(sIdx, qIdx, "text", e.target.value, csIdx)} className="w-full text-sm border-0 border-b border-gray-100 focus:border-blue-300 rounded-none p-1 resize-none focus:ring-0 disabled:text-gray-300" rows={1} />
                          {q.options && (
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex items-center gap-1">
                                  <span className="text-gray-300 text-xs">({opt.label})</span>
                                  <input type="text" value={opt.text} disabled={editCount >= maxEdits && !editedCells.has(`${sIdx}-${csIdx}-${qIdx}-opt${oIdx}`)} onChange={(e) => updateOption(sIdx, qIdx, oIdx, e.target.value, csIdx)} className="flex-1 text-xs border-0 border-b border-gray-100 focus:border-blue-300 rounded-none px-1 py-0.5 focus:ring-0 disabled:text-gray-300" />
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

        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">{updates.length} modified</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={updates.length === 0 || saving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
              {saving ? "Saving..." : "Save & Re-render"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Chat Edit Panel
// ============================================================

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

function buildWorksheetSummary(q: WorksheetQuestions): string {
  const lines: string[] = [
    `${q.metadata.grade} / ${q.metadata.subject} / ${q.metadata.chapter}`,
    `${q.metadata.totalQuestions} questions across ${q.sections.length} sections:`,
  ];
  for (const s of q.sections) {
    if (s.caseStudies?.length) {
      lines.push(`  Section ${s.id}: ${s.title} (${s.caseStudies.length} case studies)`);
      s.caseStudies.forEach((cs) => {
        lines.push(`    CS${cs.number}: "${cs.stimulus.slice(0, 80)}..." (${cs.questions.length} sub-Qs)`);
      });
    } else if (s.questions?.length) {
      lines.push(`  Section ${s.id}: ${s.title} (${s.questions.length} questions)`);
      s.questions.forEach((q) => {
        const preview = (q.assertion ? `A: ${q.assertion}` : q.text).slice(0, 80);
        lines.push(`    Q${q.number}: ${preview}${preview.length >= 80 ? "..." : ""}`);
      });
    }
  }
  return lines.join("\n");
}

function ChatEditPanel({
  worksheetId,
  questionsJson,
  onClose,
  onUpdated,
}: {
  worksheetId: string;
  questionsJson: WorksheetQuestions;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const worksheetSummary = useMemo(() => buildWorksheetSummary(questionsJson), [questionsJson]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const newUserMsg: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/generate/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worksheetId, message: text, history: messages }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${err.error || "Request failed"}` }]);
        return;
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.hasEdits ? `${data.reply}\n\nRe-rendering PDF...` : data.reply },
      ]);
      if (data.hasEdits) onUpdated();
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Network error. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 mb-8 flex flex-col" style={{ height: "75vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit with AI</h2>
            <p className="text-xs text-gray-400 mt-0.5">Describe changes in plain language</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <details className="border-b border-gray-100">
          <summary className="px-5 py-2 text-xs text-gray-400 cursor-pointer hover:bg-gray-50 select-none">
            Worksheet contents — {questionsJson.metadata.totalQuestions} questions
          </summary>
          <pre className="px-5 py-2 text-xs text-gray-500 bg-gray-50/50 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">{worksheetSummary}</pre>
        </details>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-4">
              <p className="mb-4">The AI sees your full worksheet. Try:</p>
              <div className="space-y-1.5 text-xs text-left max-w-sm mx-auto">
                {[
                  "Replace Q3 in Section A with something on quadratic equations",
                  "Q7 is too easy, make it harder",
                  "Fix option (c) in Section B Q2",
                  "Change the case study to be about a cricket stadium",
                ].map((s, i) => (
                  <button key={i} onClick={() => setInput(s)} className="block w-full text-left bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors text-gray-500 hover:text-gray-700">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-3.5 py-2 text-sm text-gray-400 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="What would you like to change?"
              disabled={sending}
              className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-gray-300 focus:border-gray-300 disabled:bg-gray-50 placeholder:text-gray-300"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="bg-gray-900 text-white w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-800 disabled:bg-gray-200 transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page — Split Layout
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
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  const [chapterStatus, setChapterStatus] = useState<ChapterStatusResponse | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editQuestionsJson, setEditQuestionsJson] = useState<WorksheetQuestions | null>(null);
  const [showChatPanel, setShowChatPanel] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedGradeObj = useMemo(() => grades.find((g) => g.id === selectedGrade) ?? null, [grades, selectedGrade]);
  const selectedSubjectObj = useMemo(() => subjects.find((s) => s.id === selectedSubject) ?? null, [subjects, selectedSubject]);
  const configSpec = useMemo(() => {
    if (!selectedGradeObj || !selectedSubjectObj) return null;
    return getWorksheetConfigSpec(selectedGradeObj.number, selectedSubjectObj.slug);
  }, [selectedGradeObj, selectedSubjectObj]);

  useEffect(() => {
    if (configSpec) {
      setConfigValues(defaultConfigValues(configSpec));
      setSectionOrder(configSpec.controls.map((c) => c.id));
    }
  }, [configSpec]);

  const totalQuestions = useMemo(() => Object.values(configValues).reduce((sum, n) => sum + (n || 0), 0), [configValues]);

  const orderedControls = useMemo(() => {
    if (!configSpec) return [] as WorksheetControl[];
    const byId = new Map(configSpec.controls.map((c) => [c.id, c]));
    const out: WorksheetControl[] = [];
    for (const id of sectionOrder) { const c = byId.get(id); if (c) out.push(c); }
    for (const c of configSpec.controls) { if (!sectionOrder.includes(c.id)) out.push(c); }
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
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  useEffect(() => {
    async function loadSchool() {
      const res = await fetch("/api/school-settings");
      if (res.ok) { const data = await res.json(); if (data?.id) setSchoolId(data.id); }
    }
    loadSchool();
  }, []);

  const loadChapterStatus = useCallback(async () => {
    if (!selectedChapter || !schoolId) { setChapterStatus(null); return; }
    const res = await fetch(`/api/generate/chapter-status?chapterId=${selectedChapter}&schoolId=${schoolId}`);
    if (res.ok) setChapterStatus(await res.json());
  }, [selectedChapter, schoolId]);

  useEffect(() => { loadChapterStatus(); }, [loadChapterStatus]);

  function pollForCompletion(worksheetId: string, fast = false) {
    // fast=true for edits/re-renders (poll every 3s), false for full generation (poll every 10s)
    const interval = fast ? 3_000 : 10_000;
    const timeout = fast ? 120_000 : 900_000;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/status?id=${worksheetId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "pending") {
          setQueuePosition(data.queuePosition);
          setProgress("Waiting in queue...");
        }
        if (data.status === "processing") {
          setQueuePosition(null);
          setProgress(fast ? "Re-rendering PDF..." : "AI is generating your worksheet...");
        }
        if (data.status === "completed") {
          stopPolling(); setPdfUrl(data.pdfUrl); setActiveSetNumber(data.setNumber);
          setIsFinalized(data.isFinalized); setProgress(""); setQueuePosition(null);
          setGenerating(false); loadChapterStatus();
        }
        if (data.status === "failed") {
          stopPolling(); setError(data.errorMessage || "Generation failed");
          setQueuePosition(null); setGenerating(false);
        }
      } catch { /* keep polling */ }
    }, interval);
    timeoutRef.current = setTimeout(() => {
      stopPolling(); setError("Taking too long. Check History page."); setGenerating(false);
    }, timeout);
  }

  useEffect(() => {
    (async () => { const { data } = await supabase.from("grades").select("*").order("number"); if (data) setGrades(data); })();
  }, []);

  useEffect(() => {
    if (!selectedGrade) { setSubjects([]); setSelectedSubject(""); return; }
    (async () => { const { data } = await supabase.from("subjects").select("*").eq("grade_id", selectedGrade).order("name"); if (data) setSubjects(data); })();
  }, [selectedGrade]);

  useEffect(() => {
    if (!selectedSubject) { setChapters([]); setSelectedChapter(""); return; }
    (async () => { const { data } = await supabase.from("chapters").select("*").eq("subject_id", selectedSubject).order("number"); if (data) setChapters(data); })();
  }, [selectedSubject]);

  function resetView() { setPdfUrl(null); setActiveWorksheetId(null); setActiveSetNumber(null); setIsFinalized(false); setError(null); }

  async function handleGenerate() {
    if (!selectedChapter || !schoolId) return;
    setGenerating(true); setError(null); setPdfUrl(null); setQueuePosition(null); setProgress("Submitting...");
    try {
      const response = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: selectedChapter, schoolId, config: configValues, sectionOrder }),
      });
      if (!response.ok) {
        let msg = `Server error (${response.status})`;
        try { const e = await response.json(); if (e.error) msg = e.error; } catch {}
        throw new Error(msg);
      }
      const result = await response.json();
      if (!result.success || !result.worksheetId) throw new Error(result.error || "Generation failed");
      setActiveWorksheetId(result.worksheetId); setActiveSetNumber(result.setNumber);
      setProgress("Generating questions with AI..."); pollForCompletion(result.worksheetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred"); setGenerating(false);
    }
  }

  async function handleFinalize() {
    if (!activeWorksheetId) return;
    try {
      const res = await fetch("/api/generate/finalize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worksheetId: activeWorksheetId }),
      });
      if (!res.ok) { const err = await res.json(); setError(err.error || "Finalization failed"); return; }
      setIsFinalized(true); loadChapterStatus();
    } catch { setError("Network error"); }
  }

  async function openModal(type: "edit" | "chat") {
    if (!activeWorksheetId) return;
    const res = await fetch(`/api/generate/status?id=${activeWorksheetId}&include=questions`);
    if (res.ok) {
      const data = await res.json();
      if (data.questionsJson) {
        setEditQuestionsJson(data.questionsJson);
        if (type === "edit") setShowEditModal(true);
        else setShowChatPanel(true);
      }
    }
  }

  function handleViewWorksheet(slot: WorksheetSlot) {
    setActiveWorksheetId(slot.id); setPdfUrl(slot.pdfUrl); setActiveSetNumber(slot.setNumber); setIsFinalized(slot.isFinalized); setError(null);
  }

  function handleModalSaved() {
    setShowEditModal(false); setShowChatPanel(false); setEditQuestionsJson(null);
    if (activeWorksheetId) { setGenerating(true); setProgress("Re-rendering PDF..."); pollForCompletion(activeWorksheetId, true); }
  }

  const allFinalized = chapterStatus?.nextSetNumber === null && (chapterStatus?.worksheets.length ?? 0) > 0;
  const canGenerate = selectedChapter && schoolId && !generating && !allFinalized;
  const hasChapter = !!selectedChapter;

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col lg:flex-row">
      {/* ── Left Panel ── */}
      <div className="lg:w-96 xl:w-[420px] shrink-0 border-r border-gray-100 bg-white overflow-y-auto">
        <div className="p-6 space-y-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Generate Worksheet</h1>
            <p className="text-xs text-gray-400 mt-1">Select a chapter to create a set of 3 unique worksheets.</p>
          </div>

          {/* Selectors */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Grade</label>
              <select value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedSubject(""); setSelectedChapter(""); resetView(); }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white">
                <option value="">Select grade...</option>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setSelectedChapter(""); resetView(); }} disabled={!selectedGrade}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                <option value="">{selectedGrade ? "Select subject..." : "Select grade first"}</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Chapter</label>
              <select value={selectedChapter} onChange={(e) => { setSelectedChapter(e.target.value); resetView(); }} disabled={!selectedSubject}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                <option value="">{selectedSubject ? "Select chapter..." : "Select subject first"}</option>
                {chapters.map((c) => <option key={c.id} value={c.id}>Ch {c.number}: {c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Set Progress */}
          {chapterStatus && chapterStatus.worksheets.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Worksheet Set</label>
              <SetStepper
                slots={chapterStatus.worksheets}
                nextSetNumber={chapterStatus.nextSetNumber}
                activeSetNumber={activeSetNumber}
                onSelect={handleViewWorksheet}
              />
            </div>
          )}

          {/* Question Options */}
          {hasChapter && configSpec && !allFinalized && (
            <div>
              <button type="button" onClick={() => setShowOptions(!showOptions)}
                className="flex items-center justify-between w-full text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                <span>Questions ({totalQuestions})</span>
                <svg className={`w-3.5 h-3.5 transition-transform ${showOptions ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showOptions && (
                <div className="mt-2 space-y-1">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
                      {orderedControls.map((control) => (
                        <SortableControlRow key={control.id} control={control} value={configValues[control.id] ?? control.default} onChange={(n) => setConfigValues((prev) => ({ ...prev, [control.id]: n }))} />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )}

          {/* Generate */}
          <button onClick={handleGenerate} disabled={!canGenerate}
            className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
            {generating ? "Generating..." : allFinalized ? "All 3 Finalized" : chapterStatus?.nextSetNumber ? `Generate Set ${chapterStatus.nextSetNumber}` : "Generate Worksheet"}
          </button>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>
      </div>

      {/* ── Right Panel — Preview ── */}
      <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
        {/* Action bar */}
        {pdfUrl && !generating && (
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isFinalized ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                {isFinalized ? (
                  <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Set {activeSetNumber} Finalized</>
                ) : (
                  <>Set {activeSetNumber} — Review</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {!isFinalized && (
                <>
                  <button onClick={() => openModal("chat")} title="Edit with AI"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    AI Edit
                  </button>
                  <button onClick={() => openModal("edit")} title="Manual edit"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Manual
                  </button>
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  <button onClick={handleFinalize}
                    className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg font-medium transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Finalize
                  </button>
                </>
              )}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <a href={pdfUrl} download title="Download PDF"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download
              </a>
            </div>
          </div>
        )}

        {/* PDF iframe or empty state */}
        <div className="flex-1 min-h-0">
          {generating ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-4" />
              <p className="text-sm">{progress}</p>
              {queuePosition !== null && queuePosition > 1 && (
                <p className="text-xs text-gray-300 mt-2">Position in queue: {queuePosition}</p>
              )}
            </div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" title="Worksheet Preview" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">{hasChapter ? "Generate a worksheet to preview it here" : "Select a chapter to get started"}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEditModal && editQuestionsJson && activeWorksheetId && (
        <QuestionEditModal worksheetId={activeWorksheetId} questionsJson={editQuestionsJson} onClose={() => { setShowEditModal(false); setEditQuestionsJson(null); }} onSaved={handleModalSaved} />
      )}
      {showChatPanel && activeWorksheetId && editQuestionsJson && (
        <ChatEditPanel worksheetId={activeWorksheetId} questionsJson={editQuestionsJson} onClose={() => { setShowChatPanel(false); setEditQuestionsJson(null); }} onUpdated={handleModalSaved} />
      )}
    </div>
  );
}
