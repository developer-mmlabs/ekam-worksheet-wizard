import { callLLM, createImageContent, createImageContentFromUrl, createTextContent } from "@/lib/openrouter";
import { WorksheetQuestions, WorksheetConfigValues } from "@/types";

export interface GenerationContext {
  gradeNumber: number;
  gradeName: string;
  subjectSlug: string;
  subjectName: string;
  chapterName: string;
}

// ============================================================
// Class 10 CBSE subject-specific prompts
// Pattern: chapter-wise practice worksheet with Sections A, B, C
//   A = pool of short-answer questions (config.sectionA controls count)
//   B = assertion-reason / grammar / vyakaran (config.assertionReason)
//   C = case study / source-based / literature extract / apathit bodh (config.caseStudy)
// Output is text-only. No marks shown. All questions compulsory.
// ============================================================

const ASSERTION_REASON_KEY = `Directions: Each question consists of two statements - Assertion (A) and Reason (R). Choose the correct option:
(a) Both A and R are true and R is the correct explanation of A.
(b) Both A and R are true but R is NOT the correct explanation of A.
(c) A is true but R is false.
(d) A is false but R is true.`;

const SECTION_A_QUALITY_RULES = `
QUALITY RULES FOR SECTION A:
- NO near-duplicate questions. Two questions must not test the same micro-concept with the same operation (e.g. don't ask "Express 156 as a product of its prime factors" AND "Express 5005 as a product of its prime factors" - pick one).
- Vary BOTH the numbers AND the framing. A question type should appear at most 2-3 times across Section A.
- Distribute across all topics of the chapter, not just the first few pages of source material.
- Order by cognitive level: first third = recall/definitions, middle third = computation/standard application, last third = word problems/proofs/HOTS.
- Use a wide variety of directives: "Find", "Solve", "Prove", "Show that", "Verify", "State", "Justify", "Construct", "Explain why", "Distinguish between", "Give an example of".`;

const PDF_SAFE_NOTATION = `
MATH NOTATION — PREFER Unicode (the PDF font renders math glyphs natively):
The PDF uses DejaVu Sans, which has full Unicode coverage for Latin, Greek, math operators, super/subscripts, fractions, and degree marks. Use proper math symbols directly — they render exactly as written. Output like "πr²h" reads better than "pi * r^2 * h" in a student-facing worksheet, so PREFER the Unicode form.

USE these Unicode glyphs DIRECTLY in all stimulus / question / option / assertion / reason text:
- Powers: x², x³, r², 10⁶, x⁴ — prefer Unicode superscripts over "x^2" / "r^2".
- Subscripts: H₂O, CO₂, x₁, x₂, NaOH — prefer Unicode subscripts over "H2O" / "x_1".
- Square root: √3, √15, √(x²+1).
- Pi: π. Example: "Area = πr²", "Volume = ⅔πr³". Use "22/7" only when the question is testing the numerical approximation.
- Degree: 30°, 90°, 45° — use the degree sign, not "30 degrees" or "30 deg".
- Multiplication: × for arithmetic ("3 × 4"); juxtaposition for algebra ("3a", "2πr", not "3 × a"). Avoid "*" in user-facing text.
- Division: ÷ for arithmetic; / for algebraic fractions ("a/b", "p/q").
- Plus-minus: ±. Approximate: ≈. Less / greater or equal: ≤, ≥. Not equal: ≠. Infinity: ∞.
- Common fractions: ½, ⅓, ¼, ⅔, ¾ in inline expressions. Use "a/b" form for general fractions.
- Greek letters: π, θ, α, β, γ, δ, Δ, λ, μ — use Unicode directly.
- Arrows for reactions: → (single), ⇌ (reversible). Example: "2H₂ + O₂ → 2H₂O".

ASCII fallback — use ONLY when Unicode is awkward (e.g. multi-line algebraic expansion):
- "(a + b)^2 = a^2 + 2ab + b^2" is fine inline.
- "sqrt(x^2 + y^2)" is fine when the radicand is long.
- Indexed variables beyond subscript range: x_10, y_n.

NEVER use LaTeX syntax (\\frac, \\sqrt, $...$, $$, \\(, \\[). There is NO LaTeX renderer — backslash commands render literally and break the worksheet.

Self-check before submitting: scan every field for backslash-commands or unrendered LaTeX tokens. Rewrite to Unicode or ASCII fallback.`;

const CASE_STUDY_QUALITY_RULES = `
QUALITY RULES FOR THE STIMULUS-AND-SUBQUESTIONS BLOCK:
- The stimulus must include concrete numbers, named entities, and a clear setting that the sub-questions can actually interrogate. Avoid vague generalities.
- Sub-questions must escalate in difficulty: first 1-2 are direct lookups from the stimulus, last 1-2 require multi-step reasoning or computation that the stimulus supports.
- All four MCQ options must be plausible. Mix the correct option position across sub-questions (don't always make it option (a)).

ORIGINALITY — case studies MUST be freshly composed, not lifted from NCERT (CRITICAL):
- The NCERT textbook pages are provided so you understand WHAT concepts the chapter covers. They are NOT a question bank to copy from.
- DO NOT reproduce NCERT example problems, solved examples, or exercise problems verbatim or near-verbatim. Examples to avoid: the juice-seller glass problem (Ch. Surface Areas and Volumes), the kite-flying problem (Ch. Some Applications of Trigonometry), the tower-shadow problem, the conical-tent problem — these are well-known NCERT exercises and students will have already seen them.
- Compose ORIGINAL real-world scenarios — same chapter concepts, different setting, different numbers, different framing. Draw on fresh contexts: Pradhan Mantri schemes, sports stadium / arena design, water tank or storage tank engineering, road / bridge construction, agricultural land partitioning, packaging / shipping containers, drone / sensor placement, contemporary daily-life Indian scenarios.
- NEVER reference NCERT figure numbers ("Fig 12.13", "Fig 13.21", "as shown in Fig X.Y", "Example 8", "Q. 14") in the stimulus. Those references only make sense inside the textbook; they have no meaning in a standalone worksheet. If the scenario needs a figure, EMIT one (Trigger A → imageSvg) and write "as shown in the figure below" — never "as shown in Fig X.Y".
- Sanity check before submitting: search your stimulus for the literal substring "Fig " — if found, rewrite or emit imageSvg.

DIVERSITY ACROSS MULTIPLE CASE STUDIES (CRITICAL):
- Each case study MUST test a DIFFERENT mathematical/scientific concept, theorem, or sub-topic from the chapter — not the same idea wrapped in different real-world scenarios.
- Before drafting: list the chapter's distinct sub-topics. Assign each case study to a DIFFERENT one.
- INCORRECT example (chapter "Circles", 4 case studies all about "tangent perpendicular to radius" in different scenarios — bicycle wheel, car wheel, pulley, water well — all asking the same Q3 "angle = 90°"). This is the SAME CONCEPT repeated; that is NOT acceptable diversity.
- CORRECT example (chapter "Circles", 4 case studies): (1) tangent length from external point, (2) two tangents from external point equal length, (3) sector area / arc length, (4) chord perpendicular to radius. Four distinct theorems, four distinct sub-questions.
- Real-world contexts must also vary (already required), but topic diversity is the PRIMARY requirement; context diversity is secondary. Two case studies on different sub-topics in the same context is better than two on the same sub-topic in different contexts.
- Verify before submitting: read across the case studies' first sub-question. If any two ask the same thing structurally, you have a duplication problem — rewrite.`;

