// Server-side certificate PDF generation: renders the same layout as the
// client-side generator (certificate-pdf.ts) plus a scannable QR code, then
// stores the result in the private "certificates" Storage bucket at
// `${certCode}.pdf`. Runs once at issuance (fire-and-forget from
// submitQuizAttempt) and is re-run lazily by getCertificateDownloadUrl for
// any certificate issued before this existed.
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { getSiteOrigin } from "@/lib/site-origin";

type SupabaseAdmin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

async function buildPdfBytes(params: {
  learnerName: string;
  courseTitle: string;
  certCode: string;
  issuedAt: string;
  centerName?: string | null;
  scorePercent?: number | null;
  verifyUrl: string;
}): Promise<ArrayBuffer> {
  const { learnerName, courseTitle, certCode, issuedAt, centerName, scorePercent, verifyUrl } =
    params;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const navy = [30, 41, 59] as const;
  const gold = [180, 138, 46] as const;
  const muted = [100, 100, 100] as const;

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

  doc.text(`Certificate code: ${certCode}`, pageW - 24, bottomY - 22, { align: "right" });

  // Scannable QR code — encodes the same public verification URL as the
  // "Verify at ..." text link, so a phone camera lands straight on the
  // /verify/:code page without anyone typing the code by hand.
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });
  const qrSize = 22;
  doc.addImage(qrDataUrl, "PNG", pageW - 24 - qrSize, bottomY - 20, qrSize, qrSize);

  return doc.output("arraybuffer");
}

export async function generateCertificatePdf(
  supabaseAdmin: SupabaseAdmin,
  certCode: string,
): Promise<void> {
  const { data: cert } = await supabaseAdmin
    .from("certificates")
    .select("cert_code,issued_at,score_percent,user_id,courses(title)")
    .eq("cert_code", certCode)
    .maybeSingle();
  if (!cert) throw new Error("Certificate not found");

  const { data: employee } = await supabaseAdmin
    .from("employees")
    .select("full_name,centers(name)")
    .eq("id", cert.user_id)
    .maybeSingle();

  const bytes = await buildPdfBytes({
    learnerName: employee?.full_name ?? "Certificate Holder",
    courseTitle: (cert.courses as { title?: string } | null)?.title ?? "Course",
    certCode: cert.cert_code,
    issuedAt: cert.issued_at,
    centerName: (employee as { centers?: { name: string } | null } | null)?.centers?.name,
    scorePercent: cert.score_percent,
    verifyUrl: `${getSiteOrigin()}/verify/${cert.cert_code}`,
  });

  const { error } = await supabaseAdmin.storage
    .from("certificates")
    .upload(`${certCode}.pdf`, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(error.message);
}
