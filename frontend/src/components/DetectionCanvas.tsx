import { useCallback, useEffect, useRef, useState } from "react";
import type { BBox } from "@/types";

const COLORS = [
  "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

type Mode = "view" | "draw";

interface Props {
  imageUrl: string;
  boxes: BBox[];
  imgWidth: number;
  imgHeight: number;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onDrawBox: (box: { x1: number; y1: number; x2: number; y2: number }) => void;
}

export function DetectionCanvas({
  imageUrl, boxes, imgWidth, imgHeight, mode, onModeChange, onDrawBox,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scale = 1; // Always 1:1 for pixel-accurate drawing
  const [drawing, setDrawing] = useState<{
    startX: number; startY: number; currentX: number; currentY: number;
  } | null>(null);

  // ── Draw image + boxes ──────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayW = Math.round(imgWidth * scale);
    const displayH = Math.round(imgHeight * scale);
    canvas.width = displayW;
    canvas.height = displayH;

    // Image
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, displayW, displayH);
      ctx.drawImage(img, 0, 0, displayW, displayH);

      // Existing boxes
      boxes.forEach((box, idx) => {
        drawRect(ctx, box.x1 * scale, box.y1 * scale,
          (box.x2 - box.x1) * scale, (box.y2 - box.y1) * scale,
          COLORS[idx % COLORS.length], box.class_name);
      });

      // Drawing preview
      if (drawing) {
        const x = Math.min(drawing.startX, drawing.currentX);
        const y = Math.min(drawing.startY, drawing.currentY);
        const w = Math.abs(drawing.currentX - drawing.startX);
        const h = Math.abs(drawing.currentY - drawing.startY);
        drawRect(ctx, x, y, w, h, "#FF9800", "");
      }
    };
  }, [imageUrl, boxes, scale, drawing, imgWidth, imgHeight]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // ── Mouse handlers ──────────────────────────────
  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (mode !== "draw") return;
    const { x, y } = getPos(e);
    setDrawing({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const { x, y } = getPos(e);
    setDrawing({ ...drawing, currentX: x, currentY: y });
  };

  const onMouseUp = () => {
    if (!drawing) return;
    const x1 = Math.round(Math.min(drawing.startX, drawing.currentX) / scale);
    const y1 = Math.round(Math.min(drawing.startY, drawing.currentY) / scale);
    const x2 = Math.round(Math.max(drawing.startX, drawing.currentX) / scale);
    const y2 = Math.round(Math.max(drawing.startY, drawing.currentY) / scale);
    setDrawing(null);
    if (x2 - x1 > 5 && y2 - y1 > 5) {
      onDrawBox({ x1, y1, x2, y2 });
    }
  };

  // ── Render ───────────────────────────────────────
  return (
    <div>
      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-2">
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="radio" name="canvas-mode" checked={mode === "view"}
            onChange={() => onModeChange("view")}
            className="h-3 w-3"
          />
          查看
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="radio" name="canvas-mode" checked={mode === "draw"}
            onChange={() => onModeChange("draw")}
            className="h-3 w-3"
          />
          标注
        </label>
        {mode === "draw" && (
          <span className="text-xs text-orange-500">拖拽鼠标绘制框</span>
        )}
      </div>

      <div ref={containerRef} className="rounded-lg overflow-hidden bg-gray-100">
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className={`block mx-auto ${mode === "draw" ? "cursor-crosshair" : "cursor-default"}`}
        />
      </div>
    </div>
  );
}

// ── Helper ──────────────────────────────────────
function drawRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  color: string, label: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  if (label) {
    ctx.font = "12px system-ui, sans-serif";
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 18, tw, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 4, y - 6);
  }
}
