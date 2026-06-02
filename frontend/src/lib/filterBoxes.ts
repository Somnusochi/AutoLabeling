import type { BBox } from "@/types";

type FilterMode = "best" | "all" | "nms";

function iou(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter);
}

function nmsFilter(boxes: BBox[], iouThreshold: number = 0.5): BBox[] {
  // VLM outputs in confidence order, keep earlier (higher confidence) boxes
  const kept: BBox[] = [];
  for (const box of boxes) {
    if (!kept.some((k) => iou(k, box) >= iouThreshold)) {
      kept.push(box);
    }
  }
  return kept;
}

export function applyFilter(mode: FilterMode, boxes: BBox[], iouThreshold: number = 0.5): BBox[] {
  if (boxes.length === 0) return [];
  switch (mode) {
    case "best": {
      const seen = new Set<string>();
      return boxes.filter((b) => {
        if (seen.has(b.className)) return false;
        seen.add(b.className);
        return true;
      });
    }
    case "nms":
      return nmsFilter(boxes, iouThreshold);
    case "all":
    default:
      return boxes;
  }
}

export type { FilterMode };
