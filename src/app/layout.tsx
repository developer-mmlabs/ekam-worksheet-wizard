import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Worksheet Wizard",
  description: "AI-powered worksheet generator for schools",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-2xl">📝</span>
              <span className="font-bold text-xl text-gray-900">Worksheet Wizard</span>
            </a>
            <div className="flex items-center gap-6">
              <a href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Generate
              </a>
              <a href="/admin" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Admin
              </a>
              <a href="/admin/upload" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Upload
              </a>
              <a href="/admin/settings" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Settings
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
