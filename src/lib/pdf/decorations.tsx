import React from "react";
import { Svg, G, Path, Circle, Rect, Line } from "@react-pdf/renderer";

// ─── Types ──────────────────────────────────────────────────────────

export interface IconDef {
  fill?: string[];
  stroke?: string[];
  dots?: [number, number, number][];
  rings?: [number, number, number][];
  rects?: [number, number, number, number, number?][];
  lines?: [number, number, number, number][];
}

export interface SubjectDecorationSet {
  hero: IconDef[];    // 3-4 detailed icons for corner compositions
  pattern: IconDef[]; // 2-3 simple geometric tiles for repeating wallpaper
  accent: IconDef[];  // 3-4 tiny glyphs for margin accents
}

interface IconProps {
  icon: IconDef;
  size: number;
  color: string;
  opacity: number;
  strokeWidth?: number;
}

// ─── Renderer ───────────────────────────────────────────────────────

export function SubjectIcon({ icon, size, color, opacity, strokeWidth = 1.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <G opacity={opacity}>
        {icon.fill?.map((d, i) => (
          <Path key={`f${i}`} d={d} fill={color} />
        ))}
        {icon.stroke?.map((d, i) => (
          <Path key={`s${i}`} d={d} fill="none" stroke={color} strokeWidth={strokeWidth} />
        ))}
        {icon.dots?.map(([cx, cy, r], i) => (
          <Circle key={`d${i}`} cx={cx} cy={cy} r={r} fill={color} />
        ))}
        {icon.rings?.map(([cx, cy, r], i) => (
          <Circle key={`r${i}`} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} />
        ))}
        {icon.rects?.map(([x, y, w, h, rx], i) => (
          <Rect key={`rc${i}`} x={x} y={y} width={w} height={h} rx={rx || 0} fill={color} />
        ))}
        {icon.lines?.map(([x1, y1, x2, y2], i) => (
          <Line key={`l${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={strokeWidth} />
        ))}
      </G>
    </Svg>
  );
}

// ════════════════════════════════════════════════════════════════════
//  SCIENCE
// ════════════════════════════════════════════════════════════════════

const SCIENCE_HERO: IconDef[] = [
  // Erlenmeyer Flask
  {
    stroke: ["M17 4 L17 15 L7 34 Q6 36 8 36 L32 36 Q34 36 33 34 L23 15 L23 4"],
    lines: [[15, 4, 25, 4]],
    fill: ["M10 27 L30 27 L33 34 Q34 36 32 36 L8 36 Q6 36 7 34 Z"],
  },
  // Atom (nucleus + orbits + electrons)
  {
    dots: [[20, 20, 3], [35, 20, 2], [20, 5, 2], [8, 30, 2]],
    rings: [[20, 20, 10], [20, 20, 16]],
  },
  // Magnifying Glass
  {
    rings: [[16, 16, 10]],
    stroke: ["M24 24 L36 36"],
  },
  // Molecule (3 bonded atoms)
  {
    dots: [[12, 28, 5], [28, 28, 5], [20, 10, 5]],
    lines: [[15, 24, 18, 14], [25, 24, 22, 14], [17, 28, 23, 28]],
  },
];

const SCIENCE_PATTERN: IconDef[] = [
  // Hexagon (benzene ring)
  { stroke: ["M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z"] },
  // Molecular bond link (two atoms connected)
  { dots: [[14, 20, 3], [26, 20, 3]], lines: [[17, 20, 23, 20]] },
  // Atom orbit ring
  { rings: [[20, 20, 6]], stroke: ["M6 20 Q6 8 20 8 Q34 8 34 20 Q34 32 20 32 Q6 32 6 20"] },
];

const SCIENCE_ACCENT: IconDef[] = [
  // 4-point sparkle
  { fill: ["M20 6 L23 17 L34 20 L23 23 L20 34 L17 23 L6 20 L17 17 Z"] },
  // Three electron dots
  { dots: [[10, 20, 4], [20, 20, 4], [30, 20, 4]] },
  // Water droplet
  { fill: ["M20 6 Q12 18 12 24 Q12 34 20 34 Q28 34 28 24 Q28 18 20 6"] },
];

// ════════════════════════════════════════════════════════════════════
//  MATHEMATICS
// ════════════════════════════════════════════════════════════════════

const MATH_HERO: IconDef[] = [
  // Pi symbol
  {
    stroke: ["M6 12 L34 12", "M14 12 L14 36", "M26 12 Q28 36 34 36"],
  },
  // Geometry compass
  {
    stroke: ["M20 6 L10 36", "M20 6 L30 36"],
    dots: [[20, 6, 3]],
    lines: [[13, 26, 27, 26]],
  },
  // Infinity
  {
    stroke: ["M20 20 Q14 8 7 14 Q0 20 7 26 Q14 32 20 20 Q26 8 33 14 Q40 20 33 26 Q26 32 20 20"],
  },
  // Triangle
  {
    stroke: ["M20 4 L36 36 L4 36 Z"],
  },
];

const MATH_PATTERN: IconDef[] = [
  // Grid crosshair
  { lines: [[20, 4, 20, 36], [4, 20, 36, 20]], dots: [[20, 20, 2]] },
  // Small equilateral triangle
  { stroke: ["M20 8 L32 32 L8 32 Z"] },
  // Circle with center dot
  { rings: [[20, 20, 12]], dots: [[20, 20, 2]] },
];

const MATH_ACCENT: IconDef[] = [
  // Plus sign
  { fill: ["M16 8 L24 8 L24 16 L32 16 L32 24 L24 24 L24 32 L16 32 L16 24 L8 24 L8 16 L16 16 Z"] },
  // Right angle mark
  { lines: [[8, 32, 8, 10], [8, 32, 30, 32], [8, 24, 16, 24], [16, 24, 16, 32]] },
  // Equals sign
  { lines: [[8, 16, 32, 16], [8, 24, 32, 24]] },
  // Multiplication dot
  { dots: [[20, 20, 6]] },
];

// ════════════════════════════════════════════════════════════════════
//  ENGLISH
// ════════════════════════════════════════════════════════════════════

const ENGLISH_HERO: IconDef[] = [
  // Open Book
  {
    stroke: [
      "M20 8 Q10 6 4 8 L4 34 Q12 32 20 34",
      "M20 8 Q30 6 36 8 L36 34 Q28 32 20 34",
    ],
    lines: [[20, 8, 20, 34]],
  },
  // Quill Pen
  {
    stroke: ["M32 4 Q20 16 8 36", "M32 4 Q26 10 30 16 Q24 14 18 18"],
  },
  // Speech Bubble
  {
    stroke: ["M6 4 L34 4 Q38 4 38 8 L38 22 Q38 26 34 26 L16 26 L8 34 L12 26 L6 26 Q2 26 2 22 L2 8 Q2 4 6 4"],
  },
  // Light Bulb
  {
    stroke: ["M14 24 Q8 18 8 12 Q8 4 20 4 Q32 4 32 12 Q32 18 26 24"],
    rects: [[15, 24, 10, 6, 1]],
    lines: [[15, 28, 25, 28], [16, 31, 24, 31]],
  },
];

const ENGLISH_PATTERN: IconDef[] = [
  // Ruled lines (notebook paper)
  { lines: [[6, 12, 34, 12], [6, 20, 34, 20], [6, 28, 34, 28]] },
  // Quotation marks
  { fill: ["M8 10 Q12 4 18 10 L16 20 L10 20 Z", "M22 10 Q26 4 32 10 L30 20 L24 20 Z"] },
];

const ENGLISH_ACCENT: IconDef[] = [
  // 5-point star
  { fill: ["M20 4 L24 16 L36 16 L26 24 L30 36 L20 28 L10 36 L14 24 L4 16 L16 16 Z"] },
  // Bookmark
  { fill: ["M12 4 L28 4 L28 36 L20 28 L12 36 Z"] },
  // Ellipsis dots
  { dots: [[10, 20, 3], [20, 20, 3], [30, 20, 3]] },
];

// ════════════════════════════════════════════════════════════════════
//  SOCIAL STUDIES
// ════════════════════════════════════════════════════════════════════

const SOCIAL_HERO: IconDef[] = [
  // Globe with latitude/longitude
  {
    rings: [[20, 20, 16]],
    stroke: [
      "M4 20 L36 20",
      "M20 4 L20 36",
      "M10 10 Q20 16 30 10",
      "M10 30 Q20 24 30 30",
    ],
  },
  // Compass Rose
  {
    fill: [
      "M20 2 L23 16 L20 13 L17 16 Z",
      "M20 38 L23 24 L20 27 L17 24 Z",
      "M2 20 L16 17 L13 20 L16 23 Z",
      "M38 20 L24 17 L27 20 L24 23 Z",
    ],
    rings: [[20, 20, 4]],
  },
  // Mountain with snow cap
  {
    stroke: ["M2 36 L14 10 L20 20 L26 8 L38 36"],
    fill: ["M26 8 L22 16 L30 16 Z"],
  },
  // Flag on pole
  {
    lines: [[8, 4, 8, 36]],
    fill: ["M8 4 L32 4 L28 14 L32 24 L8 24 Z"],
  },
];

const SOCIAL_PATTERN: IconDef[] = [
  // Contour wavy lines
  { stroke: ["M4 14 Q12 8 20 14 Q28 20 36 14", "M4 26 Q12 20 20 26 Q28 32 36 26"] },
  // Globe grid (circle with cross)
  { rings: [[20, 20, 14]], lines: [[20, 6, 20, 34], [6, 20, 34, 20]] },
];

const SOCIAL_ACCENT: IconDef[] = [
  // Flag pennant
  { lines: [[10, 6, 10, 34]], fill: ["M10 6 L32 12 L10 22 Z"] },
  // Sun burst
  { dots: [[20, 20, 6]], lines: [[20, 6, 20, 12], [20, 28, 20, 34], [6, 20, 12, 20], [28, 20, 34, 20]] },
  // Simple leaf
  { stroke: ["M20 34 L20 16 Q10 10 14 4 Q20 8 20 16", "M20 16 Q30 10 26 4"] },
];

// ════════════════════════════════════════════════════════════════════
//  HINDI
// ════════════════════════════════════════════════════════════════════

const HINDI_HERO: IconDef[] = [
  // Diya (oil lamp) with flame
  {
    stroke: ["M12 24 Q8 24 6 28 Q4 34 12 36 L28 36 Q36 34 34 28 Q32 24 28 24"],
    fill: ["M18 24 L20 14 L22 24 Z"],
    dots: [[20, 12, 3]],
  },
  // Lotus flower
  {
    stroke: [
      "M20 36 Q14 28 8 28 Q14 22 20 16",
      "M20 36 Q26 28 32 28 Q26 22 20 16",
      "M20 36 Q10 24 4 28 Q12 18 20 12",
      "M20 36 Q30 24 36 28 Q28 18 20 12",
    ],
  },
  // Peacock Feather eye
  {
    stroke: [
      "M20 38 Q18 20 20 4",
      "M20 14 Q12 16 10 22 Q12 28 20 26 Q28 28 30 22 Q28 16 20 14",
    ],
    dots: [[20, 20, 4]],
    rings: [[20, 20, 7]],
  },
  // Temple Bell
  {
    stroke: ["M12 28 Q8 20 12 10 Q16 4 20 4 Q24 4 28 10 Q32 20 28 28"],
    lines: [[10, 28, 30, 28]],
    dots: [[20, 32, 2], [20, 4, 2]],
  },
];

const HINDI_PATTERN: IconDef[] = [
  // Diamond lattice (rangoli)
  { stroke: ["M20 6 L34 20 L20 34 L6 20 Z", "M20 13 L27 20 L20 27 L13 20 Z"] },
  // Mandala rings with cardinal dots
  { rings: [[20, 20, 8], [20, 20, 14]], dots: [[20, 6, 2], [20, 34, 2], [6, 20, 2], [34, 20, 2]] },
];

const HINDI_ACCENT: IconDef[] = [
  // Small bell
  { stroke: ["M14 28 Q10 20 14 12 Q18 6 20 6 Q22 6 26 12 Q30 20 26 28"], lines: [[12, 28, 28, 28]], dots: [[20, 32, 2]] },
  // Flower bud
  { fill: ["M20 8 Q28 16 28 24 Q28 32 20 36 Q12 32 12 24 Q12 16 20 8"] },
  // Bindiya (decorated dot)
  { dots: [[20, 20, 6]], rings: [[20, 20, 10]] },
];

// ════════════════════════════════════════════════════════════════════
//  COMPUTER SCIENCE
// ════════════════════════════════════════════════════════════════════

const CS_HERO: IconDef[] = [
  // Monitor with screen glare
  {
    rects: [[4, 4, 32, 22, 2]],
    lines: [[16, 26, 16, 32], [24, 26, 24, 32], [12, 32, 28, 32]],
    stroke: ["M8 8 L12 8 L12 12"],
  },
  // Angle Brackets (code)
  {
    stroke: ["M14 8 L4 20 L14 32", "M26 8 L36 20 L26 32"],
  },
  // CPU Chip with pins
  {
    rects: [[10, 10, 20, 20, 2]],
    lines: [
      [14, 10, 14, 4], [20, 10, 20, 4], [26, 10, 26, 4],
      [14, 30, 14, 36], [20, 30, 20, 36], [26, 30, 26, 36],
      [10, 14, 4, 14], [10, 20, 4, 20], [10, 26, 4, 26],
      [30, 14, 36, 14], [30, 20, 36, 20], [30, 26, 36, 26],
    ],
  },
  // Cursor Arrow
  {
    fill: ["M8 4 L8 30 L14 24 L22 34 L26 30 L18 20 L26 18 Z"],
  },
];

const CS_PATTERN: IconDef[] = [
  // Circuit trace with junction dots
  { lines: [[6, 12, 20, 12], [20, 12, 20, 28], [20, 28, 34, 28]], dots: [[6, 12, 2], [20, 12, 2], [20, 28, 2], [34, 28, 2]] },
  // Binary dot matrix
  { dots: [[8, 8, 2], [20, 8, 2], [32, 8, 2], [8, 20, 2], [32, 20, 2], [8, 32, 2], [20, 32, 2], [32, 32, 2]] },
  // Terminal prompt
  { rects: [[4, 4, 32, 32, 3]], lines: [[4, 12, 36, 12]], stroke: ["M10 20 L18 26 L10 32"] },
];

const CS_ACCENT: IconDef[] = [
  // Angle brackets </>
  { stroke: ["M14 8 L6 20 L14 32", "M26 8 L34 20 L26 32"] },
  // Pixel grid (4 squares)
  { rects: [[6, 6, 12, 12, 1], [22, 6, 12, 12, 1], [6, 22, 12, 12, 1], [22, 22, 12, 12, 1]] },
  // Cursor dot
  { fill: ["M10 6 L10 28 L16 22 L22 32 L26 28 L20 18 L26 16 Z"] },
];

// ════════════════════════════════════════════════════════════════════
//  PHYSICS
// ════════════════════════════════════════════════════════════════════

const PHYSICS_HERO: IconDef[] = [
  // Prism with light ray
  {
    stroke: ["M10 34 L20 6 L30 34 Z"],
    lines: [[2, 20, 10, 20], [30, 14, 38, 8], [30, 20, 38, 20], [30, 26, 38, 32]],
  },
  // Pendulum
  {
    lines: [[20, 4, 12, 30], [20, 4, 20, 30], [20, 4, 28, 30]],
    dots: [[12, 32, 3], [20, 32, 3], [28, 32, 3]],
    stroke: ["M8 4 L32 4"],
  },
  // Wave / Sine curve
  {
    stroke: ["M2 20 Q8 6 14 20 Q20 34 26 20 Q32 6 38 20"],
  },
  // Magnet (horseshoe)
  {
    stroke: ["M10 6 L10 24 Q10 36 20 36 Q30 36 30 24 L30 6"],
    rects: [[8, 6, 6, 8], [26, 6, 6, 8]],
  },
];

const PHYSICS_PATTERN: IconDef[] = [
  // Sine wave
  { stroke: ["M4 20 Q12 6 20 20 Q28 34 36 20"] },
  // Force arrow
  { lines: [[8, 20, 32, 20]], fill: ["M28 14 L36 20 L28 26 Z"] },
  // Parallel wave lines
  { stroke: ["M4 14 Q12 6 20 14 Q28 22 36 14", "M4 26 Q12 18 20 26 Q28 34 36 26"] },
];

const PHYSICS_ACCENT: IconDef[] = [
  // Electron with orbit
  { dots: [[20, 20, 3], [32, 20, 2]], rings: [[20, 20, 12]] },
  // Lightning bolt
  { stroke: ["M24 4 L16 18 L22 18 L14 36"] },
  // Directional arrow
  { lines: [[6, 20, 34, 20]], fill: ["M28 12 L36 20 L28 28 Z"] },
];

// ════════════════════════════════════════════════════════════════════
//  CHEMISTRY
// ════════════════════════════════════════════════════════════════════

const CHEMISTRY_HERO: IconDef[] = [
  // Round-bottom flask
  {
    stroke: ["M16 4 L16 14 Q4 20 4 28 Q4 38 20 38 Q36 38 36 28 Q36 20 24 14 L24 4"],
    lines: [[14, 4, 26, 4]],
  },
  // Molecular bond (two atoms bonded)
  {
    dots: [[12, 20, 7], [28, 20, 7]],
    lines: [[19, 18, 21, 18], [19, 22, 21, 22]],
  },
  // Bunsen burner with flame
  {
    rects: [[14, 24, 12, 14, 1]],
    stroke: ["M16 24 L16 20 L6 20 L6 36", "M24 24 L24 20 L34 20"],
    fill: ["M17 24 L20 10 L23 24 Z"],
    dots: [[20, 8, 3]],
  },
  // Periodic table element box
  {
    rects: [[6, 6, 28, 28, 2]],
    lines: [[10, 14, 30, 14], [10, 26, 30, 26]],
    dots: [[20, 20, 4]],
  },
];

const CHEMISTRY_PATTERN: IconDef[] = [
  // Benzene ring (hexagon with inner hexagon)
  { stroke: ["M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z", "M20 10 L28 15 L28 25 L20 30 L12 25 L12 15 Z"] },
  // Bond angle with electron dots
  { stroke: ["M10 12 L20 30 L30 12"], dots: [[10, 12, 3], [30, 12, 3], [20, 30, 3]] },
];

const CHEMISTRY_ACCENT: IconDef[] = [
  // Bubbles (two circles)
  { rings: [[16, 18, 10], [30, 28, 5]] },
  // Droplet
  { fill: ["M20 8 Q14 18 14 24 Q14 32 20 34 Q26 32 26 24 Q26 18 20 8"] },
  // Electron pair (two dots bonded)
  { dots: [[14, 20, 5], [26, 20, 5]], lines: [[19, 18, 21, 18], [19, 22, 21, 22]] },
];

// ════════════════════════════════════════════════════════════════════
//  BIOLOGY
// ════════════════════════════════════════════════════════════════════

const BIOLOGY_HERO: IconDef[] = [
  // DNA double helix
  {
    stroke: [
      "M12 4 Q28 10 28 16 Q28 22 12 28 Q12 34 28 38",
      "M28 4 Q12 10 12 16 Q12 22 28 28 Q28 34 12 38",
    ],
    lines: [[16, 10, 24, 10], [14, 20, 26, 20], [16, 30, 24, 30]],
  },
  // Cell (oval with nucleus)
  {
    stroke: ["M20 6 Q36 6 36 20 Q36 34 20 34 Q4 34 4 20 Q4 6 20 6"],
    dots: [[22, 18, 6]],
    rings: [[22, 18, 9]],
  },
  // Leaf with veins
  {
    stroke: [
      "M20 36 L20 20 Q8 18 6 10 Q8 2 20 6 Q32 2 34 10 Q32 18 20 20",
    ],
    lines: [[20, 20, 12, 14], [20, 20, 28, 14]],
  },
  // Butterfly
  {
    stroke: [
      "M20 8 Q6 4 4 14 Q2 24 14 26 Q20 28 20 28",
      "M20 8 Q34 4 36 14 Q38 24 26 26 Q20 28 20 28",
    ],
    lines: [[20, 8, 20, 36]],
    dots: [[12, 14, 3], [28, 14, 3]],
  },
];

const BIOLOGY_PATTERN: IconDef[] = [
  // Cell membrane (wavy parallel lines)
  { stroke: ["M4 16 Q12 10 20 16 Q28 22 36 16", "M4 24 Q12 18 20 24 Q28 30 36 24"] },
  // Organic oval (cell shape)
  { stroke: ["M12 12 Q20 4 28 12 Q36 20 28 28 Q20 36 12 28 Q4 20 12 12"] },
];

const BIOLOGY_ACCENT: IconDef[] = [
  // Heartbeat pulse
  { stroke: ["M4 20 L12 20 L16 8 L20 32 L24 12 L28 20 L36 20"] },
  // Seed (oval)
  { fill: ["M20 8 Q30 14 30 22 Q30 32 20 34 Q10 32 10 22 Q10 14 20 8"] },
  // Small cell with nucleus
  { rings: [[20, 20, 12]], dots: [[22, 18, 4]] },
];

// ════════════════════════════════════════════════════════════════════
//  EVS (Environmental Studies)
// ════════════════════════════════════════════════════════════════════

const EVS_HERO: IconDef[] = [
  // Tree with roots
  {
    dots: [[20, 12, 10]],
    rects: [[17, 22, 6, 8]],
    stroke: ["M14 30 Q10 34 6 36", "M26 30 Q30 34 34 36", "M18 30 Q16 34 14 36", "M22 30 Q24 34 26 36"],
  },
  // Water droplet
  {
    fill: ["M20 6 Q10 18 10 24 Q10 34 20 36 Q30 34 30 24 Q30 18 20 6"],
  },
  // Flower with petals
  {
    dots: [[20, 20, 4]],
    stroke: [
      "M20 20 Q14 14 20 8 Q26 14 20 20",
      "M20 20 Q14 26 20 32 Q26 26 20 20",
      "M20 20 Q14 18 8 20 Q14 26 20 20",
      "M20 20 Q26 18 32 20 Q26 26 20 20",
    ],
    rects: [[18, 32, 4, 6]],
  },
  // Recycle arrows
  {
    stroke: [
      "M20 6 L30 20 L24 20",
      "M30 20 L28 32 L22 28",
      "M28 32 L10 28 L14 22",
      "M10 28 L12 14 L18 16",
    ],
    fill: ["M28 18 L32 22 L30 14 Z", "M24 30 L20 26 L28 28 Z", "M12 22 L16 18 L10 20 Z"],
  },
];

const EVS_PATTERN: IconDef[] = [
  // Leaf vein pattern
  { lines: [[20, 6, 20, 34]], stroke: ["M20 14 L10 8", "M20 14 L30 8", "M20 24 L12 18", "M20 24 L28 18"] },
  // Water ripple (concentric circles)
  { rings: [[20, 20, 6], [20, 20, 12], [20, 20, 18]] },
  // Wavy horizon
  { stroke: ["M4 16 Q12 10 20 16 Q28 22 36 16", "M4 28 Q14 22 22 28 Q30 34 36 28"] },
];

const EVS_ACCENT: IconDef[] = [
  // Raindrop
  { fill: ["M20 6 Q12 18 12 24 Q12 34 20 34 Q28 34 28 24 Q28 18 20 6"] },
  // Simple 4-petal flower
  { dots: [[20, 20, 4]], rings: [[20, 10, 5], [30, 20, 5], [20, 30, 5], [10, 20, 5]] },
  // Small leaf
  { stroke: ["M20 34 L20 14 Q8 8 20 4 Q32 8 20 14"] },
];

// ════════════════════════════════════════════════════════════════════
//  DEFAULT (unknown subjects)
// ════════════════════════════════════════════════════════════════════

const DEFAULT_HERO: IconDef[] = [
  // 5-point star
  { fill: ["M20 4 L24 16 L36 16 L26 24 L30 36 L20 28 L10 36 L14 24 L4 16 L16 16 Z"] },
  // Circle
  { rings: [[20, 20, 14]] },
  // Diamond
  { stroke: ["M20 4 L36 20 L20 36 L4 20 Z"] },
  // Rounded square
  { rects: [[8, 8, 24, 24, 4]] },
];

const DEFAULT_PATTERN: IconDef[] = [
  // Grid crosshair
  { lines: [[20, 4, 20, 36], [4, 20, 36, 20]], dots: [[20, 20, 2]] },
  // Simple circle
  { rings: [[20, 20, 10]] },
];

const DEFAULT_ACCENT: IconDef[] = [
  // Small star
  { fill: ["M20 6 L23 17 L34 20 L23 23 L20 34 L17 23 L6 20 L17 17 Z"] },
  // Dot
  { dots: [[20, 20, 6]] },
  // Diamond
  { fill: ["M20 8 L32 20 L20 32 L8 20 Z"] },
];

// ─── Exports ────────────────────────────────────────────────────────

export const SUBJECT_DECORATIONS: Record<string, SubjectDecorationSet> = {
  science: { hero: SCIENCE_HERO, pattern: SCIENCE_PATTERN, accent: SCIENCE_ACCENT },
  mathematics: { hero: MATH_HERO, pattern: MATH_PATTERN, accent: MATH_ACCENT },
  english: { hero: ENGLISH_HERO, pattern: ENGLISH_PATTERN, accent: ENGLISH_ACCENT },
  social_studies: { hero: SOCIAL_HERO, pattern: SOCIAL_PATTERN, accent: SOCIAL_ACCENT },
  hindi: { hero: HINDI_HERO, pattern: HINDI_PATTERN, accent: HINDI_ACCENT },
  computer_science: { hero: CS_HERO, pattern: CS_PATTERN, accent: CS_ACCENT },
  physics: { hero: PHYSICS_HERO, pattern: PHYSICS_PATTERN, accent: PHYSICS_ACCENT },
  chemistry: { hero: CHEMISTRY_HERO, pattern: CHEMISTRY_PATTERN, accent: CHEMISTRY_ACCENT },
  biology: { hero: BIOLOGY_HERO, pattern: BIOLOGY_PATTERN, accent: BIOLOGY_ACCENT },
  evs: { hero: EVS_HERO, pattern: EVS_PATTERN, accent: EVS_ACCENT },
};

export const DEFAULT_DECORATIONS: SubjectDecorationSet = {
  hero: DEFAULT_HERO,
  pattern: DEFAULT_PATTERN,
  accent: DEFAULT_ACCENT,
};
