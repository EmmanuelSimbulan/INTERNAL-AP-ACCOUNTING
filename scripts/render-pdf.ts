import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

class CanvasFactory {
  create(width: number, height: number) { const canvas = createCanvas(width, height); return { canvas, context: canvas.getContext("2d") }; }
  reset(target: ReturnType<CanvasFactory["create"]>, width: number, height: number) { target.canvas.width = width; target.canvas.height = height; }
  destroy(target: ReturnType<CanvasFactory["create"]>) { target.canvas.width = 0; target.canvas.height = 0; }
}

async function main() {
  const source = process.argv[2] ?? "output/pdf/sample-request-for-payment.pdf";
  const data = new Uint8Array(await readFile(source));
  const document = await getDocument({ data, useSystemFonts: true }).promise;
  await mkdir("tmp/pdfs", { recursive: true });
  const outputs: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber); const viewport = page.getViewport({ scale: 2 }); const factory = new CanvasFactory(); const target = factory.create(viewport.width, viewport.height);
    await page.render({ canvas: target.canvas as never, canvasContext: target.context as never, viewport }).promise;
    const output = `tmp/pdfs/sample-page-${pageNumber}.png`; await writeFile(output, target.canvas.toBuffer("image/png")); outputs.push(output);
  }
  console.log(JSON.stringify({ pages: document.numPages, outputs }));
}
void main();
