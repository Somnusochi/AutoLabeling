import type { BBox } from "@/types";

export function generateYoloTxt(boxes: BBox[], categories: string[], imgW: number, imgH: number): string {
  const catId = new Map(categories.map((c, i) => [c, i]));
  const lines: string[] = [];

  for (const box of boxes) {
    const cid = catId.get(box.class_name);
    if (cid === undefined) continue;
    const cx = ((box.x1 + box.x2) / 2) / imgW;
    const cy = ((box.y1 + box.y2) / 2) / imgH;
    const w = (box.x2 - box.x1) / imgW;
    const h = (box.y2 - box.y1) / imgH;
    lines.push(`${cid} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`);
  }

  return lines.join("\n");
}

export function downloadYoloTxt(boxes: BBox[], categories: string[], imgW: number, imgH: number, filename: string): void {
  const content = generateYoloTxt(boxes, categories, imgW, imgH);
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.[^.]+$/, ".txt");
  a.click();
  URL.revokeObjectURL(url);
}
