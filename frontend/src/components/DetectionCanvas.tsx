import { CANVAS_MAX_W, CANVAS_MAX_H, CANVAS_MIN_BOX_SIZE, BOX_COLORS } from "@/lib/constants";

type Mode = "view" | "draw";

interface Props {
  imageUrl: string;
  boxes: BBox[];
  imgWidth: number;
  imgHeight: number;
  mode: Mode;
  hiddenIndices: Set<string>;
  onModeChange: (mode: Mode) => void;
  onDrawBox: (box: { x1: number; y1: number; x2: number; y2: number }) => void;
}

export function DetectionCanvas({
  imageUrl,
  boxes,
  imgWidth,
  imgHeight,
  mode,
  hiddenIndices,
  onModeChange,
  onDrawBox,
}: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scale = Math.min(CANVAS_MAX_W / imgWidth, CANVAS_MAX_H / imgHeight, 1);
  const [drawing, setDrawing] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [showBBox, setShowBBox] = useState(true);
  const [showMask, setShowMask] = useState(true);

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

      // Build class→color map at draw time
      const uniqClasses = [...new Set(boxes.map((b) => b.className))];
      const classColorMap = new Map<string, string>();
      uniqClasses.forEach((c, i) => classColorMap.set(c, BOX_COLORS[i % BOX_COLORS.length]));

      // Existing boxes
      boxes.forEach((box) => {
        if (hiddenIndices.has(box.id)) return;
        const baseColor = classColorMap.get(box.className) ?? BOX_COLORS[0];
        const color = confidenceColor(box.confidence, baseColor);
        if (showMask && box.maskPolygon && box.maskPolygon.length >= 3) {
          drawPolygon(ctx, box.maskPolygon, scale, color);
        }
        if (showBBox) {
          drawRect(
            ctx,
            box.x1 * scale,
            box.y1 * scale,
            (box.x2 - box.x1) * scale,
            (box.y2 - box.y1) * scale,
            color,
            box.className,
          );
        }
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
  }, [imageUrl, boxes, scale, drawing, hiddenIndices, imgWidth, imgHeight, showBBox, showMask]);

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
    if (x2 - x1 > CANVAS_MIN_BOX_SIZE && y2 - y1 > CANVAS_MIN_BOX_SIZE) {
      onDrawBox({ x1, y1, x2, y2 });
    }
  };

  // ── Render ───────────────────────────────────────
  return (
    <div>
      {/* Mode toggle */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="radio"
            name="canvas-mode"
            checked={mode === "view"}
            onChange={() => onModeChange("view")}
            className="h-3 w-3"
          />
          {t("common.view")}
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="radio"
            name="canvas-mode"
            checked={mode === "draw"}
            onChange={() => onModeChange("draw")}
            className="h-3 w-3"
          />
          {t("common.draw")}
        </label>
        <span className="text-gray-300">|</span>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={showBBox}
            onChange={(e) => setShowBBox(e.target.checked)}
            className="h-3 w-3 rounded"
          />
          BBox
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={showMask}
            onChange={(e) => setShowMask(e.target.checked)}
            className="h-3 w-3 rounded"
          />
          Mask
        </label>
        {mode === "draw" && (
          <span className="text-xs text-orange-500">{t("detectionCanvas.dragTip")}</span>
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

// ── Helpers ─────────────────────────────────────

function confidenceColor(conf: number | null | undefined, baseColor: string): string {
  if (conf == null) return baseColor; // if no confidence, use base color
  if (conf >= 0.8) return baseColor; // high confidence
  if (conf >= 0.5) return "#F59E0B"; // amber — medium
  return "#EF4444"; // red — low
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: number[][],
  scale: number,
  color: string,
) {
  if (polygon.length < 3) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(polygon[0][0] * scale, polygon[0][1] * scale);
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i][0] * scale, polygon[i][1] * scale);
  }
  ctx.closePath();
  ctx.fillStyle = color + "30";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  label: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  if (label) {
    ctx.font = "12px system-ui, sans-serif";
    const tw = ctx.measureText(label).width + 8;
    const labelY = y < 18 ? y + 2 : y - 18; // inside box if near top edge
    const textY = y < 18 ? y + 14 : y - 6;
    ctx.fillStyle = color;
    ctx.fillRect(x, labelY, tw, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 4, textY);
  }
}
