import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { QuestionSection, TemplateTheme } from "@/types";

interface SectionProps {
  section: QuestionSection;
  theme: TemplateTheme;
}


export function QuestionSectionBlock({ section, theme }: SectionProps) {
  const styles = createStyles(theme);

  // Determine if MCQ options are short enough for 4-column layout
  const hasLongOptions = section.questions.some(
    (q) => q.options?.some((opt) => opt.text.length > 25)
  );

  return (
    <View style={styles.sectionContainer}>
      {/* Section header - keep with at least first question */}
      <View style={styles.sectionHeader} wrap={false}>
        <Text style={styles.sectionTitle}>
          {section.id}: {section.title}
        </Text>
        {section.questions[0]?.marks && (
          <Text style={styles.marksLabel}>[{section.questions[0].marks} marks each]</Text>
        )}
      </View>

      {/* Questions */}
      {section.questions.map((question) => (
        <View key={question.number} style={styles.questionBlock} wrap={false}>
          <View style={styles.questionRow}>
            <Text style={styles.questionNumber}>{question.number}.</Text>
            <View style={styles.questionContent}>
              <Text style={styles.questionText}>{question.text}</Text>

              {/* MCQ options - adaptive layout */}
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

              {/* Sub-parts */}
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
      ))}
    </View>
  );
}

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
      fontFamily: "Helvetica-Bold",
      color: theme.sectionHeaderColor,
    },
    marksLabel: {
      fontSize: 7,
      color: "#666666",
      fontStyle: "italic",
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
      width: 18,
      fontSize: 8.5,
      fontWeight: "bold",
      fontFamily: "Helvetica-Bold",
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
      fontFamily: "Helvetica",
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
      fontFamily: "Helvetica",
      paddingRight: 4,
    },
    optionWide: {
      width: "50%",
      fontSize: 8,
      lineHeight: 1.3,
      fontFamily: "Helvetica",
      paddingRight: 4,
    },
    subparts: {
      marginTop: 1,
      paddingLeft: 8,
    },
    subpart: {
      fontSize: 8.5,
      lineHeight: 1.3,
      fontFamily: "Helvetica",
    },
  });
}
