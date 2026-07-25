// Shared Excel/PDF export for admin report tables. xlsx (SheetJS) for
// spreadsheets, jsPDF + jspdf-autotable for a printable PDF table — both
// free/open-source, both run entirely client-side (no server round-trip).
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportColumn = { key: string; label: string };

export function exportReportToExcel(
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
  filename: string,
) {
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((c) => [c.label, row[c.key] ?? ""])),
  );
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Report");
  XLSX.writeFile(book, `${filename}.xlsx`);
}

export function exportReportToPdf(
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
  title: string,
  filename: string,
) {
  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 21);
  autoTable(doc, {
    startY: 26,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ""))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });
  doc.save(`${filename}.pdf`);
}