const IMAGE_RULES = `
IMAGE RULES — start from "no image". Most case studies should be text-only.

DEFAULT: emit NO image field. Most CBSE case studies are pure text + sub-questions. An image adds value ONLY when (a) a diagram is genuinely required to answer at least one sub-question, OR (b) a labelled object/setup is the central pedagogical anchor of the scenario.

DO NOT emit an image when the case study is any of these (always text-only):
- A pure word / algebra problem: income & expenditure, ages, time-and-work, time-distance with no geometry, ratio / proportion arithmetic, percent profit-loss, simple-or-compound interest.
- A probability scenario with familiar objects (cards, dice, coins, balls in a bag) — readers know what these look like; drawing them adds nothing.
- A statistics problem where the data table is already in the stimulus text.
- A source extract, quoted passage, poem, dialogue, news report, treaty excerpt, or period text — these are ALWAYS text-only in CBSE board papers.
- Any case where a reader could solve every sub-question from the text alone without needing to see anything.
If in doubt → omit the image. The cost of a missing image is low; the cost of a wrong / unnecessary image is high.

EMIT an image ONLY when ONE of these triggers fires:

TRIGGER A → use "imageSvg" (Track D, math-exact SVG diagram):
The sub-questions reference specific MEASURABLE quantities — exact angles, exact ratios, exact coordinates, labelled vertices / sides, a geometric figure with marked dimensions. SVG is math-exact: a 72° sector drawn in SVG is literally 72°. AI image generation CANNOT honor measurable geometry.
Fires for ANY of these (this list is exhaustive for Class 10 Maths case studies — if the case study fits, you MUST emit imageSvg):
- Sector of a circle with a given central angle (Pattern B).
- Circle with chord and perpendicular from centre (Pattern A).
- Tangent from external point to a circle (Pattern C).
- Coordinate plane with marked points or distances (Pattern D).
- Triangle with labelled vertices, sides, or angle markers (Pattern E).
- Individual 3D solid with given dimensions — cylinder, cone, sphere, hemisphere (Pattern F).
- Composite 3D solid (cylinder + hemispherical caps; cone surmounted by hemisphere; cylinder with hemispherical base; cylinder with hemispheres scooped from ends; cone + frustum; cone + cylinder + hemisphere) — Pattern G.1 / G.2 / G.3 cover the common shapes.
- Quadratic / parabola with marked vertex and zeros.
- Rectangle or quadrilateral with labelled dimensions.
- Ray diagram (lens, mirror, prism); free-body / force diagram; electrical circuit topology.
Rule of thumb: if the stimulus gives you a height, a radius, a chord, an angle, a side, a coordinate, or two of these and asks the student to compute surface area / volume / length / position from them — Trigger A fires. Omitting the image here is a defect, not a safe default.

imageSvg is a JSON object: {
  "viewBox": "0 0 200 200",
  "shapes": [
    { "type": "circle", "cx": 100, "cy": 100, "r": 80, "stroke": "#2563eb", "strokeWidth": 1.5 },
    { "type": "rect",   "x": 20, "y": 40, "width": 60, "height": 40, "fill": "#fde68a", "stroke": "#92400e" },
    { "type": "line",   "x1": 0, "y1": 100, "x2": 200, "y2": 100, "stroke": "#1f2937", "strokeWidth": 1, "strokeDasharray": "3 2" },
    { "type": "path",   "d": "M 100 100 L 100 20 A 80 80 0 0 1 175 130 Z", "fill": "#fbbf24", "stroke": "#92400e" },
    { "type": "polygon", "points": "100,20 175,150 25,150", "fill": "none", "stroke": "#2563eb" },
    { "type": "text",   "x": 100, "y": 60, "text": "72°", "fontSize": 10, "textAnchor": "middle" }
  ]
}
SVG arc path for a sector with central angle θ (degrees) at center (cx, cy) with radius r, starting from angle 0:
  d = "M cx cy L (cx + r) cy A r r 0 [largeArc] 1 (cx + r·cos(θ)) (cy + r·sin(θ)) Z"
  where largeArc = 1 if θ > 180 else 0.

SVG DIVERSITY (when multiple case studies use Track D):
- If two case studies have similar underlying geometry (both circle-and-tangent, for example), the SVG diagrams must STILL look meaningfully different. Vary radius proportions, line orientation, viewBox composition, OR add scenario-specific decorative elements (spokes for a bicycle wheel, vertical rope-line for a pulley, wavy water lines for a well, petals around a flower bed).
- Identical-looking SVGs across case studies signal that the case studies themselves are duplicated — re-conceive the case studies.

TRIGGER B → use "imagePrompt" (Track A, AI image generation):
A tangible real-world OBJECT or SCENE is the central anchor of the scenario AND no specific measurements need to be visually accurate. The image is visual flavor / context, not measurement.
Fires for: a kite scene (chapter "Heights and Distances" — the angle in the drawing doesn't have to match the question's number); a satellite dish for "Parabolas" intro; a power plant or wind farm; a period crowd scene for History.
If the case study mentions specific angles, lengths, ratios, or coordinates that need to be VISUALLY ACCURATE → DO NOT use Track A. Use Track D.
Prompt format: 1-3 sentences describing the scene. Style is locked server-side (flat illustrative, soft colours, white background) — do not redescribe style.

CHOICE RULES:
- Pick AT MOST ONE of the two fields per case study (imageSvg or imagePrompt). Never both.
- When no trigger fires → OMIT both fields entirely. Do not emit empty objects, empty strings, or placeholder text — the field must not appear in the JSON at all.
- Across multiple case studies in the same worksheet, it is NORMAL AND EXPECTED for some (often most) to have no image. Do not feel obligated to image every case study.
- If specific measurable geometry is at stake, prefer Track D (imageSvg) over Track A (imagePrompt).
- Do not name real public figures in imagePrompt.`;

