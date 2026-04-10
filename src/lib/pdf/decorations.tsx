import React from "react";
import { Svg, G, Path, Circle, Rect, Line } from "@react-pdf/renderer";

// ─── Generic icon renderer ───────────────────────────────────────────

interface IconDef {
  fill?: string[];
  stroke?: string[];
  dots?: [number, number, number][];
  rings?: [number, number, number][];
  rects?: [number, number, number, number, number?][];
  lines?: [number, number, number, number][];
}

interface IconProps {
  icon: IconDef;
  size: number;
  color: string;
  opacity: number;
}

export function SubjectIcon({ icon, size, color, opacity }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <G opacity={opacity}>
        {icon.fill?.map((d, i) => (
          <Path key={`f${i}`} d={d} fill={color} />
        ))}
        {icon.stroke?.map((d, i) => (
          <Path key={`s${i}`} d={d} fill="none" stroke={color} strokeWidth={1.5} />
        ))}
        {icon.dots?.map(([cx, cy, r], i) => (
          <Circle key={`d${i}`} cx={cx} cy={cy} r={r} fill={color} />
        ))}
        {icon.rings?.map(([cx, cy, r], i) => (
          <Circle key={`r${i}`} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.5} />
        ))}
        {icon.rects?.map(([x, y, w, h, rx], i) => (
          <Rect key={`rc${i}`} x={x} y={y} width={w} height={h} rx={rx || 0} fill={color} />
        ))}
        {icon.lines?.map(([x1, y1, x2, y2], i) => (
          <Line key={`l${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} />
        ))}
      </G>
    </Svg>
  );
}

// ─── SCIENCE icons ───────────────────────────────────────────────────

const SCIENCE_ICONS: IconDef[] = [
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
  // Test Tube
  {
    stroke: ["M16 4 L16 30 Q16 37 20 37 Q24 37 24 30 L24 4"],
    lines: [[14, 4, 26, 4]],
    fill: ["M16 22 L16 30 Q16 37 20 37 Q24 37 24 30 L24 22 Z"],
  },
  // Beaker with measurement lines
  {
    stroke: ["M8 6 L8 34 Q8 37 11 37 L29 37 Q32 37 32 34 L32 6"],
    lines: [[6, 6, 10, 6], [10, 16, 16, 16], [10, 26, 16, 26]],
  },
  // Molecule (3 bonded atoms)
  {
    dots: [[12, 28, 5], [28, 28, 5], [20, 10, 5]],
    lines: [[15, 24, 18, 14], [25, 24, 22, 14], [17, 28, 23, 28]],
  },
];

// ─── MATHEMATICS icons ───────────────────────────────────────────────

const MATH_ICONS: IconDef[] = [
  // Triangle
  {
    stroke: ["M20 4 L36 36 L4 36 Z"],
  },
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
  // Diamond
  {
    stroke: ["M20 4 L36 20 L20 36 L4 20 Z"],
  },
  // Plus sign
  {
    fill: ["M16 6 L24 6 L24 16 L34 16 L34 24 L24 24 L24 34 L16 34 L16 24 L6 24 L6 16 L16 16 Z"],
  },
];

// ─── ENGLISH icons ───────────────────────────────────────────────────

const ENGLISH_ICONS: IconDef[] = [
  // Open Book
  {
    stroke: [
      "M20 8 Q10 6 4 8 L4 34 Q12 32 20 34",
      "M20 8 Q30 6 36 8 L36 34 Q28 32 20 34",
    ],
    lines: [[20, 8, 20, 34]],
  },
  // Pencil
  {
    stroke: ["M14 4 L26 4 L26 28 L20 36 L14 28 Z"],
    lines: [[14, 28, 26, 28]],
    fill: ["M14 28 L20 36 L26 28 Z"],
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
  // Quill Pen
  {
    stroke: ["M32 4 Q20 16 8 36", "M32 4 Q26 10 30 16 Q24 14 18 18"],
  },
  // Scroll
  {
    stroke: [
      "M10 8 Q6 8 6 12 Q6 16 10 16 L10 32 Q10 36 14 36 L30 36 Q34 36 34 32 L34 16",
      "M30 8 Q34 8 34 12 Q34 16 30 16 L10 16",
    ],
  },
];

// ─── SOCIAL STUDIES icons ────────────────────────────────────────────

const SOCIAL_ICONS: IconDef[] = [
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
  // Mountain with snow cap
  {
    stroke: ["M2 36 L14 10 L20 20 L26 8 L38 36"],
    fill: ["M26 8 L22 16 L30 16 Z"],
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
  // Tree
  {
    dots: [[20, 14, 12]],
    rects: [[17, 26, 6, 12]],
  },
  // Sun with rays
  {
    dots: [[20, 20, 8]],
    lines: [
      [20, 4, 20, 8], [20, 32, 20, 36],
      [4, 20, 8, 20], [32, 20, 36, 20],
      [9, 9, 12, 12], [28, 9, 31, 12],
      [9, 31, 12, 28], [28, 31, 31, 28],
    ],
  },
  // Flag on pole
  {
    lines: [[8, 4, 8, 36]],
    fill: ["M8 4 L32 4 L28 14 L32 24 L8 24 Z"],
  },
];

// ─── HINDI icons ─────────────────────────────────────────────────────

const HINDI_ICONS: IconDef[] = [
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
  // Temple Bell
  {
    stroke: ["M12 28 Q8 20 12 10 Q16 4 20 4 Q24 4 28 10 Q32 20 28 28"],
    lines: [[10, 28, 30, 28]],
    dots: [[20, 32, 2], [20, 4, 2]],
  },
  // Closed Book with spine
  {
    rects: [[8, 6, 24, 30, 2]],
    stroke: ["M8 6 Q6 6 6 8 L6 34 Q6 36 8 36"],
    lines: [[8, 6, 8, 36]],
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
  // Kalash (decorative pot)
  {
    stroke: ["M14 16 Q8 20 8 28 Q8 36 16 38 L24 38 Q32 36 32 28 Q32 20 26 16"],
    lines: [[12, 16, 28, 16]],
    fill: ["M18 16 L16 10 Q18 6 20 6 Q22 6 24 10 L22 16 Z"],
  },
];

// ─── COMPUTER SCIENCE icons ──────────────────────────────────────────

const CS_ICONS: IconDef[] = [
  // Monitor with screen glare
  {
    rects: [[4, 4, 32, 22, 2]],
    lines: [[16, 26, 16, 32], [24, 26, 24, 32], [12, 32, 28, 32]],
    stroke: ["M8 8 L12 8 L12 12"],
  },
  // Gear / Cog
  {
    rings: [[20, 20, 7]],
    fill: [
      "M17 3 L23 3 L23 8 L17 8 Z",
      "M17 32 L23 32 L23 37 L17 37 Z",
      "M3 17 L3 23 L8 23 L8 17 Z",
      "M32 17 L32 23 L37 23 L37 17 Z",
      "M8 7 L13 7 L8 13 Z",
      "M27 7 L32 7 L32 13 Z",
      "M7 27 L13 32 L7 32 Z",
      "M27 32 L32 32 L32 27 Z",
    ],
  },
  // Angle Brackets (code)
  {
    stroke: ["M14 8 L4 20 L14 32", "M26 8 L36 20 L26 32"],
  },
  // Cursor Arrow
  {
    fill: ["M8 4 L8 30 L14 24 L22 34 L26 30 L18 20 L26 18 Z"],
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
  // Binary 0 and 1
  {
    rings: [[10, 12, 6], [30, 26, 6]],
    lines: [[28, 8, 28, 20], [12, 22, 12, 34]],
  },
];

// ─── PHYSICS icons ──────────────────────────────────────────────────

const PHYSICS_ICONS: IconDef[] = [
  // Prism with light ray
  {
    stroke: ["M10 34 L20 6 L30 34 Z"],
    lines: [[2, 20, 10, 20], [30, 14, 38, 8], [30, 20, 38, 20], [30, 26, 38, 32]],
  },
  // Magnet (horseshoe)
  {
    stroke: ["M10 6 L10 24 Q10 36 20 36 Q30 36 30 24 L30 6"],
    rects: [[8, 6, 6, 8], [26, 6, 6, 8]],
  },
  // Pendulum
  {
    lines: [[20, 4, 12, 30], [20, 4, 20, 30], [20, 4, 28, 30]],
    dots: [[12, 32, 3], [20, 32, 3], [28, 32, 3]],
    stroke: ["M8, 4 L32 4"],
  },
  // Wave / Sine curve
  {
    stroke: ["M2 20 Q8 6 14 20 Q20 34 26 20 Q32 6 38 20"],
  },
  // Convex Lens
  {
    stroke: ["M20 4 Q32 10 32 20 Q32 30 20 36 Q8 30 8 20 Q8 10 20 4"],
    lines: [[20, 2, 20, 38]],
  },
  // Pulley
  {
    rings: [[20, 14, 8]],
    lines: [[8, 14, 8, 36], [32, 14, 32, 36]],
    stroke: ["M8 14 L12 14", "M28 14 L32 14"],
    rects: [[4, 32, 8, 6, 1], [28, 32, 8, 6, 1]],
  },
];

// ─── CHEMISTRY icons ────────────────────────────────────────────────

const CHEMISTRY_ICONS: IconDef[] = [
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
  // Pipette / dropper
  {
    stroke: ["M18 18 L18 34 Q18 38 20 38 Q22 38 22 34 L22 18"],
    fill: ["M16 18 Q16 10 20 6 Q24 10 24 18 Z"],
    dots: [[20, 38, 2]],
  },
  // Reaction arrows (equilibrium)
  {
    stroke: ["M6 16 L34 16", "M34 24 L6 24"],
    fill: ["M30 12 L36 16 L30 20 Z", "M10 20 L4 24 L10 28 Z"],
  },
];

// ─── BIOLOGY icons ──────────────────────────────────────────────────

const BIOLOGY_ICONS: IconDef[] = [
  // DNA double helix
  {
    stroke: [
      "M12 4 Q28 10 28 16 Q28 22 12 28 Q12 34 28 38",
      "M28 4 Q12 10 12 16 Q12 22 28 28 Q28 34 12 38",
    ],
    lines: [[16, 10, 24, 10], [14, 20, 26, 20], [16, 30, 24, 30]],
  },
  // Leaf with veins
  {
    stroke: [
      "M20 36 L20 20 Q8 18 6 10 Q8 2 20 6 Q32 2 34 10 Q32 18 20 20",
    ],
    lines: [[20, 20, 12, 14], [20, 20, 28, 14]],
  },
  // Microscope
  {
    stroke: ["M22 8 L22 20 Q22 24 18 28 L16 32"],
    rings: [[22, 6, 4]],
    rects: [[10, 32, 16, 4, 1]],
    lines: [[14, 20, 30, 20]],
  },
  // Cell (oval with nucleus)
  {
    stroke: ["M20 6 Q36 6 36 20 Q36 34 20 34 Q4 34 4 20 Q4 6 20 6"],
    dots: [[22, 18, 6]],
    rings: [[22, 18, 9]],
  },
  // Heart (anatomical-ish)
  {
    fill: ["M20 36 Q6 26 6 16 Q6 6 14 6 Q20 6 20 14 Q20 6 26 6 Q34 6 34 16 Q34 26 20 36"],
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

// ─── EVS (Environmental Studies) icons ──────────────────────────────

const EVS_ICONS: IconDef[] = [
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
  // Sun and cloud
  {
    dots: [[14, 14, 6]],
    lines: [[14, 4, 14, 6], [4, 14, 6, 14], [7, 7, 9, 9], [21, 7, 19, 9], [7, 21, 9, 19]],
    stroke: ["M18 22 Q22 16 28 18 Q34 16 36 22 Q38 28 32 30 L16 30 Q12 28 14 24 Q14 22 18 22"],
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
  // Cloud with rain drops
  {
    stroke: ["M10 16 Q10 8 18 8 Q22 4 28 10 Q34 8 36 16 Q38 22 30 22 L10 22 Q4 20 6 16 Q6 14 10 16"],
    fill: ["M14 26 L16 32 L12 32 Z", "M22 26 L24 32 L20 32 Z", "M30 26 L32 32 L28 32 Z"],
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

// ─── Subject background shapes (larger, subtler silhouettes) ─────────

export const SUBJECT_BG_SHAPES: Record<string, IconDef[]> = {
  science: [
    // Hexagon (benzene ring)
    { stroke: ["M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z"] },
    // Oval (cell shape)
    { stroke: ["M8 20 Q8 8 20 8 Q32 8 32 20 Q32 32 20 32 Q8 32 8 20"] },
  ],
  mathematics: [
    // Diamond grid
    { stroke: ["M20 4 L36 20 L20 36 L4 20 Z", "M20 4 L20 36", "M4 20 L36 20"] },
    // Right angle
    { stroke: ["M8 36 L8 8 L36 36"], lines: [[8, 28, 16, 28], [16, 28, 16, 36]] },
  ],
  english: [
    // Book page
    { rects: [[6, 4, 28, 34, 3]], lines: [[10, 10, 30, 10], [10, 16, 30, 16], [10, 22, 26, 22], [10, 28, 28, 28]] },
    // Thought cloud
    { rings: [[14, 22, 10], [26, 18, 8], [20, 10, 6]] },
  ],
  social_studies: [
    // Map contour
    { stroke: ["M4 12 Q12 8 20 14 Q28 20 36 12", "M4 24 Q14 18 22 24 Q30 30 36 22", "M4 34 Q16 28 24 34 Q32 38 36 32"] },
    // Compass circle
    { rings: [[20, 20, 16], [20, 20, 10]], lines: [[20, 2, 20, 38], [2, 20, 38, 20]] },
  ],
  hindi: [
    // Rangoli petal pattern
    { stroke: ["M20 4 Q28 12 28 20 Q28 28 20 36 Q12 28 12 20 Q12 12 20 4", "M4 20 Q12 12 20 12 Q28 12 36 20 Q28 28 20 28 Q12 28 4 20"] },
    // Arch (temple arch)
    { stroke: ["M6 36 L6 16 Q6 4 20 4 Q34 4 34 16 L34 36"], lines: [[6, 36, 34, 36]] },
  ],
  computer_science: [
    // Circuit board traces
    { lines: [[4, 12, 16, 12], [16, 12, 16, 24], [16, 24, 28, 24], [28, 24, 28, 36], [28, 12, 36, 12], [4, 28, 12, 28], [12, 28, 12, 36]], dots: [[16, 12, 2], [16, 24, 2], [28, 24, 2], [28, 12, 2], [12, 28, 2]] },
    // Terminal window
    { rects: [[4, 4, 32, 32, 3]], lines: [[4, 10, 36, 10]], stroke: ["M10 18 L18 24 L10 30"] },
  ],
  physics: [
    // Wave pattern
    { stroke: ["M2 14 Q10 4 18 14 Q26 24 34 14", "M2 26 Q10 16 18 26 Q26 36 34 26"] },
    // Lens diagram
    { stroke: ["M20 4 Q34 12 34 20 Q34 28 20 36 Q6 28 6 20 Q6 12 20 4"], lines: [[20, 2, 20, 38], [2, 20, 38, 20]] },
  ],
  chemistry: [
    // Hexagonal benzene ring
    { stroke: ["M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z", "M20 8 L30 14 L30 26 L20 32 L10 26 L10 14 Z"] },
    // Round flask silhouette
    { stroke: ["M16 4 L16 14 Q2 20 2 28 Q2 40 20 40 Q38 40 38 28 Q38 20 24 14 L24 4"] },
  ],
  biology: [
    // Cell membrane oval
    { stroke: ["M20 4 Q38 4 38 20 Q38 36 20 36 Q2 36 2 20 Q2 4 20 4"], rings: [[24, 18, 8]] },
    // DNA ladder
    { stroke: ["M10 4 Q30 12 10 20 Q30 28 10 36", "M30 4 Q10 12 30 20 Q10 28 30 36"], lines: [[14, 10, 26, 10], [16, 20, 24, 20], [14, 30, 26, 30]] },
  ],
  evs: [
    // Leaf outline
    { stroke: ["M20 38 L20 20 Q4 18 4 10 Q4 2 20 4 Q36 2 36 10 Q36 18 20 20"], lines: [[20, 18, 12, 12], [20, 16, 28, 12]] },
    // Mountain and sun
    { stroke: ["M2 36 L16 12 L22 22 L30 8 L38 36"], dots: [[8, 10, 5]] },
  ],
};

// ─── Exports ─────────────────────────────────────────────────────────

export const SUBJECT_ICONS: Record<string, IconDef[]> = {
  science: SCIENCE_ICONS,
  mathematics: MATH_ICONS,
  english: ENGLISH_ICONS,
  social_studies: SOCIAL_ICONS,
  hindi: HINDI_ICONS,
  computer_science: CS_ICONS,
  physics: PHYSICS_ICONS,
  chemistry: CHEMISTRY_ICONS,
  biology: BIOLOGY_ICONS,
  evs: EVS_ICONS,
};

// Fallback icons for unknown subjects
export const DEFAULT_ICONS: IconDef[] = [
  { fill: ["M20 4 L24 16 L36 16 L26 24 L30 36 L20 28 L10 36 L14 24 L4 16 L16 16 Z"] },
  { rings: [[20, 20, 14]] },
  { stroke: ["M20 4 L36 20 L20 36 L4 20 Z"] },
  { rects: [[8, 8, 24, 24, 2]] },
  { fill: ["M16 8 L24 8 L24 16 L32 16 L32 24 L24 24 L24 32 L16 32 L16 24 L8 24 L8 16 L16 16 Z"] },
  { stroke: ["M20 6 L34 34 L6 34 Z"] },
];
