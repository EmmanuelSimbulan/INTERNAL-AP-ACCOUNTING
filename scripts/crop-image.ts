import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
async function main() {
  const image = await loadImage("tmp/pdfs/sample-page-2.png");
  const canvas = createCanvas(image.width, 360);
  canvas.getContext("2d").drawImage(image, 0, 0);
  await writeFile("tmp/pdfs/sample-page-2-top.png", canvas.toBuffer("image/png"));
}
void main();