const SVG_MATH_PATTERNS = `
SVG MATH DIAGRAMS — read this section ONLY IF Trigger A in IMAGE RULES applied to the current case study. If no measurable geometry is at stake for this case study, SKIP this entire section and emit no imageSvg.

When Track D does apply: compute first, then draw.

CRITICAL: Do NOT eyeball proportions. BEFORE emitting the SVG:
1. Read the numeric quantities from the stimulus (radius, chord, angle, side lengths, etc.).
2. Derive any dependent quantities using the relevant formula.
3. Choose a scale factor s so the largest dimension fits comfortably in viewBox "0 0 200 200" (typical: largest length → ~80 viewBox units).
4. Compute every SVG coordinate from the scaled quantities.
5. ONLY THEN emit the SVG shapes.
Coordinate convention: viewBox "0 0 200 200", diagram centered at (100, 100). SVG y increases DOWNWARD (so "above center" means smaller y).

Use these worked patterns when the case study matches.

PATTERN A — Circle + chord + perpendicular from center to chord
Given: radius R, chord length C.
Compute: half_chord h = C/2; distance from center to chord d = sqrt(R*R - h*h).
Scale: s = 80/R; svg_R = 80; svg_h = h*s; svg_d = d*s.
Place chord horizontal above center; midpoint at (100, 100 - svg_d). Draw perpendicular from center (100, 100) down to the midpoint.
Example for R=10, C=16: h=8, d=6, s=8 → svg_h=64, svg_d=48. Chord from (36, 52) to (164, 52). Midpoint (100, 52).
SVG:
{
  "viewBox": "0 0 200 200",
  "shapes": [
    { "type": "circle", "cx": 100, "cy": 100, "r": 80, "stroke": "#2563eb", "strokeWidth": 1.5 },
    { "type": "line",   "x1": 36, "y1": 52, "x2": 164, "y2": 52, "stroke": "#1f2937", "strokeWidth": 1.5 },
    { "type": "line",   "x1": 100, "y1": 100, "x2": 100, "y2": 52, "stroke": "#1f2937", "strokeWidth": 1, "strokeDasharray": "3 2" },
    { "type": "circle", "cx": 100, "cy": 52, "r": 3, "fill": "#f59e0b" },
    { "type": "circle", "cx": 100, "cy": 100, "r": 2, "fill": "#1f2937" },
    { "type": "text",   "x": 100, "y": 178, "text": "chord = 16 m", "fontSize": 9, "textAnchor": "middle" },
    { "type": "text",   "x": 105, "y": 80,  "text": "6 m", "fontSize": 9 }
  ]
}

PATTERN B — Sector with central angle θ
Compute (θ in degrees): θ_rad = θ * π / 180; end_x = 100 + 80*cos(θ_rad); end_y = 100 + 80*sin(θ_rad); largeArc = (θ > 180) ? 1 : 0.
SVG path "d" = "M 100 100 L 180 100 A 80 80 0 \${largeArc} 1 \${end_x} \${end_y} Z".
Example for θ=72°: cos(72°)≈0.309, sin(72°)≈0.951 → end (124.7, 176.1). Path: "M 100 100 L 180 100 A 80 80 0 0 1 124.7 176.1 Z".
SVG:
{
  "viewBox": "0 0 200 200",
  "shapes": [
    { "type": "circle", "cx": 100, "cy": 100, "r": 80, "stroke": "#2563eb", "strokeWidth": 1.5, "fill": "none" },
    { "type": "path",   "d": "M 100 100 L 180 100 A 80 80 0 0 1 124.7 176.1 Z", "fill": "#fde68a", "stroke": "#92400e", "strokeWidth": 1 },
    { "type": "text",   "x": 135, "y": 125, "text": "72°", "fontSize": 10 },
    { "type": "text",   "x": 140, "y": 95,  "text": "r", "fontSize": 9 }
  ]
}

PATTERN C — Tangent from external point on a ground line
Given: circle radius R, external point at distance D from center.
Compute: tangent length t = sqrt(D*D - R*R). Place circle so it rests on the ground line (center above ground by R).
Place: circle center (100, 90) with svg_R=70; ground line y=160; external point on ground at (170, 160) with tangent line from external point to top of circle's right side. Mark the right-angle at the tangent point (perpendicularity of tangent to radius).
SVG:
{
  "viewBox": "0 0 200 200",
  "shapes": [
    { "type": "circle", "cx": 100, "cy": 90, "r": 70, "stroke": "#2563eb", "strokeWidth": 1.5 },
    { "type": "line",   "x1": 5, "y1": 160, "x2": 195, "y2": 160, "stroke": "#1f2937", "strokeWidth": 1.5 },
    { "type": "line",   "x1": 100, "y1": 90, "x2": 100, "y2": 160, "stroke": "#1f2937", "strokeWidth": 1, "strokeDasharray": "3 2" },
    { "type": "rect",   "x": 97, "y": 157, "width": 6, "height": 6, "stroke": "#1f2937", "strokeWidth": 0.8, "fill": "none" },
    { "type": "text",   "x": 100, "y": 178, "text": "A", "fontSize": 11, "textAnchor": "middle" }
  ]
}

PATTERN D — Coordinate plane with marked points
Place axes through (100, 100). Choose unit u based on max coordinate magnitude (e.g. for points within ±6, use u=15px). Plot (x, y) at SVG (100 + x*u, 100 - y*u). SVG y is DOWN so always NEGATE y for plotting.
Example marking zeros (-3, 0) and (5, 0) with u=15:
SVG:
{
  "viewBox": "0 0 200 200",
  "shapes": [
    { "type": "line", "x1": 10, "y1": 100, "x2": 190, "y2": 100, "stroke": "#9ca3af", "strokeWidth": 1 },
    { "type": "line", "x1": 100, "y1": 10, "x2": 100, "y2": 190, "stroke": "#9ca3af", "strokeWidth": 1 },
    { "type": "circle", "cx": 55, "cy": 100, "r": 3, "fill": "#dc2626" },
    { "type": "circle", "cx": 175, "cy": 100, "r": 3, "fill": "#dc2626" },
    { "type": "text", "x": 55, "y": 115, "text": "(-3, 0)", "fontSize": 8, "textAnchor": "middle" },
    { "type": "text", "x": 175, "y": 115, "text": "(5, 0)", "fontSize": 8, "textAnchor": "middle" }
  ]
}

PATTERN E — Triangle with labelled vertices
Polygon with 3 points. Label vertices with text just outside each corner.
Example for a right triangle with legs 6 and 8:
SVG:
{
  "viewBox": "0 0 200 200",
  "shapes": [
    { "type": "polygon", "points": "30,160 170,160 30,40", "stroke": "#2563eb", "strokeWidth": 1.5, "fill": "none" },
    { "type": "rect", "x": 30, "y": 145, "width": 15, "height": 15, "stroke": "#1f2937", "strokeWidth": 0.8, "fill": "none" },
    { "type": "text", "x": 25, "y": 175, "text": "A", "fontSize": 11 },
    { "type": "text", "x": 180, "y": 175, "text": "B", "fontSize": 11 },
    { "type": "text", "x": 25, "y": 35, "text": "C", "fontSize": 11 },
    { "type": "text", "x": 100, "y": 175, "text": "8 cm", "fontSize": 9, "textAnchor": "middle" },
    { "type": "text", "x": 18, "y": 105, "text": "6 cm", "fontSize": 9 }
  ]
}

PATTERN F — 3D solids (cylinder, cone, sphere, hemisphere)
CRITICAL: A hemisphere is HALF a sphere → in 2D it is drawn as a SEMICIRCLE (half-disk), NEVER a full circle. A sphere is a circle. A cylinder is a rectangle with elliptical or semicircular curves at the top and bottom for 3D feel. A cone is an isoceles triangle, optionally with a flat ellipse at its base.

For a vertical CYLINDER (height H, radius R), place at center (100, mid). Body is a rectangle of width 2*svg_R, height svg_H. Top is a full thin ellipse (rx=svg_R, ry=svg_R/3 or smaller); bottom is a half-ellipse arc (front-facing only, since the back is hidden by the body).

For a CONE (height H, base radius R, apex at top or bottom — context dependent), draw two slanted lines from the apex to the base ends, plus a flat ellipse at the base.

For a HEMISPHERE (radius R), draw a single semicircle. Use SVG path arc: "M (cx-R) cy A R R 0 0 1 (cx+R) cy" for an upward bulge, or "0 0 0 0" for downward.

PATTERN G — Composite solids
CRITICAL: When two solids are combined (cylinder + hemisphere, cone + hemisphere, cylinder + cone), they MUST share the same diameter at the junction. Match svg_R exactly across the components. Align all components vertically on the center axis x=100. The outline must be CONTINUOUS — no gaps, no overlapping circles.

G.1 — Cylinder with hemispherical caps at BOTH ends (water tank, capsule):
Given cylinder height H_cyl and shared radius R. Total height = H_cyl + 2R.
Scale s so total height ≈ 100 viewBox units. svg_R = R*s; svg_cyl_H = H_cyl*s.
Center at (100, 100). Cylinder body sides from y = (100 - svg_cyl_H/2) to (100 + svg_cyl_H/2), at x = 100±svg_R.
Top hemisphere bulges UP from cylinder top edge; bottom hemisphere bulges DOWN from cylinder bottom edge.
Example for H_cyl=2, R=0.5 (total height 3): s=33 → svg_R=16, svg_cyl_H=66. Cylinder y=[67, 133].
SVG:
{
  "viewBox": "0 0 200 200",
  "shapes": [
    { "type": "line", "x1": 84, "y1": 67, "x2": 84, "y2": 133, "stroke": "#2563eb", "strokeWidth": 1.5 },
    { "type": "line", "x1": 116, "y1": 67, "x2": 116, "y2": 133, "stroke": "#2563eb", "strokeWidth": 1.5 },
    { "type": "path", "d": "M 84 67 A 16 16 0 0 1 116 67", "stroke": "#2563eb", "strokeWidth": 1.5, "fill": "none" },
    { "type": "path", "d": "M 84 133 A 16 16 0 0 0 116 133", "stroke": "#2563eb", "strokeWidth": 1.5, "fill": "none" },
    { "type": "text", "x": 124, "y": 105, "text": "2 m", "fontSize": 9 },
    { "type": "text", "x": 100, "y": 175, "text": "diameter 1 m", "fontSize": 9, "textAnchor": "middle" }
  ]
}

G.2 — Cone surmounted by hemisphere (toy, ice-cream shape):
"Surmounted by" → hemisphere is ON TOP of the cone, with the cone apex pointing DOWN.
Given: shared radius R, cone height H_cone. Total height = R + H_cone.
Scale s. svg_R = R*s; svg_cone_H = H_cone*s. Hemisphere flat edge sits at y = 100 - svg_cone_H/2 + svg_R; cone apex at y = 100 + svg_cone_H/2 + svg_R.
Simplest: place hemisphere flat at y = top_of_cone_base, cone apex below it.
Example for R=4, H_cone=6 (total height 10): s=9 → svg_R=36, svg_cone_H=54.
Hemisphere flat at y=100; bulges up to y=64. Cone from (64,100) and (136,100) meeting apex at (100, 154).
SVG:
{
  "viewBox": "0 0 200 200",
  "shapes": [
    { "type": "path", "d": "M 64 100 A 36 36 0 0 1 136 100", "stroke": "#2563eb", "strokeWidth": 1.5, "fill": "none" },
    { "type": "line", "x1": 64, "y1": 100, "x2": 100, "y2": 154, "stroke": "#2563eb", "strokeWidth": 1.5 },
    { "type": "line", "x1": 136, "y1": 100, "x2": 100, "y2": 154, "stroke": "#2563eb", "strokeWidth": 1.5 },
    { "type": "line", "x1": 64, "y1": 100, "x2": 136, "y2": 100, "stroke": "#2563eb", "strokeWidth": 1, "strokeDasharray": "2 2" },
    { "type": "text", "x": 145, "y": 80, "text": "hemisphere", "fontSize": 8 },
    { "type": "text", "x": 145, "y": 135, "text": "cone H=6", "fontSize": 8 }
  ]
}

G.3 — Cylinder with hemispherical base (juice glass):
Cylinder body open at top; closed at the bottom by a hemisphere bulging DOWN.
Given: cylinder height H_cyl, shared radius R. Total height = H_cyl + R.
Place top of cylinder near y=40, cylinder body to y = 40 + svg_cyl_H, hemisphere bulges down to y = 40 + svg_cyl_H + svg_R.
Top of cylinder shown as an ellipse (open mouth, viewed from a slight angle).
Example for H_cyl=10, R=3 (total height 13): s=8 → svg_R=24, svg_cyl_H=80.
Cylinder body y=[40, 120]. Hemisphere from (76, 120) bulging down to (124, 120) returning, max y ≈ 144.
SVG:
{
  "viewBox": "0 0 200 200",
  "shapes": [
    { "type": "line", "x1": 76, "y1": 40, "x2": 76, "y2": 120, "stroke": "#2563eb", "strokeWidth": 1.5 },
    { "type": "line", "x1": 124, "y1": 40, "x2": 124, "y2": 120, "stroke": "#2563eb", "strokeWidth": 1.5 },
    { "type": "path", "d": "M 76 40 A 24 7 0 0 0 124 40 A 24 7 0 0 0 76 40", "stroke": "#2563eb", "strokeWidth": 1.5, "fill": "none" },
    { "type": "path", "d": "M 76 120 A 24 24 0 0 0 124 120", "stroke": "#2563eb", "strokeWidth": 1.5, "fill": "none" },
    { "type": "text", "x": 132, "y": 85, "text": "10 cm", "fontSize": 9 },
    { "type": "text", "x": 100, "y": 175, "text": "diameter 6 cm", "fontSize": 9, "textAnchor": "middle" }
  ]
}

GENERAL RULES:
- ALWAYS label key quantities (radius, chord, angle, side lengths, height, diameter) with "text" shapes positioned near the relevant element.
- Use stroke color "#2563eb" (blue) for the main shape; "#1f2937" (dark grey) for auxiliary lines; "#9ca3af" (light grey) for axes; "#dc2626" (red) or "#f59e0b" (amber) for marked points.
- Use strokeDasharray "3 2" for dashed lines (perpendiculars, auxiliary constructions); "2 2" for hidden / joining edges in 3D solids.
- A small filled circle of r=2-3 at intersection / marked points.
- A small unfilled rect (6x6) at right-angle markers.
- For patterns not covered above, follow the same compute-first approach: derive the quantities, scale to fit ~80-100 viewBox units for the largest dimension, then translate to SVG coordinates.`;

