import React from "react";
import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { School, Grade, Subject, Chapter, TemplateTheme } from "@/types";
import { PDF_FONT } from "../fonts";
import * as path from "path";
import * as fs from "fs";

// CBSE logo — read once and cache as base64 data URI for @react-pdf/renderer
let cbseLogoDataUri: string | null = null;
function getCbseLogoUri(): string | null {
  if (cbseLogoDataUri !== null) return cbseLogoDataUri;
  try {
    const logoPath = path.resolve(process.cwd(), "public/cbse.png");
    const buffer = fs.readFileSync(logoPath);
    cbseLogoDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    cbseLogoDataUri = "";
  }
  return cbseLogoDataUri || null;
}

interface HeaderProps {
  school: School;
  grade: Grade;
  subject: Subject;
  chapter: Chapter;
  worksheetNumber: number;
  theme: TemplateTheme;
}

export function WorksheetHeader({ school, grade, subject, chapter, worksheetNumber, theme }: HeaderProps) {
  const styles = createStyles(theme);
  const cbseLogo = getCbseLogoUri();

  return (
    <View style={styles.headerContainer}>
      {/* Top row: School Logo - School Name - CBSE Logo */}
      <View style={styles.topRow}>
        <View style={styles.logoCell}>
          {school.logo_url ? (
            <Image src={school.logo_url} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>{school.name.charAt(0)}</Text>
            </View>
          )}
        </View>
        <View style={styles.titleCell}>
          <Text style={styles.schoolName}>{school.name}</Text>
          {school.location && <Text style={styles.schoolLocation}>{school.location}</Text>}
          <Text style={styles.academicYear}>({school.academic_year})</Text>
          <Text style={styles.worksheetTitle}>WORKSHEET-{worksheetNumber}</Text>
        </View>
        <View style={styles.logoCell}>
          {cbseLogo ? (
            <Image src={cbseLogo} style={styles.logo} />
          ) : school.logo_url ? (
            <Image src={school.logo_url} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>CBSE</Text>
            </View>
          )}
        </View>
      </View>

      {/* Info row: Subject - Chapter - Grade */}
      <View style={styles.infoRow}>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>SUBJECT: {subject.name.toUpperCase()}</Text>
        </View>
        <View style={styles.infoCellWide}>
          <Text style={styles.infoLabel}>
            C-{chapter.number}, {chapter.name.toUpperCase()}
          </Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>GRADE: {grade.number}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: TemplateTheme) {
  return StyleSheet.create({
    headerContainer: {
      borderWidth: 1,
      borderColor: "#000000",
      marginBottom: 6,
    },
    topRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#000000",
      minHeight: 60,
      alignItems: "center",
    },
    logoCell: {
      width: 70,
      alignItems: "center",
      justifyContent: "center",
      padding: 4,
    },
    logo: {
      width: 50,
      height: 56,
      objectFit: "contain",
    },
    logoPlaceholder: {
      width: 50,
      height: 50,
      backgroundColor: theme.backgroundColor,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.primaryColor,
    },
    titleCell: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 4,
    },
    schoolName: {
      fontSize: 18,
      fontWeight: "bold",
      fontFamily: PDF_FONT,
      textAlign: "center",
    },
    schoolLocation: {
      fontSize: 12,
      fontWeight: "bold",
      fontFamily: PDF_FONT,
      textAlign: "center",
    },
    academicYear: {
      fontSize: 9,
      fontWeight: "bold",
      fontFamily: PDF_FONT,
      textAlign: "center",
    },
    worksheetTitle: {
      fontSize: 12,
      fontWeight: "bold",
      fontFamily: PDF_FONT,
      textAlign: "center",
      color: theme.headerColor,
    },
    infoRow: {
      flexDirection: "row",
      minHeight: 22,
      alignItems: "center",
    },
    infoCell: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRightWidth: 1,
      borderRightColor: "#000000",
      paddingHorizontal: 4,
    },
    infoCellWide: {
      flex: 2,
      alignItems: "center",
      justifyContent: "center",
      borderRightWidth: 1,
      borderRightColor: "#000000",
      paddingHorizontal: 4,
    },
    infoLabel: {
      fontSize: 9,
      fontWeight: "bold",
      fontFamily: PDF_FONT,
      textAlign: "center",
    },
  });
}
