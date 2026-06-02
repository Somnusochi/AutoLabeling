import { useEffect, useRef } from "react";
import type { BBox } from "@/types";

const COLORS = [
  "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

interface Props {
  imageUrl: string;
  boxes: BBox[];
  imgWidth: number;
  imgHeight: number;
}

export function DetectionCanvas({ imageUrl, boxes, imgWidth, imgHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      // Fit within container: max 700px wide, max 500px tall
      const maxW = Math.min(container.clientWidth, 700);
      const maxH = 500;
      const scale = Math.min(maxW / imgWidth, maxH / imgHeight, 1);
      const displayW = Math.round(imgWidth * scale);
      const displayH = Math.round(imgHeight * scale);

      canvas.width = displayW;
      canvas.height = displayH;
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw image
      ctx.drawImage(img, 0, 0, displayW, displayH);

      // Draw boxes
      boxes.forEach((box, idx) => {
        const x = box.x1 * scale;
        const y = box.y1 * scale;
        const w = (box.x2 - box.x1) * scale;
        const h = (box.y2 - box.y1) * scale;
        const color = COLORS[idx % COLORS.length];

        // Box rect
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // Label background
        const label = `${box.class_name}`;
        ctx.font = "12px system-ui, sans-serif";
        const metrics = ctx.measureText(label);
        const textW = metrics.width + 8;
        const textH = 18;

        ctx.fillStyle = color;
        ctx.fillRect(x, y - textH, textW, textH);

        // Label text
        ctx.fillStyle = "#fff";
        ctx.fillText(label, x + 4, y - 5);
      });
    };
  }, [imageUrl, boxes, imgWidth, imgHeight]);

  return (
    <div ref={containerRef} className="w-full rounded-lg overflow-hidden bg-gray-100">
      <canvas ref={canvasRef} className="block mx-auto" />
    </div>
  );
}