const ASSERTION_REASON_QUALITY_RULES = `
QUALITY RULES FOR ASSERTION-REASON SECTION:
- COVER THE FULL BREADTH of the chapter. Identify the chapter's distinct sub-topics, then distribute items so that no single sub-topic gets more than ~30% of the items (e.g. with 10 items, no sub-topic exceeds 3 items).
- NO duplicate or near-duplicate Reasons. Each Reason statement (R) must be UNIQUE across all items - both in the concept it cites and in its wording. If item 1's R refers to "parallel lines", no other item's R may refer to "parallel lines".
- NO mirror items. Don't generate two items that are essentially the same claim phrased oppositely (e.g. "consistent if unique solution" and "inconsistent if no solution" are the same idea - pick one).
- MIX the four correct outcomes deliberately. Across the items, aim for roughly equal counts of (a), (b), (c), (d) as the right answer. Do NOT make most items (a).
- AVOID vague meta-claims like "X method is the most accurate" or "X is not suitable" - those are debatable subjective statements, not crisp factual assertions. Stick to concrete properties, theorems, and definitions from the chapter.`;

const GRAMMAR_QUALITY_RULES = `
QUALITY RULES FOR GRAMMAR SECTION:
- Spread items across at least 4 different grammatical categories from this list: Tenses, Modals, Reported Speech, Subject-Verb Concord, Determiners, Active/Passive, Articles, Prepositions, Conditionals.
- No two items should test the same grammatical rule in the same way.
- Each item is a stand-alone exercise (no carry-over context between items).`;

const VYAKARAN_QUALITY_RULES = `
खंड B (व्याकरण) के लिए गुणवत्ता नियम:
- व्याकरण की कम से कम 4 अलग-अलग श्रेणियों में प्रश्न फैलाएं: रचना के आधार पर वाक्य भेद, वाच्य, पद-परिचय, समास, रस, अलंकार, मुहावरे।
- दो प्रश्न एक ही व्याकरण नियम का एक ही ढंग से परीक्षण नहीं करने चाहिए।
- प्रत्येक प्रश्न स्वतंत्र अभ्यास हो।`;

// ============================================================
// Unified section-fragment model. Each question type the prompt can
// produce — short_answer, assertion_reason, case_study, mcq,
// fill_in_the_blanks, match_the_following, very_short, long_answer —
// is represented as a SectionFragment. A Class 10 prompt builder
// concatenates its 3 subject-specific base fragments with the shared
// legacy mixin fragments, then calls assembleSections, which filters
// by count > 0, renumbers as A/B/C/..., and produces the prompt text,
// JSON schema fragment, and verification block. Sections with count 0
// are omitted entirely from the prompt.
// ============================================================

interface SectionFragment {
  configId: string; // matches the worksheet config key (e.g. "sectionA", "mcq")
  type: string;
  title: string;
  count: number;
  promptBlock: (id: string) => string;
  schemaEntry: (id: string) => string;
  verify: (sectionIdx: number) => string[];
}

// Reorder fragments by user-chosen configId order, with any
// fragments not listed in `order` appended at the end in their
// original order.
function orderFragments(fragments: SectionFragment[], order: string[] | undefined): SectionFragment[] {
  if (!order || order.length === 0) return fragments;
  const byId = new Map(fragments.map((f) => [f.configId, f]));
  const ordered: SectionFragment[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const f = byId.get(id);
    if (f && !seen.has(id)) {
      ordered.push(f);
      seen.add(id);
    }
  }
  for (const f of fragments) {
    if (!seen.has(f.configId)) ordered.push(f);
  }
  return ordered;
}

