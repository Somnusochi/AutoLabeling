export function TrainingPreview({ detection }: { detection: Detection }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showBBox, setShowBBox] = useState(true);
  const [showMask, setShowMask] = useState(true);
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    detection.boxes.forEach((box) => {
      if (!map.has(box.className)) {
        map.set(box.className, BOX_COLORS[map.size % BOX_COLORS.length]);
      }
    });
    return map;
  }, [detection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.src = `${API_BASE}/detections/${detection.id}/image`;
    img.onload = () => {
      const maxW = 460;
      const scale = Math.min(maxW / img.naturalWidth, 330 / img.naturalHeight, 1);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      detection.boxes.forEach((box) => {
        const color = colorMap.get(box.className)!;
        // Draw mask polygon
        if (showMask && box.maskPolygon && box.maskPolygon.length >= 3) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(box.maskPolygon[0][0] * scale, box.maskPolygon[0][1] * scale);
          for (let i = 1; i < box.maskPolygon.length; i++) {
            ctx.lineTo(box.maskPolygon[i][0] * scale, box.maskPolygon[i][1] * scale);
          }
          ctx.closePath();
          ctx.fillStyle = color + "30";
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
        // Draw bbox
        if (showBBox) {
          const x = box.x1 * scale,
            y = box.y1 * scale;
          const w = (box.x2 - box.x1) * scale,
            h = (box.y2 - box.y1) * scale;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, y, w, h);
          // Label positioning — same logic as DetectionCanvas drawRect
          ctx.font = "10px system-ui";
          const tw = ctx.measureText(box.className).width + 6;
          const labelX = Math.max(0, Math.min(x, canvas.width - tw));
          const labelY = y < 16 ? y + 2 : y - 16;
          const textY = y < 16 ? y + 13 : y - 5;
          ctx.fillStyle = color;
          ctx.fillRect(labelX, labelY, tw, 15);
          ctx.fillStyle = "#fff";
          ctx.fillText(box.className, labelX + 3, textY);
        }
      });
    };
  }, [colorMap, detection, showBBox, showMask]);

  return (
    <div className="w-[min(520px,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-gray-700">{detection.imageName}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {t("trainingPanel.targetsCount", { count: detection.boxes.length })}
          </p>
        </div>
        {(() => {
          const cats = new Set<string>();
          detection.boxes.forEach((b) => cats.add(b.className));
          parseCategories(detection.categories).forEach((c) => cats.add(c));
          if (cats.size === 0) return null;
          return (
            <div className="flex max-w-56 flex-wrap justify-end gap-1">
              {[...cats].map((name) => (
                <span
                  key={name}
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${colorMap.get(name) ?? BOX_COLORS[0]}20`,
                    color: colorMap.get(name) ?? BOX_COLORS[0],
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          );
        })()}
      </div>
      <div className="flex items-center gap-3 mb-1.5">
        <label className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showBBox}
            onChange={(e) => setShowBBox(e.target.checked)}
            className="h-3 w-3 rounded"
          />
          BBox
        </label>
        <label className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showMask}
            onChange={(e) => setShowMask(e.target.checked)}
            className="h-3 w-3 rounded"
          />
          Mask
        </label>
      </div>
      <canvas
        ref={canvasRef}
        className="block max-w-full rounded-md border border-gray-100 bg-gray-50"
      />
    </div>
  );
}
