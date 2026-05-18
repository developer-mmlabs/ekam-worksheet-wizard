import React from "react";
import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { QuestionSection, Question, CaseStudy, TemplateTheme } from "@/types";
import { SvgDiagramBlock } from "./svg-diagram";
import { PDF_FONT } from "../fonts";

interface SectionProps {
  section: QuestionSection;
  theme: TemplateTheme;
}

export function QuestionSectionBlock({ section, theme }: SectionProps) {
  const styles = createStyles(theme);

  // Defensive: skip sections that have no content (e.g. when the LLM
  // honoured a count=0 instruction by emitting an empty array).
  const hasQuestions = (section.questions?.length ?? 0) > 0;
  const hasCaseStudies = (section.caseStudies?.length ?? 0) > 0;
  if (!hasQuestions && !hasCaseStudies) {
    return null;
  }

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader} wrap={false}>
        <Text style={styles.sectionTitle}>
          {section.id}: {section.title}
        </Text>
        {section.questions?.[0]?.marks && (
          <Text style={styles.marksLabel}>[{section.questions[0].marks} marks each]</Text>
        )}
      </View>

      {section.instructions && (
        <Text style={styles.instructions}>{section.instructions}</Text>
      )}

      {section.type === "case_study" && section.caseStudies
        ? section.caseStudies.map((cs) => (
            <CaseStudyBlock key={cs.number} caseStudy={cs} styles={styles} />
          ))
        : section.questions?.map((question) => (
            <QuestionBlock
              key={question.number}
              question={question}
              isAssertionReason={section.type === "assertion_reason"}
              styles={styles}
            />
          ))}
    </View>
  );
}

function CaseStudyBlock({ caseStudy, styles }: { caseStudy: CaseStudy; styles: Styles }) {
  // Priority: SVG diagram (math-exact) > AI-generated image > text-only
  const hasSvg = Boolean(caseStudy.imageSvg?.shapes?.length);
  const hasImage = !hasSvg && Boolean(caseStudy.imageUrl);
  const hasVisual = hasSvg || hasImage;

  return (
    <View style={styles.caseStudyBlock} wrap={false}>
      <Text style={styles.caseStudyLabel}>Case Study {caseStudy.number}</Text>
      {hasVisual ? (
        <View style={styles.caseStudyImageRow}>
          <View style={styles.caseStudyTextCol}>
            <Text style={styles.caseStudyStimulus}>{caseStudy.stimulus}</Text>
          </View>
          {hasSvg ? (
            <View style={styles.caseStudyImage}>
              <SvgDiagramBlock diagram={caseStudy.imageSvg!} width={110} height={110} />
            </View>
          ) : (
            <Image src={caseStudy.imageUrl!} style={styles.caseStudyImage} />
          )}
        </View>
      ) : (
        <Text style={styles.caseStudyStimulus}>{caseStudy.stimulus}</Text>
      )}
      {caseStudy.questions.map((q) => (
        <QuestionBlock
          key={q.number}
          question={q}
          isAssertionReason={false}
          styles={styles}
        />
      ))}
    </View>
  );
}

