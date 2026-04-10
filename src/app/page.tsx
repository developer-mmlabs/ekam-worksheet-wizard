"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Grade, Subject, Chapter } from "@/types";
import { QUESTION_COUNT_DEFAULTS, QUESTION_COUNT_MINS } from "@/types";

export default function GeneratePage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");

  const [mcqCount, setMcqCount] = useState(QUESTION_COUNT_DEFAULTS.mcq);
  const [veryShortCount, setVeryShortCount] = useState(QUESTION_COUNT_DEFAULTS.veryShort);
  const [shortAnswerCount, setShortAnswerCount] = useState(QUESTION_COUNT_DEFAULTS.shortAnswer);
  const [longAnswerCount, setLongAnswerCount] = useState(QUESTION_COUNT_DEFAULTS.longAnswer);
  const [showOptions, setShowOptions] = useState(false);

  const totalQuestions = mcqCount + veryShortCount + shortAnswerCount + longAnswerCount;

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load grades on mount
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

  // Load subjects when grade changes
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

  // Load chapters when subject changes
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

  async function handleGenerate() {
    if (!selectedChapter) return;

    setGenerating(true);
    setError(null);
    setPdfUrl(null);
    setProgress("Reading source materials...");

    try {
      // Get school (most recently updated)
      const schoolRes = await fetch("/api/school-settings");
      if (!schoolRes.ok) {
        throw new Error("No school configured. Go to Admin > Settings first.");
      }
      const school = await schoolRes.json();

      if (!school?.id) {
        throw new Error("No school configured. Go to Admin > Settings first.");
      }

      setProgress("Generating questions with AI (this takes 30-60 seconds)...");

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: selectedChapter,
          schoolId: school.id,
          questionCounts: {
            mcq: mcqCount,
            veryShort: veryShortCount,
            shortAnswer: shortAnswerCount,
            longAnswer: longAnswerCount,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 504) {
          throw new Error("Request timed out. Try reducing the number of questions.");
        }
        // Try to parse JSON error, fall back to status text
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

      if (!result.success) {
        throw new Error(result.error || "Generation failed");
      }

      setProgress("Worksheet ready!");

      if (result.pdfBase64) {
        // Create download URL from base64
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else if (result.pdfUrl) {
        setPdfUrl(result.pdfUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
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
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
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
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
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
                  Chapter {c.number}: {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Question Options */}
          {selectedChapter && (
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
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        MCQ (1 mark each)
                      </label>
                      <input
                        type="number"
                        value={mcqCount || ""}
                        min={QUESTION_COUNT_MINS.mcq}
                        onChange={(e) => setMcqCount(parseInt(e.target.value) || 0)}
                        onBlur={() => setMcqCount((v) => Math.max(QUESTION_COUNT_MINS.mcq, v))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Very Short Answer (1 mark each)
                      </label>
                      <input
                        type="number"
                        value={veryShortCount || ""}
                        min={QUESTION_COUNT_MINS.veryShort}
                        onChange={(e) => setVeryShortCount(parseInt(e.target.value) || 0)}
                        onBlur={() => setVeryShortCount((v) => Math.max(QUESTION_COUNT_MINS.veryShort, v))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Short Answer (3 marks each)
                      </label>
                      <input
                        type="number"
                        value={shortAnswerCount || ""}
                        min={QUESTION_COUNT_MINS.shortAnswer}
                        onChange={(e) => setShortAnswerCount(parseInt(e.target.value) || 0)}
                        onBlur={() => setShortAnswerCount((v) => Math.max(QUESTION_COUNT_MINS.shortAnswer, v))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Long Answer (5 marks each)
                      </label>
                      <input
                        type="number"
                        value={longAnswerCount || ""}
                        min={QUESTION_COUNT_MINS.longAnswer}
                        onChange={(e) => setLongAnswerCount(parseInt(e.target.value) || 0)}
                        onBlur={() => setLongAnswerCount((v) => Math.max(QUESTION_COUNT_MINS.longAnswer, v))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm font-medium text-gray-700">
                      Total: {totalQuestions} questions
                    </span>
                    <span className="text-xs text-gray-400">
                      {mcqCount * 1 + veryShortCount * 1 + shortAnswerCount * 3 + longAnswerCount * 5} marks
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

          {/* Progress */}
          {generating && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="text-sm text-blue-700">{progress}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Download */}
          {pdfUrl && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <p className="text-sm font-medium text-green-700">
                Worksheet generated successfully!
              </p>
              <div className="flex gap-3">
                <a
                  href={pdfUrl}
                  download={`worksheet-${Date.now()}.pdf`}
                  className="inline-flex items-center gap-2 bg-green-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <span>Download PDF</span>
                </a>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white text-green-700 border border-green-300 font-medium py-2 px-4 rounded-lg hover:bg-green-50 transition-colors"
                >
                  <span>Preview</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
