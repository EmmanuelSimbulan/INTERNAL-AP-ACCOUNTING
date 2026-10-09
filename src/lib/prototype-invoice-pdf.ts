import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { generateInvoiceNumber } from "@/lib/company-numbering";

export type InvoiceLine = {
  project: string;
  account: string;
  particulars: string;
  amount: string;
};

export type InvoiceRequest = {
  id: string;
  number: string;
  requester: string;
  payee: string;
  company: string;
  date: string;
  currency: string;
  fxRate?: string;
  fxRateDate?: string;
  fxRateSource?: string;
  nature: string;
  other: string;
  status: string;
  invoiceNumber?: string;
  lines: InvoiceLine[];
  documents?: Array<{
    name: string;
    type: string;
    dataUrl?: string;
  }>;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 44;
const ink = rgb(0.11, 0.11, 0.12);
const secondary = rgb(0.42, 0.42, 0.45);
const line = rgb(0.87, 0.87, 0.89);
const blue = rgb(0, 0.44, 0.89);
const softBlue = rgb(0.93, 0.96, 1);
const softGray = rgb(0.965, 0.965, 0.975);

function safe(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E]/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth)
      current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function money(value: string, currency: string) {
  const amount = Number(value) || 0;
  return `${currency} ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function invoiceNumber(request: InvoiceRequest) {
  return (
    request.invoiceNumber ??
    generateInvoiceNumber(request.company, request.date, request.number)
  );
}

function drawHeader(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  request: InvoiceRequest,
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 122,
    width: PAGE_WIDTH,
    height: 122,
    color: ink,
  });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 82,
    width: 34,
    height: 34,
    color: rgb(1, 1, 1),
  });
  page.drawText("S", {
    x: MARGIN + 12,
    y: PAGE_HEIGHT - 71,
    size: 14,
    font: bold,
    color: ink,
  });
  page.drawText("SVI TECHNOLOGIES INC.", {
    x: MARGIN + 46,
    y: PAGE_HEIGHT - 57,
    size: 11,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Internal Accounts Payable", {
    x: MARGIN + 46,
    y: PAGE_HEIGHT - 72,
    size: 8.5,
    font: regular,
    color: rgb(0.72, 0.72, 0.75),
  });
  page.drawText("INTERNAL INVOICE", {
    x: 385,
    y: PAGE_HEIGHT - 58,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(invoiceNumber(request), {
    x: 385,
    y: PAGE_HEIGHT - 76,
    size: 8.5,
    font: regular,
    color: rgb(0.72, 0.72, 0.75),
  });
}

function labelValue(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  page.drawText(label, { x, y, size: 7, font: bold, color: secondary });
  const valueLines = wrap(value, regular, 10, width).slice(0, 2);
  valueLines.forEach((part, index) =>
    page.drawText(part, {
      x,
      y: y - 15 - index * 12,
      size: 10,
      font: regular,
      color: ink,
    }),
  );
}

function drawColumnHeaders(page: PDFPage, bold: PDFFont, y: number) {
  page.drawRectangle({
    x: MARGIN,
    y: y - 24,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 28,
    color: softGray,
  });
  const columns = [
    ["PROJECT", MARGIN + 10],
    ["ACCOUNT", MARGIN + 91],
    ["PARTICULARS", MARGIN + 184],
    ["AMOUNT", PAGE_WIDTH - MARGIN - 68],
  ] as const;
  columns.forEach(([text, x]) =>
    page.drawText(text, {
      x,
      y: y - 13,
      size: 7,
      font: bold,
      color: secondary,
    }),
  );
  return y - 24;
}

function dataUrlBytes(dataUrl: string) {
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("Invalid attachment data");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function drawAttachmentSheet(
  pdf: PDFDocument,
  regular: PDFFont,
  bold: PDFFont,
  request: InvoiceRequest,
  document: { name: string; type: string },
  message: string,
) {
  const attachmentPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  attachmentPage.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 104,
    width: PAGE_WIDTH,
    height: 104,
    color: ink,
  });
  attachmentPage.drawText("SUPPORTING DOCUMENT", {
    x: MARGIN,
    y: PAGE_HEIGHT - 59,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  attachmentPage.drawText(request.number, {
    x: MARGIN,
    y: PAGE_HEIGHT - 77,
    size: 8.5,
    font: regular,
    color: rgb(0.72, 0.72, 0.75),
  });
  attachmentPage.drawRectangle({
    x: MARGIN,
    y: 170,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 450,
    color: softGray,
    borderColor: line,
    borderWidth: 1,
  });
  const extension =
    document.name.split(".").at(-1)?.toUpperCase().slice(0, 5) || "FILE";
  attachmentPage.drawRectangle({
    x: 250,
    y: 410,
    width: 112,
    height: 132,
    color: rgb(1, 1, 1),
    borderColor: line,
    borderWidth: 1,
  });
  attachmentPage.drawRectangle({
    x: 267,
    y: 440,
    width: 78,
    height: 35,
    color: softBlue,
  });
  attachmentPage.drawText(extension, {
    x: 306 - bold.widthOfTextAtSize(extension, 13) / 2,
    y: 451,
    size: 13,
    font: bold,
    color: blue,
  });
  const nameLines = wrap(document.name, bold, 12, 380);
  nameLines
    .slice(0, 2)
    .forEach((text, index) =>
      attachmentPage.drawText(text, {
        x: PAGE_WIDTH / 2 - bold.widthOfTextAtSize(text, 12) / 2,
        y: 370 - index * 16,
        size: 12,
        font: bold,
        color: ink,
      }),
    );
  attachmentPage.drawText(message, {
    x: PAGE_WIDTH / 2 - regular.widthOfTextAtSize(message, 8.5) / 2,
    y: 326,
    size: 8.5,
    font: regular,
    color: secondary,
  });
}

async function appendSupportingDocuments(
  pdf: PDFDocument,
  regular: PDFFont,
  bold: PDFFont,
  request: InvoiceRequest,
) {
  for (const document of request.documents ?? []) {
    try {
      if (document.dataUrl && document.type === "application/pdf") {
        const source = await PDFDocument.load(dataUrlBytes(document.dataUrl), {
          ignoreEncryption: true,
        });
        const copiedPages = await pdf.copyPages(
          source,
          source.getPageIndices(),
        );
        copiedPages.forEach((copiedPage) => pdf.addPage(copiedPage));
        continue;
      }

      if (
        document.dataUrl &&
        ["image/png", "image/jpeg", "image/jpg"].includes(document.type)
      ) {
        const bytes = dataUrlBytes(document.dataUrl);
        const image =
          document.type === "image/png"
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(bytes);
        const attachmentPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        attachmentPage.drawRectangle({
          x: 0,
          y: PAGE_HEIGHT - 104,
          width: PAGE_WIDTH,
          height: 104,
          color: ink,
        });
        attachmentPage.drawText("SUPPORTING DOCUMENT", {
          x: MARGIN,
          y: PAGE_HEIGHT - 59,
          size: 18,
          font: bold,
          color: rgb(1, 1, 1),
        });
        attachmentPage.drawText(safe(document.name), {
          x: MARGIN,
          y: PAGE_HEIGHT - 77,
          size: 8.5,
          font: regular,
          color: rgb(0.72, 0.72, 0.75),
        });
        const availableWidth = PAGE_WIDTH - MARGIN * 2;
        const availableHeight = PAGE_HEIGHT - 190;
        const scaled = image.scaleToFit(availableWidth, availableHeight);
        attachmentPage.drawImage(image, {
          x: (PAGE_WIDTH - scaled.width) / 2,
          y: 58 + (availableHeight - scaled.height) / 2,
          width: scaled.width,
          height: scaled.height,
        });
        continue;
      }

      drawAttachmentSheet(
        pdf,
        regular,
        bold,
        request,
        document,
        "Preview unavailable - original file remains attached to the request",
      );
    } catch {
      drawAttachmentSheet(
        pdf,
        regular,
        bold,
        request,
        document,
        "The source preview could not be rendered",
      );
    }
  }
}

export async function buildInvoicePdf(request: InvoiceRequest) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`${invoiceNumber(request)} - ${request.payee}`);
  pdf.setAuthor("SVI Technologies Inc.");
  pdf.setSubject("Internal accounts payable invoice");
  pdf.setCreationDate(new Date());

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(page, regular, bold, request);

  labelValue(
    page,
    regular,
    bold,
    "BILL TO / PAYEE",
    request.payee,
    MARGIN,
    630,
    230,
  );
  labelValue(
    page,
    regular,
    bold,
    "REQUESTED BY",
    request.requester,
    MARGIN,
    580,
    230,
  );
  labelValue(
    page,
    regular,
    bold,
    "REQUEST REFERENCE",
    request.number,
    350,
    630,
    210,
  );
  labelValue(page, regular, bold, "DATE", request.date, 350, 580, 95);
  labelValue(page, regular, bold, "STATUS", request.status, 465, 580, 105);
  page.drawLine({
    start: { x: MARGIN, y: 548 },
    end: { x: PAGE_WIDTH - MARGIN, y: 548 },
    thickness: 1,
    color: line,
  });
  page.drawText("PAYMENT DETAILS", {
    x: MARGIN,
    y: 526,
    size: 7,
    font: bold,
    color: secondary,
  });
  page.drawText(
    `${safe(request.nature)}${request.other ? ` - ${safe(request.other)}` : ""}`,
    { x: MARGIN, y: 507, size: 10, font: regular, color: ink },
  );
  page.drawText(`Currency: ${safe(request.currency)}`, {
    x: 430,
    y: 507,
    size: 9,
    font: regular,
    color: secondary,
  });
  if (request.currency === "USD" && request.fxRate && request.fxRateDate) {
    const phpTotal = request.lines.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * Number(request.fxRate);
    page.drawText(`BSP rate: PHP ${safe(request.fxRate)} per USD (effective ${safe(request.fxRateDate)}) - PHP equivalent: ${phpTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, {
      x: MARGIN,
      y: 490,
      size: 7.5,
      font: regular,
      color: secondary,
    });
  }

  let y = drawColumnHeaders(page, bold, 477);
  const particularsWidth = 252;
  for (const item of request.lines) {
    const particulars = wrap(item.particulars, regular, 8.5, particularsWidth);
    const rowHeight = Math.max(36, particulars.length * 11 + 16);
    if (y - rowHeight < 105) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeader(page, regular, bold, request);
      page.drawText(`Continuation - ${request.number}`, {
        x: MARGIN,
        y: 640,
        size: 9,
        font: regular,
        color: secondary,
      });
      y = drawColumnHeaders(page, bold, 610);
    }
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.7,
      color: line,
    });
    page.drawText(safe(item.project || "-"), {
      x: MARGIN + 10,
      y: y - 22,
      size: 8.5,
      font: regular,
      color: ink,
    });
    page.drawText(safe(item.account || "Pending mapping"), {
      x: MARGIN + 91,
      y: y - 22,
      size: 8.5,
      font: regular,
      color: ink,
      maxWidth: 88,
    });
    particulars.forEach((text, index) =>
      page.drawText(text, {
        x: MARGIN + 184,
        y: y - 21 - index * 11,
        size: 8.5,
        font: regular,
        color: ink,
      }),
    );
    const amount = money(item.amount, request.currency);
    page.drawText(amount, {
      x: PAGE_WIDTH - MARGIN - 10 - regular.widthOfTextAtSize(amount, 8.5),
      y: y - 22,
      size: 8.5,
      font: regular,
      color: ink,
    });
    y -= rowHeight;
  }
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.7,
    color: line,
  });

  const sum = request.lines.reduce(
    (value, item) => value + (Number(item.amount) || 0),
    0,
  );
  if (y < 160) {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, regular, bold, request);
    y = 620;
  }
  page.drawRectangle({
    x: 350,
    y: y - 58,
    width: PAGE_WIDTH - MARGIN - 350,
    height: 44,
    color: softBlue,
  });
  page.drawText("TOTAL", {
    x: 365,
    y: y - 40,
    size: 8,
    font: bold,
    color: blue,
  });
  const totalText = money(String(sum), request.currency);
  page.drawText(totalText, {
    x: PAGE_WIDTH - MARGIN - 12 - bold.widthOfTextAtSize(totalText, 13),
    y: y - 43,
    size: 13,
    font: bold,
    color: ink,
  });

  page.drawText(
    "This document was generated from the Internal Accounts Payable Workflow System.",
    { x: MARGIN, y: 76, size: 7.5, font: regular, color: secondary },
  );
  page.drawText(`Verification reference: ${request.number}`, {
    x: MARGIN,
    y: 62,
    size: 7.5,
    font: regular,
    color: secondary,
  });

  await appendSupportingDocuments(pdf, regular, bold, request);

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    const footer = `Page ${index + 1} of ${pages.length}`;
    pdfPage.drawText(footer, {
      x: pdfPage.getWidth() - MARGIN - regular.widthOfTextAtSize(footer, 7.5),
      y: 24,
      size: 7.5,
      font: regular,
      color: secondary,
    });
  });
  return pdf.save();
}

export async function downloadInvoicePdf(request: InvoiceRequest) {
  const bytes = await buildInvoicePdf(request);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${invoiceNumber(request)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