function assembleSections(
  fragments: SectionFragment[],
  order?: string[],
): {
  totalSections: number;
  countLines: string;
  sectionsText: string;
  schemaText: string;
  verificationText: string;
} {
  const active = orderFragments(fragments, order).filter((f) => f.count > 0);
  const idAt = (i: number) => String.fromCharCode(65 + i);

  return {
    totalSections: active.length,
    countLines: active
      .map((f, i) => `- Section ${idAt(i)} (${f.title}): EXACTLY ${f.count} items.`)
      .join("\n"),
    sectionsText: active.map((f, i) => f.promptBlock(idAt(i))).join("\n\n"),
    schemaText: active.map((f, i) => `    ${f.schemaEntry(idAt(i))}`).join(",\n"),
    verificationText: active.flatMap((f, i) => f.verify(i)).join("\n"),
  };
}

// Shared legacy add-on fragments. Marks are intentionally omitted —
// the worksheet is chapter-wise practice, not an exam paper.
function legacyMixinFragments(cfg: WorksheetConfigValues): SectionFragment[] {
  return [
    {
      configId: "mcq",
      type: "mcq",
      title: "Multiple Choice Questions",
      count: cfg.mcq ?? 0,
      promptBlock: (id) => `SECTION ${id} - Multiple Choice Questions (${cfg.mcq ?? 0} items)
Stand-alone MCQs with four options each. All four options must be plausible; mix the correct option position across items. Cover the chapter's full breadth.`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Multiple Choice Questions", "type": "mcq",
      "questions": [{ "number": 1, "text": "<question>", "options": [
        {"label": "a", "text": "<option>"}, {"label": "b", "text": "<option>"},
        {"label": "c", "text": "<option>"}, {"label": "d", "text": "<option>"}
      ] }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.mcq ?? 0}`],
    },
    {
      configId: "fillInTheBlanks",
      type: "fill_in_the_blanks",
      title: "Fill in the Blanks",
      count: cfg.fillInTheBlanks ?? 0,
      promptBlock: (id) => `SECTION ${id} - Fill in the Blanks (${cfg.fillInTheBlanks ?? 0} items)
Each item is a complete sentence with "______" (six underscores) marking the blank. The blanked term should be a key concept, term, formula, or value from the chapter.`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Fill in the Blanks", "type": "fill_in_the_blanks",
      "questions": [{ "number": 1, "text": "<sentence with ______>" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.fillInTheBlanks ?? 0}`],
    },
    {
      configId: "matchTheFollowing",
      type: "match_the_following",
      title: "Match the Following",
      count: cfg.matchTheFollowing ?? 0,
      promptBlock: (id) => `SECTION ${id} - Match the Following (${cfg.matchTheFollowing ?? 0} items)
Each item has Column A (4-5 terms) and Column B (4-5 matches, shuffled). Terms are key concepts, definitions, formulas, or named entities from the chapter.`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Match the Following", "type": "match_the_following",
      "questions": [{
        "number": 1, "text": "Match the items in Column A with Column B",
        "matchPairs": [
          {"left": "<term>", "right": "<match>"}, {"left": "<term>", "right": "<match>"},
          {"left": "<term>", "right": "<match>"}, {"left": "<term>", "right": "<match>"}
        ]
      }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.matchTheFollowing ?? 0}`],
    },
    {
      configId: "veryShort",
      type: "very_short",
      title: "Very Short Answer Questions",
      count: cfg.veryShort ?? 0,
      promptBlock: (id) => `SECTION ${id} - Very Short Answer Questions (${cfg.veryShort ?? 0} items)
Single-line answer items — definitions, one-word answers, units, formula recall, "state the X" questions. Test breadth of recall, not depth.`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Very Short Answer Questions", "type": "very_short",
      "questions": [{ "number": 1, "text": "<question>" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.veryShort ?? 0}`],
    },
    {
      configId: "longAnswer",
      type: "long_answer",
      title: "Long Answer / Numerical Questions",
      count: cfg.longAnswer ?? 0,
      promptBlock: (id) => `SECTION ${id} - Long Answer / Numerical Questions (${cfg.longAnswer ?? 0} items)
Multi-step problems requiring derivation, proof, or numerical computation. Each item must have 2-3 sub-parts (a, b, c) building toward the final answer.`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Long Answer / Numerical Questions", "type": "long_answer",
      "questions": [{
        "number": 1, "text": "<question>",
        "subparts": ["<subpart a>", "<subpart b>"]
      }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.longAnswer ?? 0}`],
    },
  ];
}

function class10Maths(chapterName: string, cfg: WorksheetConfigValues, sectionOrder?: string[]): string {
  const fragments: SectionFragment[] = [
    {
      configId: "sectionA",
      type: "short_answer",
      title: "Short Answer Questions",
      count: cfg.sectionA ?? 0,
      promptBlock: (id) => `SECTION ${id} - Short Answer Questions (${cfg.sectionA} items)
A mixed pool of concept, computation, proof and application questions. No options.
${SECTION_A_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Short Answer Questions", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<actual question>" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.sectionA}`],
    },
    {
      configId: "assertionReason",
      type: "assertion_reason",
      title: "Assertion and Reason",
      count: cfg.assertionReason ?? 0,
      promptBlock: (id) => `SECTION ${id} - Assertion and Reason (${cfg.assertionReason} items)
Use the standard 4-option key (in section instructions, not per item). Each item is a pair: Assertion (A) and Reason (R) - both full statements derived from chapter concepts.
${ASSERTION_REASON_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Assertion and Reason", "type": "assertion_reason",
      "instructions": ${JSON.stringify(ASSERTION_REASON_KEY)},
      "questions": [{ "number": 1, "assertion": "<full assertion statement>", "reason": "<full reason statement>", "text": "" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.assertionReason}`],
    },
    {
      configId: "caseStudy",
      type: "case_study",
      title: "Case Study",
      count: cfg.caseStudy ?? 0,
      promptBlock: (id) => `SECTION ${id} - Case Study (${cfg.caseStudy} case studies)
Each case study has a SUBSTANTIAL real-world stimulus of 150-200 words (8-12 lines), drawing from sports, finance, design, structures, daily life — followed by 4 MCQ sub-questions (4 options each). The stimulus must establish a concrete scenario with multiple named quantities, parties, or constraints so the sub-questions have ample material to interrogate.

Each case study DEFAULTS to text-only. Include an image ONLY if a trigger in IMAGE RULES fires. Pure algebraic word problems (income & expenditure, ages, time-and-work, ratio / proportion, percent, simple / compound interest) and probability scenarios using cards / dice / coins MUST remain text-only — do not draw familiar objects "for decoration".
${CASE_STUDY_QUALITY_RULES}
${IMAGE_RULES}
${SVG_MATH_PATTERNS}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Case Study", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<150-200 word real-world scenario, 8-12 lines>",
        "questions": [{ "number": 1, "text": "<sub-question>", "options": [
          {"label": "a", "text": "<option>"}, {"label": "b", "text": "<option>"},
          {"label": "c", "text": "<option>"}, {"label": "d", "text": "<option>"}
        ]}]
        /* Optional image field "imageSvg" or "imagePrompt" — see IMAGE RULES. DEFAULT is to omit both. */
      }] }`,
      verify: (i) => [
        `- sections[${i}].caseStudies.length === ${cfg.caseStudy}`,
        `- Each sections[${i}].caseStudies[j].questions.length === 4`,
      ],
    },
    ...legacyMixinFragments(cfg),
  ];

  const { totalSections, countLines, sectionsText, schemaText, verificationText } = assembleSections(fragments, sectionOrder);

  return `You are an expert CBSE Class 10 Mathematics worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT COUNTS — generate EXACTLY (not approximately):
${countLines}
Count your output items before submitting.

WORKSHEET STRUCTURE - produce exactly ${totalSections} section${totalSections === 1 ? "" : "s"}, in this order:

${sectionsText}

GLOBAL RULES:
- Every question must be directly derived from the chapter content in the provided textbook pages.
- Output PURE JSON only - no markdown fences, no commentary, no preamble.
${PDF_SAFE_NOTATION}

VERIFICATION before responding:
${verificationText}
If any count is off, fix it before producing the response.

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Mathematics", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
${schemaText}
  ]
}`;
}

function class10Science(chapterName: string, cfg: WorksheetConfigValues, sectionOrder?: string[]): string {
  const fragments: SectionFragment[] = [
    {
      configId: "sectionA",
      type: "short_answer",
      title: "Short Answer Questions",
      count: cfg.sectionA ?? 0,
      promptBlock: (id) => `SECTION ${id} - Short Answer Questions (${cfg.sectionA} items)
