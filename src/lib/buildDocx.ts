import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import fileSaver from "file-saver";
const { saveAs } = fileSaver;

const SECTION_HEADERS = new Set([
  "SUMMARY",
  "SKILLS",
  "EXPERIENCE",
  "WORK EXPERIENCE",
  "PROFESSIONAL EXPERIENCE",
  "PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS",
]);

function isSectionHeader(line: string) {
  const trimmed = line.trim().replace(/[:#]+$/g, "").toUpperCase();
  return SECTION_HEADERS.has(trimmed) || /^[A-Z][A-Z\s&/]{3,}$/.test(line.trim()) === false
    ? SECTION_HEADERS.has(trimmed)
    : true;
}

export async function downloadResumeDocx(resumeText: string, filename = "tailored-resume.docx") {
  const lines = resumeText.replace(/\r/g, "").split("\n");
  const children: Paragraph[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      children.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }

    const stripped = line.replace(/^#+\s*/, "");
    if (isSectionHeader(stripped)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: stripped.toUpperCase(), bold: true })],
        }),
      );
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun(line.replace(/^[-*•]\s+/, ""))],
        }),
      );
      continue;
    }

    // Bold lines that look like a name (first non-empty line) or job header (contains | or " - ")
    const looksLikeJobHeader = /\s[-|–]\s/.test(line) && line.length < 140;
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: line, bold: looksLikeJobHeader })],
      }),
    );
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children:
          children.length > 0
            ? children
            : [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun("")] })],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
