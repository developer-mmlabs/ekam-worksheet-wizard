"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

interface Stats {
  grades: number;
  subjects: number;
  chapters: number;
  materials: number;
  worksheets: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({ grades: 0, subjects: 0, chapters: 0, materials: 0, worksheets: 0 });
  const [setupStatus, setSetupStatus] = useState<string | null>(null);
  const [setting, setSetting] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const [grades, subjects, chapters, materials, worksheets] = await Promise.all([
      supabase.from("grades").select("id", { count: "exact", head: true }),
      supabase.from("subjects").select("id", { count: "exact", head: true }),
      supabase.from("chapters").select("id", { count: "exact", head: true }),
      supabase.from("source_materials").select("id", { count: "exact", head: true }),
      supabase.from("worksheets").select("id", { count: "exact", head: true }),
    ]);

    setStats({
      grades: grades.count || 0,
      subjects: subjects.count || 0,
      chapters: chapters.count || 0,
      materials: materials.count || 0,
      worksheets: worksheets.count || 0,
    });
  }

  async function handleSetup() {
    setSetting(true);
    setSetupStatus("Running database setup...");
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      setSetupStatus(
        data.success
          ? `Setup complete!\n${data.results.join("\n")}`
          : `Setup had issues:\n${data.results?.join("\n") || data.error}`
      );
      loadStats();
    } catch (err) {
      setSetupStatus(`Setup error: ${err}`);
    } finally {
      setSetting(false);
    }
  }

  const statCards = [
    { label: "Grades", value: stats.grades, icon: "🎓" },
    { label: "Subjects", value: stats.subjects, icon: "📚" },
    { label: "Chapters", value: stats.chapters, icon: "📖" },
    { label: "Source Materials", value: stats.materials, icon: "🖼️" },
    { label: "Worksheets Generated", value: stats.worksheets, icon: "📄" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">Manage your worksheet content and settings</p>
        </div>
        <button
          onClick={handleSetup}
          disabled={setting}
          className="bg-purple-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors"
        >
          {setting ? "Setting up..." : "Run Database Setup"}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-500">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Setup status */}
      {setupStatus && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-2">Setup Status</h2>
          <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg">
            {setupStatus}
          </pre>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/admin/upload"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-3">📤</div>
          <h3 className="font-semibold text-gray-900">Upload Materials</h3>
          <p className="text-sm text-gray-500 mt-1">
            Upload textbook pages and question papers
          </p>
        </a>
        <a
          href="/admin/settings"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-3">⚙️</div>
          <h3 className="font-semibold text-gray-900">School Settings</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure school name, logo, and colors
          </p>
        </a>
        <a
          href="/"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-3">📝</div>
          <h3 className="font-semibold text-gray-900">Generate Worksheet</h3>
          <p className="text-sm text-gray-500 mt-1">Go to the teacher worksheet generator</p>
        </a>
      </div>
    </div>
  );
}