A mixed pool of concept, explanation, application and reasoning questions. Include at least 4 "Give a reason for..." or "Explain why..." items.
${SECTION_A_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Short Answer Questions", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<question>" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.sectionA}`],
    },
    {
      configId: "assertionReason",
      type: "assertion_reason",
      title: "Assertion and Reason",
      count: cfg.assertionReason ?? 0,
      promptBlock: (id) => `SECTION ${id} - Assertion and Reason (${cfg.assertionReason} items)
Standard 4-option key (in section instructions). Each item is a pair: Assertion (A) and Reason (R) - both full statements from chapter concepts.
${ASSERTION_REASON_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Assertion and Reason", "type": "assertion_reason",
      "instructions": ${JSON.stringify(ASSERTION_REASON_KEY)},
      "questions": [{ "number": 1, "assertion": "<statement>", "reason": "<statement>", "text": "" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.assertionReason}`],
    },
    {
      configId: "caseStudy",
      type: "case_study",
      title: "Case Study",
      count: cfg.caseStudy ?? 0,
      promptBlock: (id) => `SECTION ${id} - Case Study (${cfg.caseStudy} case studies)
Each case study has a SUBSTANTIAL scientific stimulus of 150-200 words (8-12 lines) — an experimental setup, real-world phenomenon, observation table, or principle in action — followed by 4 MCQ sub-questions (4 options each). Include data, numbers, specific observations, and named entities so the sub-questions have rich material to probe.

Each case study DEFAULTS to text-only. Include an image ONLY if a trigger in IMAGE RULES fires — e.g., a ray diagram, circuit, anatomy figure, or real-world setup that is the central anchor of the scenario. Observation-table stimuli, chemistry word problems, and reasoning-only items (where the data is already in the text) MUST remain text-only.
${CASE_STUDY_QUALITY_RULES}
${IMAGE_RULES}
Science-specific guidance (when an image IS warranted):
- For real-world phenomena that anchor the scenario (power plants, ecosystems, household appliances, lab observations from a distance): Trigger B → imagePrompt works well.
- For precise circuit diagrams, ray diagrams, anatomically accurate labelled specimens: Trigger B → imagePrompt with a detailed descriptive scene.
- Track D (imageSvg) suits simple ray-paths, lens / mirror setups, free-body diagrams, and any case where specific angles or distances are interrogated.`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Case Study", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<150-200 word scientific scenario, 8-12 lines>",
        "questions": [{ "number": 1, "text": "<sub-question>", "options": [
          {"label": "a", "text": "<option>"}, {"label": "b", "text": "<option>"},
          {"label": "c", "text": "<option>"}, {"label": "d", "text": "<option>"}
        ]}]
        /* Optional image field "imageSvg" or "imagePrompt" — see IMAGE RULES. DEFAULT is to omit both. */
      }] }`,
      verify: (i) => [
        `- sections[${i}].caseStudies.length === ${cfg.caseStudy}`,
        `- Each sections[${i}].caseStudies[j].questions.length === 4`,
      ],
    },
    ...legacyMixinFragments(cfg),
  ];

  const { totalSections, countLines, sectionsText, schemaText, verificationText } = assembleSections(fragments, sectionOrder);

  return `You are an expert CBSE Class 10 Science worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT COUNTS — generate EXACTLY (not approximately):
${countLines}
Count your output items before submitting.

WORKSHEET STRUCTURE - produce exactly ${totalSections} section${totalSections === 1 ? "" : "s"}, in this order:

${sectionsText}

GLOBAL RULES:
- Every question directly derived from the chapter content in the provided textbook pages.
- Balance Physics/Chemistry/Biology if the chapter touches multiple.
- Chemical formulae use Unicode subscripts: H₂O, CO₂, H₂SO₄, NaCl, Ca(OH)₂. Reactions use the Unicode arrow: "2H₂ + O₂ → 2H₂O" (not "->" and not "H2O").
- Output PURE JSON only - no markdown fences, no commentary.
${PDF_SAFE_NOTATION}

VERIFICATION before responding:
${verificationText}

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Science", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
${schemaText}
  ]
}`;
}

function class10SocialScience(chapterName: string, cfg: WorksheetConfigValues, sectionOrder?: string[]): string {
  const fragments: SectionFragment[] = [
    {
      configId: "sectionA",
      type: "short_answer",
      title: "Short Answer Questions",
      count: cfg.sectionA ?? 0,
      promptBlock: (id) => `SECTION ${id} - Short Answer Questions (${cfg.sectionA} items)
A mixed pool of factual recall, cause-effect and analytical questions. Cover the chapter's full breadth across History/Geography/Civics/Economics as relevant.
${SECTION_A_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Short Answer Questions", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<question>" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.sectionA}`],
    },
    {
      configId: "assertionReason",
      type: "assertion_reason",
      title: "Assertion and Reason",
      count: cfg.assertionReason ?? 0,
      promptBlock: (id) => `SECTION ${id} - Assertion and Reason (${cfg.assertionReason} items)
Standard 4-option key. Assertion is a historical/geographical/civic/economic claim; Reason explains.
${ASSERTION_REASON_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Assertion and Reason", "type": "assertion_reason",
      "instructions": ${JSON.stringify(ASSERTION_REASON_KEY)},
      "questions": [{ "number": 1, "assertion": "<statement>", "reason": "<statement>", "text": "" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.assertionReason}`],
    },
    {
      configId: "caseStudy",
      type: "case_study",
      title: "Source-Based Questions",
      count: cfg.caseStudy ?? 0,
      promptBlock: (id) => `SECTION ${id} - Source-Based Questions (${cfg.caseStudy} source extracts)
Each item has a 150-200 word source extract (8-12 lines): a quoted speech, treaty excerpt, news report, data passage, or NCERT-style historical narrative — period-authentic and rich enough to support multi-step interpretation. Followed by 4 sub-questions (3 MCQ + 1 short answer OR 4 MCQs).

Each item DEFAULTS to text-only — and most should stay that way. CBSE source-based questions are almost always text-only. Emit an image ONLY when the item is genuinely map-based (political / physical map of India or a region), visual-source-based (a specific political cartoon or photograph that the sub-questions interrogate), or chart-based (a data chart that the sub-questions read off). Quoted-text extracts, speeches, treaty excerpts, news reports, and narrative passages MUST NOT have an image.
${CASE_STUDY_QUALITY_RULES}
- The source extract must read like an actual primary text - quote a named speaker, dated document, or specific data source where appropriate.
${IMAGE_RULES}
Social-Science specific guidance (when an image IS warranted — usually it isn't):
- For period crowd scenes, everyday-life of an era, generic landscapes (rarely needed): Trigger B → imagePrompt.
- For political maps with state / country borders, historical scenes, political cartoons: Trigger B → imagePrompt with a detailed descriptive scene.
- For chart-based interpretation items (bar chart, pie chart, line graph that the sub-questions read off): Trigger A → imageSvg.`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Source-Based Questions", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<150-200 word source extract, 8-12 lines, primary-text style>",
        /* Optional image field "imageSvg" or "imagePrompt" — see IMAGE RULES. DEFAULT is to omit both. Quoted-text extracts MUST NOT have an image. */
        "questions": [{ "number": 1, "text": "<sub-question>", "options": [
          {"label": "a", "text": "<option>"}, {"label": "b", "text": "<option>"},
          {"label": "c", "text": "<option>"}, {"label": "d", "text": "<option>"}
        ]}]
      }] }`,
      verify: (i) => [
        `- sections[${i}].caseStudies.length === ${cfg.caseStudy}`,
        `- Each sections[${i}].caseStudies[j].questions.length === 4`,
      ],
    },
    ...legacyMixinFragments(cfg),
  ];

  const { totalSections, countLines, sectionsText, schemaText, verificationText } = assembleSections(fragments, sectionOrder);

  return `You are an expert CBSE Class 10 Social Science worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT COUNTS — generate EXACTLY (not approximately):
