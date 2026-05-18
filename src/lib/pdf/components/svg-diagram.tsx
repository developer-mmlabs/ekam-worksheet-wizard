import React from "react";
import { Svg, Circle, Rect, Line, Path, Polygon, Text as SvgText } from "@react-pdf/renderer";
import type { SvgDiagram, SvgShape } from "@/types";
import { PDF_FONT } from "../fonts";

interface SvgDiagramBlockProps {
  diagram: SvgDiagram;
  width?: number;
  height?: number;
}

// ============================================================
// Renders an LLM-emitted SvgDiagram as react-pdf Svg primitives.
// Coordinates from the LLM are in viewBox space; width/height
// control the printed size in points.
// ============================================================

export function SvgDiagramBlock({ diagram, width = 120, height = 120 }: SvgDiagramBlockProps) {
  return (
    <Svg width={width} height={height} viewBox={diagram.viewBox}>
      {diagram.shapes.map((shape, i) => renderShape(shape, i))}
    </Svg>
  );
}

function renderShape(shape: SvgShape, key: number) {
  switch (shape.type) {
    case "circle":
      return (
        <Circle
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={shape.fill ?? "none"}
          stroke={shape.stroke ?? "#1f2937"}
          strokeWidth={shape.strokeWidth ?? 1.5}
        />
      );
    case "rect":
      return (
        <Rect
          key={key}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          fill={shape.fill ?? "none"}
          stroke={shape.stroke ?? "#1f2937"}
          strokeWidth={shape.strokeWidth ?? 1.5}
        />
      );
    case "line":
      return (
        <Line
          key={key}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          stroke={shape.stroke ?? "#1f2937"}
          strokeWidth={shape.strokeWidth ?? 1.5}
          strokeDasharray={shape.strokeDasharray}
        />
      );
    case "path":
      return (
        <Path
          key={key}
          d={shape.d}
          fill={shape.fill ?? "none"}
          stroke={shape.stroke ?? "#1f2937"}
          strokeWidth={shape.strokeWidth ?? 1.5}
        />
      );
    case "polygon":
      return (
        <Polygon
          key={key}
          points={shape.points}
          fill={shape.fill ?? "none"}
          stroke={shape.stroke ?? "#1f2937"}
          strokeWidth={shape.strokeWidth ?? 1.5}
        />
      );
    case "text":
      return (
        <SvgText
          key={key}
          x={shape.x}
          y={shape.y}
          textAnchor={shape.textAnchor ?? "start"}
          fill={shape.fill ?? "#1f2937"}
          style={{ fontSize: shape.fontSize ?? 10, fontFamily: PDF_FONT }}
        >
          {shape.text}
        </SvgText>
      );
    default:
      return null;
  }
}
