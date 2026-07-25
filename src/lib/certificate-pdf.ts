import { jsPDF } from "jspdf";

// Draws a certificate directly with jsPDF's vector primitives (no server
// round-trip, no headless-browser dependency — Cloudflare Workers can't run
// one) and triggers a download. Landscape A4, gold/navy palette to loosely
// match the brand without requiring custom font embedding.
export function downloadCertificatePdf(params: {
  learnerName: string;
  courseTitle: string;
  certCode: string;
  issuedAt: string;
  centerName?: string | null;
  scorePercent?: number | null;
}) {
  const { learnerName, courseTitle, certCode, issuedAt, centerName, scorePercent } = params;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const navy = [30, 41, 59] as const;
  const gold = [180, 138, 46] as const;
  const muted = [100, 100, 100] as const;

  // Outer + inner border
  doc.setDrawColor(...gold);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  doc.setTextColor(...muted);
  doc.setFontSize(11);
  doc.text("TRAVANCORE AYURVEDA", pageW / 2, 28, { align: "center" });

  doc.setTextColor(...gold);
  doc.setFontSize(13);
  doc.text("CERTIFICATE OF COMPLETION", pageW / 2, 40, { align: "center" });

  doc.setTextColor(...muted);
  doc.setFontSize(12);
  doc.text("This certifies that", pageW / 2, 58, { align: "center" });

  doc.setTextColor(...navy);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(30);
  doc.text(learnerName, pageW / 2, 72, { align: "center" });
  doc.setFont("helvetica", "normal");

  doc.setTextColor(...muted);
  doc.setFontSize(12);
  doc.text("has successfully completed the training program", pageW / 2, 86, { align: "center" });

  doc.setTextColor(...navy);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const titleMaxWidth = pageW - 60;
  const titleLines = doc.splitTextToSize(courseTitle, titleMaxWidth) as string[];
  doc.text(titleLines, pageW / 2, 98, { align: "center", maxWidth: titleMaxWidth });
  doc.setFont("helvetica", "normal");

  // Long titles wrap onto extra lines (splitTextToSize above) — push the
  // score line down to clear them instead of always sitting a fixed 10mm
  // below the title's first line, which overlapped on wrapped titles.
  const titleLineHeight = 7;
  const scoreY = 98 + Math.max(1, titleLines.length) * titleLineHeight;

  if (scorePercent != null) {
    doc.setTextColor(...muted);
    doc.setFontSize(11);
    doc.text(`Score: ${scorePercent}%`, pageW / 2, scoreY, { align: "center" });
  }

  const bottomY = pageH - 24;
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(`Issued: ${new Date(issuedAt).toLocaleDateString()}`, 24, bottomY);
  if (centerName) doc.text(centerName, 24, bottomY + 6);

  doc.text(`Certificate code: ${certCode}`, pageW - 24, bottomY, { align: "right" });
  doc.text("Verify at travancoreayurvedalearning.com/verify", pageW - 24, bottomY + 6, {
    align: "right",
  });

  doc.save(`Certificate-${certCode}.pdf`);
}