${countLines}
Count your output items before submitting.

WORKSHEET STRUCTURE - produce exactly ${totalSections} section${totalSections === 1 ? "" : "s"}, in this order:

${sectionsText}

GLOBAL RULES:
- Every question directly derived from the chapter content in the provided textbook pages.
- Indian context preferred for examples.
- Output PURE JSON only - no markdown fences, no commentary.
${PDF_SAFE_NOTATION}

VERIFICATION before responding:
${verificationText}

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Social Science", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
${schemaText}
  ]
}`;
}

function class10English(chapterName: string, cfg: WorksheetConfigValues, sectionOrder?: string[]): string {
  const fragments: SectionFragment[] = [
    {
      configId: "sectionA",
      type: "short_answer",
      title: "Short Answer / Reading Questions",
      count: cfg.sectionA ?? 0,
      promptBlock: (id) => `SECTION ${id} - Short Answer / Reading Questions (${cfg.sectionA} items)
A mixed pool of literal comprehension, inferential questions, vocabulary-in-context (meaning/synonym/antonym), character/theme/setting analysis, and RTC short questions. No options.
${SECTION_A_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Short Answer / Reading Questions", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<question>" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.sectionA}`],
    },
    {
      configId: "assertionReason",
      type: "short_answer",
      title: "Grammar",
      count: cfg.assertionReason ?? 0,
      promptBlock: (id) => `SECTION ${id} - Grammar (${cfg.assertionReason} items)
Each item tests a grammatical concept relevant to Class 10 CBSE (Tenses, Reported Speech, Modals, Subject-Verb Concord, Determiners, Active/Passive). Each is either:
- a fill-in-the-blank with the answer cue in brackets, OR
- an error-correction sentence, OR
- a transformation task.
Stand-alone short items, no options.
${GRAMMAR_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Grammar", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<grammar exercise>" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.assertionReason}`],
    },
    {
      configId: "caseStudy",
      type: "case_study",
      title: "Literature Extract",
      count: cfg.caseStudy ?? 0,
      promptBlock: (id) => `SECTION ${id} - Literature Extract (${cfg.caseStudy} extracts)
Each extract is a 4-7 line passage (50-90 words) drawn directly from the chapter text — prose or poetry as relevant. Quote the chapter text faithfully; do not paraphrase. Length is naturally constrained by the source text and should NOT be artificially padded. Each extract is followed by 4-5 sub-questions: 2-3 MCQ-style (4 options each) testing comprehension of the extract, and 1-2 short-answer sub-questions testing inference or theme.
${CASE_STUDY_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "Literature Extract", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<4-7 line extract (50-90 words) quoted faithfully from the chapter>",
        "questions": [
          { "number": 1, "text": "<MCQ sub-question>", "options": [
            {"label": "a", "text": "<option>"}, {"label": "b", "text": "<option>"},
            {"label": "c", "text": "<option>"}, {"label": "d", "text": "<option>"}
          ]},
          { "number": 4, "text": "<short-answer sub-question, no options>" }
        ]
      }] }`,
      verify: (i) => [`- sections[${i}].caseStudies.length === ${cfg.caseStudy}`],
    },
    ...legacyMixinFragments(cfg),
  ];

  const { totalSections, countLines, sectionsText, schemaText, verificationText } = assembleSections(fragments, sectionOrder);

  return `You are an expert CBSE Class 10 English (Language and Literature) worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT COUNTS — generate EXACTLY (not approximately):
${countLines}
Count your output items before submitting.

WORKSHEET STRUCTURE - produce exactly ${totalSections} section${totalSections === 1 ? "" : "s"}, in this order:

${sectionsText}

GLOBAL RULES:
- Stay within the chapter's content (textbook pages provided).
- Use language and tone appropriate for Class 10 CBSE.
- Output PURE JSON only - no markdown fences, no commentary.
${PDF_SAFE_NOTATION}

VERIFICATION before responding:
${verificationText}

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "English", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
${schemaText}
  ]
}`;
}

function class10Hindi(chapterName: string, cfg: WorksheetConfigValues, sectionOrder?: string[]): string {
  const fragments: SectionFragment[] = [
    {
      configId: "sectionA",
      type: "short_answer",
      title: "लघु उत्तरीय प्रश्न",
      count: cfg.sectionA ?? 0,
      promptBlock: (id) => `SECTION ${id} - लघु उत्तरीय प्रश्न (${cfg.sectionA} प्रश्न)
पाठ्यपुस्तक से अर्थ-ग्रहण, संदर्भ, भाव-स्पष्टीकरण, चरित्र-विश्लेषण, विषय-वस्तु संबंधी मिश्रित लघु प्रश्न। निर्देश शब्दों का प्रयोग: "बताइए", "लिखिए", "स्पष्ट कीजिए", "किसने कहा और क्यों", "आशय स्पष्ट कीजिए"। कोई विकल्प नहीं।
${SECTION_A_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "लघु उत्तरीय प्रश्न", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<प्रश्न>" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.sectionA}`],
    },
    {
      configId: "assertionReason",
      type: "short_answer",
      title: "व्याकरण",
      count: cfg.assertionReason ?? 0,
      promptBlock: (id) => `SECTION ${id} - व्याकरण (${cfg.assertionReason} प्रश्न)
कक्षा 10 के पाठ्यक्रम से प्रासंगिक व्याकरण: रचना के आधार पर वाक्य भेद, वाच्य, पद-परिचय, रस, समास, अलंकार, मुहावरे। प्रत्येक प्रश्न रिक्त-स्थान, पहचान, या रूपांतरण कार्य हो। कोई विकल्प नहीं।
${VYAKARAN_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "व्याकरण", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<व्याकरण अभ्यास>" }] }`,
      verify: (i) => [`- sections[${i}].questions.length === ${cfg.assertionReason}`],
    },
    {
      configId: "caseStudy",
      type: "case_study",
      title: "पाठ्यांश आधारित प्रश्न",
      count: cfg.caseStudy ?? 0,
      promptBlock: (id) => `SECTION ${id} - अपठित बोध / पाठ्यांश आधारित प्रश्न (${cfg.caseStudy} गद्यांश/पद्यांश)
प्रत्येक के लिए पाठ से 5-8 पंक्तियों का एक अंश (60-100 शब्द) दीजिए और 4-5 उप-प्रश्न दीजिए: 2-3 MCQ (4 विकल्प प्रत्येक) तथा 1-2 लघु उत्तरीय। पाठ का अंश यथावत् उद्धृत करें - व्याख्या नहीं।
${CASE_STUDY_QUALITY_RULES}`,
      schemaEntry: (id) => `{ "id": "${id}", "title": "पाठ्यांश आधारित प्रश्न", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<5-8 पंक्तियों का अंश (60-100 शब्द), पाठ से यथावत् उद्धृत>",
        "questions": [
          { "number": 1, "text": "<MCQ उप-प्रश्न>", "options": [
            {"label": "a", "text": "<विकल्प>"}, {"label": "b", "text": "<विकल्प>"},
            {"label": "c", "text": "<विकल्प>"}, {"label": "d", "text": "<विकल्प>"}
          ]},
          { "number": 4, "text": "<लघु उत्तरीय उप-प्रश्न, बिना विकल्प>" }
        ]
      }] }`,
      verify: (i) => [`- sections[${i}].caseStudies.length === ${cfg.caseStudy}`],
    },
    ...legacyMixinFragments(cfg),
  ];

  const { totalSections, countLines, sectionsText, schemaText, verificationText } = assembleSections(fragments, sectionOrder);

  return `आप एक विशेषज्ञ CBSE कक्षा 10 हिंदी वर्कशीट निर्माता हैं। दिए गए NCERT पाठ्यपुस्तक पृष्ठों के आधार पर अध्यायवार अभ्यास वर्कशीट तैयार करें।

अध्याय: ${chapterName}

कठोर संख्याएँ - ठीक उतनी ही उत्पन्न करें (अनुमानित नहीं):
${countLines}
उत्तर देने से पहले अपनी संख्याएँ गिनें।

वर्कशीट संरचना - ठीक ${totalSections} अनुभाग बनाएं, इसी क्रम में:

${sectionsText}

सामान्य नियम:
- सभी प्रश्न दिए गए पाठ्यपुस्तक पृष्ठों के अध्याय की विषय-वस्तु से ही निकाले जाएं।
- भाषा कक्षा 10 स्तर की हो।
- केवल शुद्ध JSON दें - कोई markdown fences नहीं, कोई टिप्पणी नहीं।
${PDF_SAFE_NOTATION}

जाँच - उत्तर देने से पहले:
${verificationText}

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Hindi", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
${schemaText}
  ]
}`;
}

