import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { createHash } from "node:crypto";

export type PdfRequest = {
  company: { name: string; address: string; telephone: string; fax?: string | null };
  requestNumber: string;
  invoiceNumber?: string | null;
  version: number;
  status: string;
  date: string;
  requester: string;
  payee: string;
  currency: string;
  natureOfPayment: string;
  paymentOtherText?: string | null;
  lines: { projectCode: string; account: string; particulars: string; amount: string }[];
  totalAmount: string;
  requesterAttestation?: { name: string; at: string } | null;
  approverAttestation?: { name: string; at: string; status: string } | null;
  confidential?: boolean;
  generatedAt: string;
};

const PAGE = { width: 612, height: 792, left: 36, right: 576 };
const gray = rgb(0.92, 0.92, 0.92);
const black = rgb(0.08, 0.08, 0.08);

function fit(text: string, font: PDFFont, size: number, width: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function text(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size = 8, options: { maxWidth?: number; bold?: boolean } = {}) {
  const lines = options.maxWidth ? fit(value, font, size, options.maxWidth) : [value];
  lines.forEach((line, i) => page.drawText(line, { x, y: y - i * (size + 2), size, font, color: black }));
  return lines.length;
}

function box(page: PDFPage, x: number, y: number, width: number, height: number, fill?: boolean) {
  page.drawRectangle({ x, y, width, height, borderColor: black, borderWidth: 0.7, color: fill ? gray : undefined });
}

function header(page: PDFPage, data: PdfRequest, regular: PDFFont, bold: PDFFont, pageNo: number, pageCount: number, continuation = false) {
  text(page, "SVI", 38, 750, bold, 24);
  text(page, data.company.name, 100, 758, bold, 11);
  text(page, data.company.address, 100, 744, regular, 7, { maxWidth: 330 });
  text(page, `Tel: ${data.company.telephone}${data.company.fax ? `  Fax: ${data.company.fax}` : ""}`, 100, 720, regular, 7);
  text(page, continuation ? "REQUEST FOR PAYMENT FORM - CONTINUATION" : "REQUEST FOR PAYMENT FORM", 165, 690, bold, 14);
  text(page, `Request: ${data.requestNumber}   Document: ${data.invoiceNumber ?? "Pending"}   Version: ${data.version}`, 38, 672, regular, 7);
  text(page, `Status: ${data.status}   Generated: ${data.generatedAt}`, 355, 672, regular, 7);
  if (data.confidential) text(page, "CONFIDENTIAL", 260, 770, bold, 8);
  text(page, `Page ${pageNo} of ${pageCount}`, 520, 24, regular, 7);
}

function labeled(page: PDFPage, label: string, value: string, x: number, y: number, width: number, regular: PDFFont, bold: PDFFont) {
  box(page, x, y - 22, width, 22);
  text(page, label, x + 4, y - 8, bold, 6);
  text(page, value, x + 82, y - 14, regular, 8, { maxWidth: width - 88 });
}

export async function generateRequestPdf(data: PdfRequest) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const chunks: PdfRequest["lines"][] = [];
  chunks.push(data.lines.slice(0, 10));
  for (let i = 10; i < data.lines.length; i += 14) chunks.push(data.lines.slice(i, i + 14));
  const count = Math.max(1, chunks.length);

  chunks.forEach((lines, pageIndex) => {
    const page = pdf.addPage([PAGE.width, PAGE.height]);
    header(page, data, regular, bold, pageIndex + 1, count, pageIndex > 0);
    let y = 650;
    if (pageIndex === 0) {
      labeled(page, "COMPANY NAME", data.company.name, 36, y, 360, regular, bold);
      labeled(page, "DATE", data.date, 396, y, 180, regular, bold); y -= 22;
      labeled(page, "REQUESTOR", data.requester, 36, y, 360, regular, bold);
      labeled(page, "CURRENCY", data.currency, 396, y, 180, regular, bold); y -= 22;
      labeled(page, "PAYEE", data.payee, 36, y, 540, regular, bold); y -= 30;
    } else {
      text(page, `${data.company.name} | ${data.requester} | ${data.payee} | ${data.date} | ${data.currency}`, 38, y, regular, 8); y -= 18;
    }

    const widths = [95, 105, 270, 70];
    const headings = ["PROJECT CODE", "ACCOUNT", "PARTICULARS", "AMOUNT"];
    let x = 36;
    headings.forEach((heading, i) => { box(page, x, y - 18, widths[i], 18, true); text(page, heading, x + 4, y - 12, bold, 7); x += widths[i]; });
    y -= 18;
    const rowHeight = pageIndex === 0 ? 32 : 34;
    const displayed = pageIndex === 0 ? 10 : Math.max(lines.length, 1);
    for (let i = 0; i < displayed; i++) {
      const line = lines[i]; x = 36;
      widths.forEach((width) => { box(page, x, y - rowHeight, width, rowHeight); x += width; });
      if (line) {
        text(page, line.projectCode, 40, y - 11, regular, 7, { maxWidth: 87 });
        text(page, line.account, 135, y - 11, regular, 7, { maxWidth: 97 });
        text(page, line.particulars, 240, y - 11, regular, 7, { maxWidth: 260 });
        const amountWidth = regular.widthOfTextAtSize(line.amount, 8);
        text(page, line.amount, 572 - amountWidth, y - 11, regular, 8);
      }
      y -= rowHeight;
    }

    if (pageIndex === count - 1) {
      box(page, 36, y - 24, 470, 24, true); box(page, 506, y - 24, 70, 24);
      text(page, "TOTAL AMOUNT", 420, y - 16, bold, 8);
      const total = `${data.currency} ${data.totalAmount}`;
      text(page, total, 510, y - 16, bold, 8, { maxWidth: 62 }); y -= 36;
    } else if (pageIndex === 0) {
      text(page, `Line items continue on page 2 of ${count}`, 390, y - 12, bold, 7);
      y -= 24;
    }
    if (pageIndex === 0) {
      box(page, 36, y - 54, 540, 54);
      text(page, "NATURE OF PAYMENT", 40, y - 12, bold, 8);
      text(page, `Selected: ${data.natureOfPayment}${data.paymentOtherText ? ` - ${data.paymentOtherText}` : ""}`, 40, y - 28, regular, 8, { maxWidth: 525 }); y -= 66;
      box(page, 36, y - 68, 270, 68); box(page, 306, y - 68, 270, 68);
      text(page, "REQUESTOR'S SIGNATURE", 42, y - 14, bold, 7);
      text(page, data.requesterAttestation ? `${data.requesterAttestation.name} | Attested: ${data.requesterAttestation.at}` : "Not attested", 42, y - 34, regular, 8, { maxWidth: 250 });
      text(page, "APPROVER'S SIGNATURE", 312, y - 14, bold, 7);
      text(page, data.approverAttestation ? `${data.approverAttestation.name} - ${data.approverAttestation.status} | Approved: ${data.approverAttestation.at}` : "Pending approval", 312, y - 34, regular, 8, { maxWidth: 250 });
    }
    text(page, `Verification: ${data.requestNumber}-V${data.version}`, 38, 24, regular, 7);
  });
  pdf.setTitle(`Request for Payment ${data.requestNumber}`);
  pdf.setSubject("SVI Internal Accounts Payable Workflow System");
  const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), pageCount: count };
}
