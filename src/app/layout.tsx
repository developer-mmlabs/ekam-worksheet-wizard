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
        <nav className="bg-white border-b border-gray-100 px-6 py-3 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-semibold text-lg text-gray-900 tracking-tight">Worksheet Wizard</span>
            </a>
            <div className="flex items-center gap-1">
              {[
                { href: "/", label: "Generate" },
                { href: "/admin", label: "Dashboard" },
                { href: "/admin/worksheets", label: "History" },
                { href: "/admin/upload", label: "Upload" },
                { href: "/admin/settings", label: "Settings" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