// ============================================================
// Generic fallback prompt (used for grade+subject combinations
// that don't have a dedicated builder). Uses the same legacy mixin
// fragments as the Class 10 prompts.
// ============================================================

function buildGenericPrompt(cfg: WorksheetConfigValues, sectionOrder?: string[]): string {
  const { totalSections, countLines, sectionsText, schemaText, verificationText } = assembleSections(
    legacyMixinFragments(cfg),
    sectionOrder,
  );

  return `You are an expert educational worksheet creator for Indian schools (CBSE/ICSE curriculum). Generate high-quality worksheet questions from the textbook pages provided.

STRICT COUNTS — generate EXACTLY (not approximately):
${countLines}
Count your output items before submitting.

WORKSHEET STRUCTURE - produce exactly ${totalSections} section${totalSections === 1 ? "" : "s"}, in this order:

${sectionsText}

GLOBAL RULES:
- Every question must be directly derived from the chapter content in the provided textbook pages.
- Cover the chapter's full breadth — don't cluster questions from just one topic.
- Progress from simple recall to application and analysis.
- NEVER use placeholder text like "question text", "option text" — every field must contain actual educational content.
- Output PURE JSON only — no markdown fences, no commentary.

VERIFICATION before responding:
${verificationText}

JSON SCHEMA:
{
  "metadata": { "grade": "string", "subject": "string", "chapter": "string", "totalQuestions": <number> },
  "sections": [
${schemaText}
  ]
}`;
}

// ============================================================
// Dispatch: pick Class 10 subject-specific prompt or generic fallback
// ============================================================

function buildDeduplicationBlock(previousQuestions: string[]): string {
  if (previousQuestions.length === 0) return "";
  const numbered = previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return `

DEDUPLICATION — the following questions appeared in earlier worksheets for the SAME chapter.
DO NOT repeat any of them — not even paraphrased versions. Generate entirely fresh questions.
<previously_used>
${numbered}
</previously_used>`;
}

function buildSystemPrompt(ctx: GenerationContext, cfg: WorksheetConfigValues, sectionOrder?: string[], previousQuestions?: string[]): string {
  let prompt: string;
  if (ctx.gradeNumber === 10) {
    switch (ctx.subjectSlug) {
      case "mathematics":     prompt = class10Maths(ctx.chapterName, cfg, sectionOrder); break;
      case "science":         prompt = class10Science(ctx.chapterName, cfg, sectionOrder); break;
      case "social_studies":  prompt = class10SocialScience(ctx.chapterName, cfg, sectionOrder); break;
      case "english":         prompt = class10English(ctx.chapterName, cfg, sectionOrder); break;
      case "hindi":           prompt = class10Hindi(ctx.chapterName, cfg, sectionOrder); break;
      default:                prompt = buildGenericPrompt(cfg, sectionOrder);
    }
  } else {
    prompt = buildGenericPrompt(cfg, sectionOrder);
  }

  if (previousQuestions && previousQuestions.length > 0) {
    prompt += buildDeduplicationBlock(previousQuestions);
  }

  return prompt;
}

// ============================================================
// Public API
// ============================================================

export async function generateQuestions(
  imageUrls: string[],
  context: GenerationContext,
  config: WorksheetConfigValues,
  sectionOrder?: string[],
  previousQuestions?: string[],
): Promise<WorksheetQuestions> {
  const contentParts = [];

  contentParts.push(
    createTextContent(
      `Generate a comprehensive worksheet for:\n- Grade: ${context.gradeName}\n- Subject: ${context.subjectName}\n- Chapter: ${context.chapterName}\n\nBelow are the textbook pages and/or previous question papers for this chapter. Study them carefully and generate questions that cover all topics in the chapter.\n\nTextbook/Question Paper Pages:`
    )
  );

  const maxImages = Math.min(imageUrls.length, 50);
  for (let i = 0; i < maxImages; i++) {
    // Support both public URLs (preferred) and legacy base64 data
    if (imageUrls[i].startsWith("http")) {
      contentParts.push(createImageContentFromUrl(imageUrls[i]));
    } else {
      contentParts.push(createImageContent(imageUrls[i]));
    }
    contentParts.push(createTextContent(`[Page ${i + 1} of ${imageUrls.length}]`));
  }

  if (imageUrls.length > maxImages) {
    contentParts.push(
      createTextContent(
        `Note: ${imageUrls.length - maxImages} additional pages were not included due to size limits. Generate questions covering all visible content.`
      )
    );
  }

  contentParts.push(
    createTextContent(`\nNow generate the worksheet JSON. Valid JSON only, no markdown fences.`)
  );

  const response = await callLLM([
    { role: "system", content: buildSystemPrompt(context, config, sectionOrder, previousQuestions) },
    { role: "user", content: contentParts },
  ]);

  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const questions: WorksheetQuestions = JSON.parse(jsonStr);

  // Total includes case-study sub-questions
  const totalQuestions = questions.sections.reduce((sum, section) => {
    if (section.caseStudies?.length) {
      return sum + section.caseStudies.reduce((s, cs) => s + cs.questions.length, 0);
    }
    return sum + (section.questions?.length ?? 0);
  }, 0);

  questions.metadata.totalQuestions = totalQuestions;

  // Log count drift for Class 10 (where we ask for exact counts). With
  // dynamic section ordering, match by type instead of fixed indices.
  if (context.gradeNumber === 10) {
    const sectionCountByType: Record<string, number> = {};
    questions.sections.forEach((s) => {
      const n = s.caseStudies?.length ?? s.questions?.length ?? 0;
      sectionCountByType[s.type] = (sectionCountByType[s.type] ?? 0) + n;
    });

    const expectations: Array<[string, string, number]> = [
      ["sectionA", "short_answer", config.sectionA ?? 0],
      ["assertionReason", "assertion_reason", config.assertionReason ?? 0],
      ["caseStudy", "case_study", config.caseStudy ?? 0],
      ["mcq", "mcq", config.mcq ?? 0],
      ["fillInTheBlanks", "fill_in_the_blanks", config.fillInTheBlanks ?? 0],
      ["matchTheFollowing", "match_the_following", config.matchTheFollowing ?? 0],
      ["veryShort", "very_short", config.veryShort ?? 0],
      ["longAnswer", "long_answer", config.longAnswer ?? 0],
    ];

    const drift = expectations
      .filter(([, , want]) => want > 0)
      .filter(([, type, want]) => (sectionCountByType[type] ?? 0) !== want)
      .map(([label, type, want]) => `${label}: requested ${want}, got ${sectionCountByType[type] ?? 0}`);

    if (drift.length > 0) {
      console.warn(
        `[worksheet-gen] Count drift for ${context.subjectSlug} "${context.chapterName}": ${drift.join("; ")}`,
      );
    }
  }

  // Renumber sequentially within each section / case study
  questions.sections.forEach((section) => {
    section.questions?.forEach((q, idx) => {
      q.number = idx + 1;
    });
    section.caseStudies?.forEach((cs, csIdx) => {
      cs.number = csIdx + 1;
      cs.questions.forEach((q, idx) => {
        q.number = idx + 1;
      });
    });
  });

  return questions;
}
