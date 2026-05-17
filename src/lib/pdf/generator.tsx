import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { WorksheetPDFData, QuestionSection } from "@/types";
import { WorksheetHeader } from "./components/header";
import { QuestionSectionBlock } from "./components/section";
import { SubjectIcon, SUBJECT_DECORATIONS, DEFAULT_DECORATIONS } from "./decorations";
import { renderToBuffer } from "@react-pdf/renderer";

// A4 dimensions in points (1pt = 1/72 inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Margins matching the sample worksheet (compressed)
const MARGIN_TOP = 22; // ~7.8mm
const MARGIN_RIGHT = 14; // ~5mm
const MARGIN_BOTTOM = 14; // ~5mm
const MARGIN_LEFT = 20; // ~7mm

interface WorksheetDocumentProps {
  data: WorksheetPDFData;
}

function WorksheetDocument({ data }: WorksheetDocumentProps) {
  const { school, grade, subject, chapter, questions, worksheetNumber, theme } = data;
  const deco = SUBJECT_DECORATIONS[subject.slug] || DEFAULT_DECORATIONS;

  // Styles for the document
  const styles = StyleSheet.create({
    page: {
      width: A4_WIDTH,
      height: A4_HEIGHT,
      paddingTop: MARGIN_TOP,
      paddingRight: MARGIN_RIGHT,
      paddingBottom: MARGIN_BOTTOM,
      paddingLeft: MARGIN_LEFT,
      fontFamily: theme.fontFamily,
      fontSize: 8.5,
      position: "relative",
    },
    backgroundDecoration: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    decorativeText: {
      position: "absolute",
      fontSize: 40,
      opacity: theme.decorativeOpacity,
      color: theme.primaryColor,
    },
    contentArea: {
      flex: 1,
    },
    continuationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: 4,
      marginBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.primaryColor,
    },
    continuationTitle: {
      fontSize: 9,
      fontWeight: "bold",
      fontFamily: "Helvetica-Bold",
      color: theme.headerColor,
    },
    continuationSubtitle: {
      fontSize: 7,
      color: "#666666",
    },
    pageNumber: {
      position: "absolute",
      bottom: 6,
      right: 14,
      fontSize: 7,
      color: "#999999",
    },
    footer: {
      position: "absolute",
      bottom: 6,
      left: 20,
      right: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerText: {
      fontSize: 6,
      color: "#999999",
    },
    accentBar: {
      height: 4,
      backgroundColor: theme.primaryColor,
      marginBottom: 6,
      borderRadius: 2,
    },
  });

  const BackgroundDecorations = () => {
    const layout = theme.decorationLayout;
    const c1 = theme.primaryColor;
    const c2 = theme.secondaryColor;
    const c3 = theme.accentColor;

    // Color picker based on grade band color mode
    const pickColor = (index: number): string => {
      if (layout.colorMode === "mono") return c1;
      if (layout.colorMode === "duotone") return [c1, c2][index % 2];
      return [c1, c2, c3][index % 3];
    };

    // ── Layer 2: Pattern field calculations ──
    const patternStartY = 95;
    const patternEndY = 810;
    const patternStartX = 35;
    const patternEndX = A4_WIDTH - 35;
    const patternRows = Math.floor((patternEndY - patternStartY) / layout.patternGridSpacing);
    const patternCols = Math.floor((patternEndX - patternStartX) / layout.patternGridSpacing);

    // ── Layer 3: Corner positions as [top, left] ──
    const cs = layout.cornerSize;
    const cornerPositions: [number, number][] = [];
    if (layout.cornerCount >= 4) cornerPositions.push([18, 6]);
    cornerPositions.push([18, A4_WIDTH - 10 - cs]);
    if (layout.cornerCount >= 2) cornerPositions.push([A4_HEIGHT - 24 - cs, 6]);
    if (layout.cornerCount >= 4) cornerPositions.push([A4_HEIGHT - 24 - cs, A4_WIDTH - 10 - cs]);

    // ── Layer 4: Margin accent calculations ──
    const marginStartY = 85;
    const marginEndY = 790;
    const marginSpacing = layout.marginIconCount > 1
      ? (marginEndY - marginStartY) / (layout.marginIconCount - 1)
      : 0;

    return (
      <View style={styles.backgroundDecoration} fixed>
        {/* Layer 1: Tinted wash */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.backgroundColor, opacity: 0.35 }} />

        {/* Layer 2: Geometric pattern field */}
        {Array.from({ length: patternRows }).map((_, r) =>
          Array.from({ length: patternCols }).map((_, c) => {
            const tileIndex = (r + c) % deco.pattern.length;
            return (
              <View
                key={`p${r}-${c}`}
                style={{
                  position: "absolute",
                  top: patternStartY + r * layout.patternGridSpacing,
                  left: patternStartX + c * layout.patternGridSpacing,
                }}
              >
                <SubjectIcon
                  icon={deco.pattern[tileIndex]}
                  size={layout.patternTileSize}
                  color={pickColor(r + c)}
                  opacity={layout.patternOpacity}
                  strokeWidth={layout.strokeWidth * 0.6}
                />
              </View>
            );
          })
        )}

        {/* Layer 3: Corner compositions */}
        {cornerPositions.map(([top, left], i) => {
          const heroIdx = i % deco.hero.length;
          const secondIdx = (i + 1) % deco.hero.length;
          return (
            <React.Fragment key={`c${i}`}>
              <View style={{ position: "absolute", top, left }}>
                <SubjectIcon
                  icon={deco.hero[heroIdx]}
                  size={cs}
                  color={pickColor(i)}
                  opacity={layout.cornerOpacity}
                  strokeWidth={layout.strokeWidth}
                />
              </View>
              <View style={{ position: "absolute", top: top + cs * 0.4, left: left + cs * 0.3 }}>
                <SubjectIcon
                  icon={deco.hero[secondIdx]}
                  size={cs * 0.6}
                  color={pickColor(i + 1)}
                  opacity={layout.cornerOpacity * 0.6}
                  strokeWidth={layout.strokeWidth}
                />
              </View>
            </React.Fragment>
          );
        })}

        {/* Layer 4: Margin accents */}
        {Array.from({ length: layout.marginIconCount }).map((_, i) => {
          const yPos = marginStartY + i * marginSpacing;
          const accentIdx = i % deco.accent.length;
          const isLeft = layout.marginSide === "left" || (layout.marginSide === "both" && i % 2 === 0);
          return (
            <View
              key={`m${i}`}
              style={{
                position: "absolute",
                top: yPos,
                ...(isLeft ? { left: 4 } : { right: 2 }),
              }}
            >
              <SubjectIcon
                icon={deco.accent[accentIdx]}
                size={layout.marginIconSize}
                color={pickColor(i)}
                opacity={layout.marginOpacity}
                strokeWidth={layout.strokeWidth * 0.8}
              />
            </View>
          );
        })}

        {/* Layer 5: Border frame & footer accent */}
        <View style={{ position: "absolute", top: 8, left: 6, right: 6, bottom: 8, borderWidth: 1, borderColor: c1, borderRadius: 8, opacity: 0.15 }} />
        <View style={{ position: "absolute", bottom: 16, left: 20, right: 14, height: 2, backgroundColor: c1, borderRadius: 1, opacity: 0.2 }} />
      </View>
    );
  };

  return (
    <Document
      title={`Worksheet - ${subject.name} - ${chapter.name}`}
      author={school.name}
      subject={`${grade.name} ${subject.name} - ${chapter.name}`}
    >
      {/* Page 1: Full header + questions */}
      <Page size="A4" style={styles.page} wrap>
        <BackgroundDecorations />
        <View style={styles.accentBar} fixed />

        <WorksheetHeader
          school={school}
          grade={grade}
          subject={subject}
          chapter={chapter}
          worksheetNumber={worksheetNumber}
          theme={theme}
        />

        <View style={styles.contentArea}>
          {questions.sections.map((section: QuestionSection) => (
            <QuestionSectionBlock key={section.id} section={section} theme={theme} />
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{school.name} | {grade.name} | {subject.name}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function generateWorksheetPDF(data: WorksheetPDFData): Promise<Buffer> {
  const buffer = await renderToBuffer(<WorksheetDocument data={data} />);
  return Buffer.from(buffer);
}
