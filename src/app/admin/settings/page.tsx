"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { School } from "@/types";

export default function SettingsPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [secondaryColor, setSecondaryColor] = useState("#0369a1");
  const [academicYear, setAcademicYear] = useState("2026-27");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    async function loadSchool() {
      const { data } = await supabase.from("schools").select("*").limit(1).single();
      if (data) {
        setSchool(data);
        setName(data.name);
        setLocation(data.location);
        setPrimaryColor(data.primary_color);
        setSecondaryColor(data.secondary_color);
        setAcademicYear(data.academic_year);
        if (data.logo_url) setLogoPreview(data.logo_url);
      }
      setLoading(false);
    }
    loadSchool();
  }, []);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      let logoUrl = school?.logo_url || null;

      // Upload logo if changed
      if (logoFile) {
        const filePath = `logos/${Date.now()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("school-assets")
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("school-assets")
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      }

      const updates = {
        name,
        location,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        academic_year: academicYear,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      };

      if (school) {
        const { error } = await supabase.from("schools").update(updates).eq("id", school.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("schools").insert(updates).select().single();
        if (error) throw error;
        setSchool(data);
      }

      setMessage("Settings saved successfully!");
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">School Settings</h1>
      <p className="text-gray-500 mb-8">Configure your school branding for worksheet headers.</p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">School Logo</label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-16 h-16 object-contain rounded-lg border" />
            ) : (
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">🏫</div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>

        {/* School Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5"
            placeholder="EKAM INSTITUTIONS"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5"
            placeholder="E-CITY, BENGALURU"
          />
        </div>

        {/* Academic Year */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5"
            placeholder="2026-27"
          />
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
          <div className="border-2 rounded-lg p-4" style={{ borderColor: primaryColor }}>
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="w-10 h-10 object-contain" />
              ) : (
                <div className="w-10 h-10 rounded flex items-center justify-center text-white font-bold" style={{ backgroundColor: primaryColor }}>
                  {name.charAt(0) || "S"}
                </div>
              )}
              <div>
                <div className="font-bold" style={{ color: primaryColor }}>{name || "School Name"}</div>
                <div className="text-xs text-gray-500">{location || "Location"} | {academicYear}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between pt-4 border-t">
          {message && (
            <p className={`text-sm ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto bg-blue-600 text-white font-medium py-2.5 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
