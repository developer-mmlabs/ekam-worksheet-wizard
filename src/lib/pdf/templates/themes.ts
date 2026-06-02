import { GradeBand, TemplateTheme, DecorationLayout } from "@/types";
import { PDF_FONT } from "../fonts";

// Grade band base styles
const GRADE_BAND_STYLES: Record<GradeBand, { fontFamily: string; decorativeOpacity: number }> = {
  primary: { fontFamily: PDF_FONT, decorativeOpacity: 0.06 },
  middle: { fontFamily: PDF_FONT, decorativeOpacity: 0.05 },
  senior: { fontFamily: PDF_FONT, decorativeOpacity: 0.06 },
};

// Grade-band decoration layout — controls density, size, and visual weight
export const GRADE_BAND_LAYOUTS: Record<GradeBand, DecorationLayout> = {
  primary: {
    cornerCount: 4,
    cornerSize: 90,
    marginSide: "both",
    marginIconCount: 9,
    marginIconSize: 20,
    patternGridSpacing: 80,
    patternTileSize: 28,
    patternOpacity: 0.06,
    cornerOpacity: 0.12,
    marginOpacity: 0.18,
    strokeWidth: 2.5,
    colorMode: "tricolor",
  },
  middle: {
    cornerCount: 2,
    cornerSize: 70,
    marginSide: "left",
    marginIconCount: 7,
    marginIconSize: 18,
    patternGridSpacing: 100,
    patternTileSize: 24,
    patternOpacity: 0.04,
    cornerOpacity: 0.10,
    marginOpacity: 0.15,
    strokeWidth: 2,
    colorMode: "duotone",
  },
  senior: {
    cornerCount: 2,
    cornerSize: 60,
    marginSide: "right",
    marginIconCount: 6,
    marginIconSize: 16,
    patternGridSpacing: 110,
    patternTileSize: 22,
    patternOpacity: 0.05,
    cornerOpacity: 0.12,
    marginOpacity: 0.15,
    strokeWidth: 1.5,
    colorMode: "mono",
  },
};

// Subject-specific color palettes
const SUBJECT_COLORS: Record<
  string,
  { primary: string; secondary: string; accent: string; bg: string; header: string; sectionHeader: string }
> = {
  science: {
    primary: "#0d9488",
    secondary: "#14b8a6",
    accent: "#5eead4",
    bg: "#f0fdfa",
    header: "#134e4a",
    sectionHeader: "#0f766e",
  },
  mathematics: {
    primary: "#4f46e5",
    secondary: "#6366f1",
    accent: "#a5b4fc",
    bg: "#eef2ff",
    header: "#312e81",
    sectionHeader: "#4338ca",
  },
  english: {
    primary: "#ea580c",
    secondary: "#f97316",
    accent: "#fdba74",
    bg: "#fff7ed",
    header: "#7c2d12",
    sectionHeader: "#c2410c",
  },
  social_studies: {
    primary: "#92400e",
    secondary: "#b45309",
    accent: "#fbbf24",
    bg: "#fffbeb",
    header: "#78350f",
    sectionHeader: "#92400e",
  },
  hindi: {
    primary: "#dc2626",
    secondary: "#ef4444",
    accent: "#fca5a5",
    bg: "#fef2f2",
    header: "#991b1b",
    sectionHeader: "#b91c1c",
  },
  computer_science: {
    primary: "#7c3aed",
    secondary: "#8b5cf6",
    accent: "#c4b5fd",
    bg: "#f5f3ff",
    header: "#4c1d95",
    sectionHeader: "#6d28d9",
  },
  physics: {
    primary: "#2563eb",
    secondary: "#3b82f6",
    accent: "#93c5fd",
    bg: "#eff6ff",
    header: "#1e3a5f",
    sectionHeader: "#1d4ed8",
  },
  chemistry: {
    primary: "#059669",
    secondary: "#10b981",
    accent: "#6ee7b7",
    bg: "#ecfdf5",
    header: "#064e3b",
    sectionHeader: "#047857",
  },
  biology: {
    primary: "#16a34a",
    secondary: "#22c55e",
    accent: "#86efac",
    bg: "#f0fdf4",
    header: "#14532d",
    sectionHeader: "#15803d",
  },
  evs: {
    primary: "#ca8a04",
    secondary: "#eab308",
    accent: "#fde047",
    bg: "#fefce8",
    header: "#713f12",
    sectionHeader: "#a16207",
  },
};

// Fallback colors for unknown subjects
const DEFAULT_COLORS = {
  primary: "#0ea5e9",
  secondary: "#38bdf8",
  accent: "#7dd3fc",
  bg: "#f0f9ff",
  header: "#075985",
  sectionHeader: "#0284c7",
};

// Color utilities for deriving theme colors from school branding
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

export function getTheme(
  gradeBand: GradeBand,
  subjectSlug: string,
  schoolColors?: { primary: string; secondary: string }
): TemplateTheme {
  const bandStyle = GRADE_BAND_STYLES[gradeBand];

  const layout = GRADE_BAND_LAYOUTS[gradeBand];

  // Use school's admin-configured colors when available, otherwise fall back to subject defaults
  if (schoolColors) {
    return {
      gradeBand,
      subject: subjectSlug,
      primaryColor: schoolColors.primary,
      secondaryColor: schoolColors.secondary,
      accentColor: lighten(schoolColors.primary, 0.6),
      backgroundColor: lighten(schoolColors.primary, 0.93),
      headerColor: darken(schoolColors.primary, 0.35),
      sectionHeaderColor: darken(schoolColors.primary, 0.15),
      fontFamily: bandStyle.fontFamily,
      decorativeOpacity: bandStyle.decorativeOpacity,
      decorationLayout: layout,
    };
  }

  const colors = SUBJECT_COLORS[subjectSlug] || DEFAULT_COLORS;
  return {
    gradeBand,
    subject: subjectSlug,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    accentColor: colors.accent,
    backgroundColor: colors.bg,
    headerColor: colors.header,
    sectionHeaderColor: colors.sectionHeader,
    fontFamily: bandStyle.fontFamily,
    decorativeOpacity: bandStyle.decorativeOpacity,
    decorationLayout: layout,
  };
}

