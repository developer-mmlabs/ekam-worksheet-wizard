"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { WorksheetStatus } from "@/types";

interface WorksheetRow {
  id: string;
  status: WorksheetStatus;
  pdf_url: string | null;
  page_count: number;
  created_at: string;
  chapter: {
    number: number;
    name: string;
    subject: {
      name: string;
      grade: {
        name: string;
      };
    };
  };
}

const STATUS_STYLES: Record<WorksheetStatus, { bg: string; text: string; label: string }> = {
  completed: { bg: "bg-green-50", text: "text-green-700", label: "Completed" },
  processing: { bg: "bg-blue-50", text: "text-blue-700", label: "Processing" },
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Pending" },
  failed: { bg: "bg-red-50", text: "text-red-700", label: "Failed" },
};

export default function WorksheetsPage() {
  const [worksheets, setWorksheets] = useState<WorksheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadWorksheets();
  }, []);

  async function loadWorksheets() {
    setLoading(true);
    const { data, error } = await supabase
      .from("worksheets")
      .select("id, status, pdf_url, page_count, created_at, chapter:chapters(number, name, subject:subjects(name, grade:grades(name)))")
      .order("created_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    const rows = data as unknown as WorksheetRow[];
    setWorksheets(rows);

    // Extract unique grades and subjects for filters
    const gradeSet = new Set<string>();
    const subjectSet = new Set<string>();
    for (const w of rows) {
      if (w.chapter?.subject?.grade?.name) gradeSet.add(w.chapter.subject.grade.name);
      if (w.chapter?.subject?.name) subjectSet.add(w.chapter.subject.name);
    }
    setGrades(Array.from(gradeSet).sort());
    setSubjects(Array.from(subjectSet).sort());
    setLoading(false);
  }

  const filtered = worksheets.filter((w) => {
    if (filterGrade && w.chapter?.subject?.grade?.name !== filterGrade) return false;
    if (filterSubject && w.chapter?.subject?.name !== filterSubject) return false;
    return true;
  });

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Worksheet History</h1>
          <p className="text-gray-500">Browse and download all generated worksheets</p>
        </div>
        <span className="text-sm text-gray-400">{filtered.length} worksheet{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Grades</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Worksheet list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No worksheets found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Chapter</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Subject</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Grade</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((w) => {
                const style = STATUS_STYLES[w.status];
                return (
                  <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        Ch {w.chapter?.number}: {w.chapter?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {w.chapter?.subject?.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {w.chapter?.subject?.grade?.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(w.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {w.status === "completed" && w.pdf_url && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPreviewUrl(previewUrl === w.pdf_url ? null : w.pdf_url)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {previewUrl === w.pdf_url ? "Close" : "Preview"}
                          </button>
                          <a
                            href={w.pdf_url}
                            download
                            className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-medium py-1.5 px-3 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                        </div>
                      )}
                      {w.status === "processing" && (
                        <span className="text-xs text-blue-500">In progress...</span>
                      )}
                      {w.status === "failed" && (
                        <span className="text-xs text-red-500">Error</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Worksheet Preview</h3>
              <div className="flex items-center gap-3">
                <a
                  href={previewUrl}
                  download
                  className="inline-flex items-center gap-1 bg-green-600 text-white text-sm font-medium py-1.5 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-full"
                style={{ minHeight: "70vh" }}
                title="Worksheet Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
