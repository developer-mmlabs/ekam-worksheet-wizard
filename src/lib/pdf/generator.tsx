import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { WorksheetPDFData, QuestionSection } from "@/types";
import { WorksheetHeader } from "./components/header";
import { QuestionSectionBlock } from "./components/section";
import { SubjectIcon, SUBJECT_ICONS, SUBJECT_BG_SHAPES, DEFAULT_ICONS } from "./decorations";
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
  const icons = SUBJECT_ICONS[subject.slug] || DEFAULT_ICONS;
  const bgShapes = SUBJECT_BG_SHAPES[subject.slug] || SUBJECT_BG_SHAPES.science;

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
    const c1 = theme.primaryColor;
    const c2 = theme.secondaryColor;
    const c3 = theme.accentColor;

    return (
      <View style={styles.backgroundDecoration} fixed>
        {/* Full page tinted wash */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.backgroundColor, opacity: 0.35 }} />

        {/* Page border frame */}
        <View style={{ position: "absolute", top: 8, left: 6, right: 6, bottom: 8, borderWidth: 1, borderColor: c1, borderRadius: 10, opacity: 0.2 }} />

        {/* Large background bubbles — spread across ENTIRE page */}
        <View style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: c1, opacity: 0.08 }} />
        <View style={{ position: "absolute", top: 60, left: -40, width: 130, height: 130, borderRadius: 65, backgroundColor: c2, opacity: 0.07 }} />
        <View style={{ position: "absolute", top: 180, right: 80, width: 110, height: 110, borderRadius: 55, backgroundColor: c3, opacity: 0.06 }} />
        <View style={{ position: "absolute", top: 320, left: 120, width: 120, height: 120, borderRadius: 60, backgroundColor: c1, opacity: 0.06 }} />
        <View style={{ position: "absolute", top: 480, right: -25, width: 150, height: 150, borderRadius: 75, backgroundColor: c2, opacity: 0.07 }} />
        <View style={{ position: "absolute", top: 600, left: 200, width: 100, height: 100, borderRadius: 50, backgroundColor: c3, opacity: 0.06 }} />
        <View style={{ position: "absolute", top: 720, left: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: c1, opacity: 0.07 }} />
        <View style={{ position: "absolute", bottom: -35, right: 120, width: 130, height: 130, borderRadius: 65, backgroundColor: c2, opacity: 0.06 }} />
        <View style={{ position: "absolute", top: 250, left: 350, width: 90, height: 90, borderRadius: 45, backgroundColor: c3, opacity: 0.05 }} />
        <View style={{ position: "absolute", top: 450, left: 50, width: 100, height: 100, borderRadius: 50, backgroundColor: c2, opacity: 0.06 }} />

        {/* Medium circles scattered throughout content area */}
        <View style={{ position: "absolute", top: 100, left: 220, width: 55, height: 55, borderRadius: 28, backgroundColor: c1, opacity: 0.07 }} />
        <View style={{ position: "absolute", top: 230, right: 160, width: 45, height: 45, borderRadius: 23, backgroundColor: c3, opacity: 0.08 }} />
        <View style={{ position: "absolute", top: 380, left: 310, width: 50, height: 50, borderRadius: 25, backgroundColor: c2, opacity: 0.07 }} />
        <View style={{ position: "absolute", top: 530, right: 220, width: 40, height: 40, borderRadius: 20, backgroundColor: c1, opacity: 0.08 }} />
        <View style={{ position: "absolute", top: 680, left: 170, width: 48, height: 48, borderRadius: 24, backgroundColor: c3, opacity: 0.07 }} />
        <View style={{ position: "absolute", top: 150, right: 50, width: 35, height: 35, borderRadius: 18, backgroundColor: c2, opacity: 0.08 }} />
        <View style={{ position: "absolute", top: 500, left: 400, width: 42, height: 42, borderRadius: 21, backgroundColor: c1, opacity: 0.07 }} />
        <View style={{ position: "absolute", top: 770, right: 80, width: 38, height: 38, borderRadius: 19, backgroundColor: c3, opacity: 0.07 }} />

        {/* Ring outlines — edges AND interior */}
        <View style={{ position: "absolute", top: 180, left: -8, width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: c2, opacity: 0.2 }} />
        <View style={{ position: "absolute", top: 430, right: -5, width: 35, height: 35, borderRadius: 18, borderWidth: 1.5, borderColor: c1, opacity: 0.2 }} />
        <View style={{ position: "absolute", top: 620, left: -5, width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: c3, opacity: 0.2 }} />
        <View style={{ position: "absolute", top: 90, right: -6, width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: c2, opacity: 0.18 }} />
        <View style={{ position: "absolute", top: 280, left: 260, width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: c1, opacity: 0.14 }} />
        <View style={{ position: "absolute", top: 560, right: 190, width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c3, opacity: 0.14 }} />
        <View style={{ position: "absolute", top: 700, left: 380, width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: c2, opacity: 0.13 }} />
        <View style={{ position: "absolute", top: 400, left: 160, width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: c1, opacity: 0.13 }} />

        {/* Small scattered dots — all over the page */}
        <View style={{ position: "absolute", top: 115, right: 45, width: 14, height: 14, borderRadius: 7, backgroundColor: c3, opacity: 0.13 }} />
        <View style={{ position: "absolute", top: 240, left: 55, width: 12, height: 12, borderRadius: 6, backgroundColor: c1, opacity: 0.12 }} />
        <View style={{ position: "absolute", top: 360, right: 65, width: 16, height: 16, borderRadius: 8, backgroundColor: c2, opacity: 0.12 }} />
        <View style={{ position: "absolute", top: 490, left: 45, width: 10, height: 10, borderRadius: 5, backgroundColor: c3, opacity: 0.13 }} />
        <View style={{ position: "absolute", top: 620, right: 55, width: 13, height: 13, borderRadius: 7, backgroundColor: c1, opacity: 0.12 }} />
        <View style={{ position: "absolute", top: 190, left: 350, width: 10, height: 10, borderRadius: 5, backgroundColor: c1, opacity: 0.12 }} />
        <View style={{ position: "absolute", top: 430, right: 260, width: 12, height: 12, borderRadius: 6, backgroundColor: c2, opacity: 0.11 }} />
        <View style={{ position: "absolute", top: 740, left: 290, width: 11, height: 11, borderRadius: 6, backgroundColor: c3, opacity: 0.11 }} />
        <View style={{ position: "absolute", top: 310, left: 180, width: 9, height: 9, borderRadius: 5, backgroundColor: c2, opacity: 0.11 }} />
        <View style={{ position: "absolute", top: 570, right: 140, width: 11, height: 11, borderRadius: 6, backgroundColor: c3, opacity: 0.11 }} />
        <View style={{ position: "absolute", top: 160, left: 450, width: 8, height: 8, borderRadius: 4, backgroundColor: c1, opacity: 0.10 }} />
        <View style={{ position: "absolute", top: 650, left: 420, width: 9, height: 9, borderRadius: 5, backgroundColor: c2, opacity: 0.10 }} />

        {/* Horizontal decorative bands across content */}
        <View style={{ position: "absolute", top: 170, left: 30, right: 30, height: 1, backgroundColor: c1, opacity: 0.1, borderRadius: 1 }} />
        <View style={{ position: "absolute", top: 390, left: 50, right: 50, height: 1, backgroundColor: c2, opacity: 0.09, borderRadius: 1 }} />
        <View style={{ position: "absolute", top: 610, left: 40, right: 40, height: 1, backgroundColor: c3, opacity: 0.1, borderRadius: 1 }} />

        {/* Left margin colored dots */}
        {Array.from({ length: 14 }).map((_, i) => (
          <View
            key={`ld${i}`}
            style={{
              position: "absolute",
              left: 5,
              top: 55 + i * 56,
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: [c1, c2, c3][i % 3],
              opacity: 0.35,
            }}
          />
        ))}

        {/* Right margin colored dots */}
        {Array.from({ length: 14 }).map((_, i) => (
          <View
            key={`rd${i}`}
            style={{
              position: "absolute",
              right: 3,
              top: 75 + i * 56,
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: [c3, c1, c2][i % 3],
              opacity: 0.35,
            }}
          />
        ))}

        {/* Subject-themed SVG icons — margins */}
        <View style={{ position: "absolute", top: 120, right: 2 }}>
          <SubjectIcon icon={icons[0]} size={42} color={c1} opacity={0.14} />
        </View>
        <View style={{ position: "absolute", top: 260, left: -2 }}>
          <SubjectIcon icon={icons[1]} size={36} color={c2} opacity={0.14} />
        </View>
        <View style={{ position: "absolute", top: 400, right: 0 }}>
          <SubjectIcon icon={icons[2]} size={38} color={c3} opacity={0.14} />
        </View>
        <View style={{ position: "absolute", top: 520, left: 0 }}>
          <SubjectIcon icon={icons[3]} size={34} color={c1} opacity={0.14} />
        </View>
        <View style={{ position: "absolute", top: 650, right: -1 }}>
          <SubjectIcon icon={icons[4]} size={40} color={c2} opacity={0.14} />
        </View>
        <View style={{ position: "absolute", top: 770, left: -2 }}>
          <SubjectIcon icon={icons[5]} size={36} color={c3} opacity={0.14} />
        </View>

        {/* Subject-themed SVG icons — interior scattered */}
        <View style={{ position: "absolute", top: 60, left: 160 }}>
          <SubjectIcon icon={icons[0]} size={28} color={c1} opacity={0.09} />
        </View>
        <View style={{ position: "absolute", top: 180, right: 100 }}>
          <SubjectIcon icon={icons[2]} size={24} color={c2} opacity={0.08} />
        </View>
        <View style={{ position: "absolute", top: 310, left: 80 }}>
          <SubjectIcon icon={icons[4]} size={22} color={c3} opacity={0.08} />
        </View>
        <View style={{ position: "absolute", top: 440, right: 180 }}>
          <SubjectIcon icon={icons[1]} size={26} color={c1} opacity={0.08} />
        </View>
        <View style={{ position: "absolute", top: 560, left: 240 }}>
          <SubjectIcon icon={icons[3]} size={24} color={c2} opacity={0.07} />
        </View>
        <View style={{ position: "absolute", top: 680, right: 120 }}>
          <SubjectIcon icon={icons[5]} size={22} color={c3} opacity={0.08} />
        </View>
        <View style={{ position: "absolute", top: 350, left: 380 }}>
          <SubjectIcon icon={icons[0]} size={20} color={c1} opacity={0.07} />
        </View>
        <View style={{ position: "absolute", top: 750, left: 300 }}>
          <SubjectIcon icon={icons[2]} size={20} color={c2} opacity={0.07} />
        </View>

        {/* Subject-specific background shapes (large watermarks) */}
        <View style={{ position: "absolute", top: 100, left: 300 }}>
          <SubjectIcon icon={bgShapes[0]} size={100} color={c1} opacity={0.05} />
        </View>
        <View style={{ position: "absolute", top: 350, left: 40 }}>
          <SubjectIcon icon={bgShapes[0]} size={80} color={c2} opacity={0.04} />
        </View>
        <View style={{ position: "absolute", top: 600, right: 60 }}>
          <SubjectIcon icon={bgShapes[1 % bgShapes.length]} size={90} color={c3} opacity={0.05} />
        </View>
        <View style={{ position: "absolute", top: 200, left: 100 }}>
          <SubjectIcon icon={bgShapes[1 % bgShapes.length]} size={70} color={c1} opacity={0.04} />
        </View>
        <View style={{ position: "absolute", top: 500, right: 200 }}>
          <SubjectIcon icon={bgShapes[0]} size={85} color={c3} opacity={0.04} />
        </View>
        <View style={{ position: "absolute", top: 720, left: 200 }}>
          <SubjectIcon icon={bgShapes[1 % bgShapes.length]} size={75} color={c2} opacity={0.05} />
        </View>

        {/* Bottom accent line above footer */}
        <View style={{ position: "absolute", bottom: 16, left: 20, right: 14, height: 2, backgroundColor: c1, borderRadius: 1, opacity: 0.25 }} />
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
