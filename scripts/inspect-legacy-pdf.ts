import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

async function main() {
  const source = process.argv[2] ?? "../Internal AP Accounting Document.pdf";
  const bytes = await readFile(source);
  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    updateMetadata: false,
    throwOnInvalidObject: true,
  });
  const fields = pdf.getForm().getFields().map((field) => ({
    name: field.getName(),
    type: field.constructor.name,
  }));
  console.log(JSON.stringify({
    source,
    pageCount: pdf.getPageCount(),
    title: pdf.getTitle(),
    author: pdf.getAuthor(),
    subject: pdf.getSubject(),
    fields,
  }, null, 2));
}

void main();