function QuestionBlock({
  question,
  isAssertionReason,
  styles,
}: {
  question: Question;
  isAssertionReason: boolean;
  styles: Styles;
}) {
  const hasLongOptions = question.options?.some((opt) => opt.text.length > 25) ?? false;

  return (
    <View style={styles.questionBlock} wrap={false}>
      <View style={styles.questionRow}>
        <Text style={styles.questionNumber}>{question.number}.</Text>
        <View style={styles.questionContent}>
          {isAssertionReason && question.assertion ? (
            <>
              <Text style={styles.questionText}>
                <Text style={styles.arLabel}>Assertion (A): </Text>
                {question.assertion}
              </Text>
              <Text style={styles.questionText}>
                <Text style={styles.arLabel}>Reason (R): </Text>
                {question.reason}
              </Text>
            </>
          ) : (
            <Text style={styles.questionText}>{question.text}</Text>
          )}

          {question.options && question.options.length > 0 && (
            <View style={styles.optionsGrid}>
              {question.options.map((opt) => (
                <Text
                  key={opt.label}
                  style={hasLongOptions || opt.text.length > 25 ? styles.optionWide : styles.option}
                >
                  {opt.label}) {opt.text}
                </Text>
              ))}
            </View>
          )}

          {question.matchPairs && question.matchPairs.length > 0 && (
            <View style={styles.matchTable}>
              <View style={styles.matchHeaderRow}>
                <Text style={styles.matchColumnHeader}>Column A</Text>
                <Text style={styles.matchColumnHeader}>Column B</Text>
              </View>
              {question.matchPairs.map((pair, idx) => (
                <View key={idx} style={styles.matchRow}>
                  <Text style={styles.matchCell}>{idx + 1}. {pair.left}</Text>
                  <Text style={styles.matchCell}>{String.fromCharCode(97 + idx)}) {pair.right}</Text>
                </View>
              ))}
            </View>
          )}

          {question.subparts && question.subparts.length > 0 && (
            <View style={styles.subparts}>
              {question.subparts.map((part, idx) => (
                <Text key={idx} style={styles.subpart}>
                  {String.fromCharCode(97 + idx)}) {part}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function createStyles(theme: TemplateTheme) {
  return StyleSheet.create({
    sectionContainer: {
      marginBottom: 6,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.backgroundColor,
      paddingHorizontal: 6,
      paddingVertical: 3,
      marginBottom: 3,
      borderLeftWidth: 3,
      borderLeftColor: theme.primaryColor,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "bold",
      fontFamily: PDF_FONT,
      color: theme.sectionHeaderColor,
    },
    marksLabel: {
      fontSize: 7,
      color: "#666666",
      fontStyle: "italic",
    },
    instructions: {
      fontSize: 8,
      fontStyle: "italic",
      color: "#444444",
      paddingHorizontal: 4,
      paddingBottom: 3,
      lineHeight: 1.3,
    },
    questionBlock: {
      marginBottom: 3,
      paddingLeft: 4,
    },
    questionRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    questionNumber: {
      width: 26,
      fontSize: 8.5,
      fontWeight: "bold",
      fontFamily: PDF_FONT,
      textAlign: "right",
      paddingRight: 4,
      paddingTop: 1,
    },
    questionContent: {
      flex: 1,
    },
    questionText: {
      fontSize: 8.5,
      lineHeight: 1.3,
      fontFamily: PDF_FONT,
    },
    arLabel: {
      fontFamily: PDF_FONT,
      fontWeight: "bold",
    },
    caseStudyBlock: {
      marginBottom: 5,
      paddingLeft: 4,
      paddingTop: 2,
      borderLeftWidth: 1,
      borderLeftColor: theme.accentColor,
      paddingHorizontal: 6,
    },
    caseStudyLabel: {
      fontSize: 9,
      fontFamily: PDF_FONT,
      fontWeight: "bold",
      color: theme.sectionHeaderColor,
      marginBottom: 2,
    },
    caseStudyStimulus: {
      fontSize: 8.5,
      fontStyle: "italic",
      lineHeight: 1.35,
      fontFamily: PDF_FONT,
      paddingBottom: 3,
    },
    caseStudyImageRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      paddingBottom: 3,
    },
    caseStudyTextCol: {
      flex: 1,
    },
    caseStudyImage: {
      width: 110,
      height: 110,
      objectFit: "cover",
      borderRadius: 3,
    },
    optionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 1,
      marginBottom: 1,
      paddingLeft: 4,
    },
    option: {
      width: "25%",
      fontSize: 8,
      lineHeight: 1.3,
      fontFamily: PDF_FONT,
      paddingRight: 4,
    },
    optionWide: {
      width: "50%",
      fontSize: 8,
      lineHeight: 1.3,
      fontFamily: PDF_FONT,
      paddingRight: 4,
    },
    matchTable: {
      marginTop: 2,
      marginBottom: 1,
      paddingLeft: 4,
      borderWidth: 0.5,
      borderColor: "#cccccc",
    },
    matchHeaderRow: {
      flexDirection: "row",
      backgroundColor: theme.backgroundColor,
      borderBottomWidth: 0.5,
      borderBottomColor: "#cccccc",
    },
    matchColumnHeader: {
      width: "50%",
      fontSize: 7.5,
      fontFamily: PDF_FONT,
      fontWeight: "bold",
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    matchRow: {
      flexDirection: "row",
      borderBottomWidth: 0.5,
      borderBottomColor: "#eeeeee",
    },
    matchCell: {
      width: "50%",
      fontSize: 8,
      lineHeight: 1.3,
      fontFamily: PDF_FONT,
      paddingHorizontal: 4,
      paddingVertical: 1.5,
    },
    subparts: {
      marginTop: 1,
      paddingLeft: 8,
    },
    subpart: {
      fontSize: 8.5,
      lineHeight: 1.3,
      fontFamily: PDF_FONT,
    },
  });
}
