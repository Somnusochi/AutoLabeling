import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImageUploader } from "@/components/ImageUploader";
import { CategoryInput } from "@/components/CategoryInput";
import { DetectionResult } from "@/components/DetectionResult";
import { HistoryList } from "@/components/HistoryList";
import { BatchProgress } from "@/components/BatchProgress";
import { TrainingPanel } from "@/components/TrainingPanel";
import { DetectionSkeleton, HistorySkeleton } from "@/components/LoadingSkeleton";
import {
  useDetectMutation,
  useDetectionListQuery,
} from "@/hooks/useDetection";
import toast from "react-hot-toast";
import { addBox, detectImage, deleteBox } from "@/services/api";
import { API_BASE } from "@/lib/constants";
import type { BBox, Detection } from "@/types";

export function Home() {
  // ── Upload & categories ──────────────────────────
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // ── Detection ────────────────────────────────────
  const detectMut = useDetectMutation();
  const [result, setResult] = useState<Detection | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // ── Batch processing ─────────────────────────────
  const [batchResults, setBatchResults] = useState<Detection[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const batchRef = useRef(false);

  // ── YOLO Validation mode ────────────────────────
  const [validateMode, setValidateMode] = useState<{ jobId: string; modelVariant: string } | null>(null);
  const [validateConf, setValidateConf] = useState(0.25);
  const [validateIou, setValidateIou] = useState(0.45);
  const [validating, setValidating] = useState(false);

  // ── Manual annotation ────────────────────────────
  const [canvasMode, setCanvasMode] = useState<"view" | "draw">("view");
  const [drawCategory, setDrawCategory] = useState("");

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setValidateMode({ jobId: detail.jobId, modelVariant: detail.modelVariant });
      setResult(null);
      setPreviewUrl(null);
      setFiles([]);
      setCategories([]);
      toast.success(`已切换至验证模式: ${detail.modelVariant}`);
    };
    window.addEventListener("yolo-validate", handler);
    return () => window.removeEventListener("yolo-validate", handler);
  }, []);

  // ── History ──────────────────────────────────────
  const { data: historyData } = useDetectionListQuery();
  const recentCategories = Array.from(
    new Set(
      (historyData?.items ?? []).flatMap((d) => {
        try { return JSON.parse(d.categories) as string[]; } catch { return []; }
      })
    )
  ).sort();

  // ── Handlers ─────────────────────────────────────

  const handleFiles = useCallback((fs: File[]) => {
    setFiles(fs);
    setBatchResults([]);
    setResult(null);
    setPreviewUrl(fs.length === 1 ? URL.createObjectURL(fs[0]) : null);
  }, []);

  const handleDetect = useCallback(async () => {
    if (files.length === 0) return;

    // YOLO validation mode
    if (validateMode) {
      setValidating(true);
      try {
        const form = new FormData();
        form.append("file", files[0]);
        form.append("conf", String(validateConf));
        form.append("iou", String(validateIou));
        const res = await fetch(`${API_BASE}/train/jobs/${validateMode.jobId}/predict`, {
          method: "POST", body: form,
        });
        const json = await res.json();
        if (!res.ok) { toast.error(json.detail ?? "验证失败"); return; }
        const data = json.data;
      setResult({
        id: `validate-${Date.now()}`,
        image_name: files[0].name,
        categories: "[]",
        model_name: validateMode.modelVariant,
        image_width: data.image_width,
        image_height: data.image_height,
        status: "completed",
        created_at: new Date().toISOString(),
        boxes: data.boxes.map((b: Record<string, unknown>, i: number) => ({
          id: `vb-${i}`,
          class_name: b.class_name as string,
          x1: b.x1 as number,
          y1: b.y1 as number,
          x2: b.x2 as number,
          y2: b.y2 as number,
          confidence: b.confidence as number,
        })),
      });
      } finally {
        setValidating(false);
      }
      return;
    }

    // Normal LocateAnything detection
    if (categories.length === 0) return;
    const results: Detection[] = [];
    setBatchProgress({ current: 0, total: files.length });
    batchRef.current = true;
    const t0 = performance.now();

    try {
      for (let i = 0; i < files.length; i++) {
        if (!batchRef.current) break;
        const data = await detectImage(files[i], categories);
        results.push(data);
        setBatchResults([...results]);
        if (i === files.length - 1) {
          setResult(data);
          setPreviewUrl(URL.createObjectURL(files[i]));
          setBatchProgress({ current: 0, total: 0 }); // Reset to stop loading
        } else {
          setBatchProgress({ current: i + 1, total: files.length });
        }
        if (i === 0 || i === files.length - 1) {
          setElapsedMs(Math.round(performance.now() - t0));
        }
      }
    } catch { setBatchProgress({ current: 0, total: 0 }); }
  }, [files, categories, validateMode, validateConf, validateIou]);

  const handleSelectHistory = useCallback((det: Detection) => {
    setFiles([]);
    setPreviewUrl(`${API_BASE}/detections/${det.id}/image`);
    setResult(det);
    setBatchResults([]);
    try { setCategories(JSON.parse(det.categories)); } catch { setCategories([]); }
  }, []);

  const handleReDetect = useCallback(async () => {
    if (!result) return;
    const t0 = performance.now();
    try {
      const blob = await fetch(`${API_BASE}/detections/${result.id}/image`).then((r) => r.blob());
      const file = new File([blob], result.image_name, { type: blob.type });
      const data = await detectMut.mutateAsync({ file, categories });
      setResult(data);
      setFiles([]);
      setElapsedMs(Math.round(performance.now() - t0));
    } catch { /* handled by mutation */ }
  }, [result, categories, detectMut]);

  const handleDrawBox = useCallback(async (raw: { x1: number; y1: number; x2: number; y2: number }) => {
    if (!result || !drawCategory.trim()) {
      toast.error("请先输入标注类别");
      return;
    }
    try {
      await addBox(result.id, { ...raw, class_name: drawCategory.trim() });
      const newBox: BBox = {
        id: `manual-${Date.now()}`,
        class_name: drawCategory.trim(),
        ...raw,
        confidence: null,
      };
      const updated = { ...result, boxes: [...result.boxes, newBox] };
      setResult(updated);
      setBatchResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch { /* ignore */ }
  }, [result, drawCategory]);

  const handleDeleteBox = useCallback(async (boxIndex: number) => {
    if (!result) return;
    const box = result.boxes[boxIndex];
    if (!box) return;
    try {
      await deleteBox(result.id, box.id);
      const updated = { ...result, boxes: result.boxes.filter((_, i) => i !== boxIndex) };
      setResult(updated);
      setBatchResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch { /* ignore */ }
  }, [result]);

  const handleSelectBatch = useCallback((det: Detection, file?: File) => {
    setResult(det);
    if (file) setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const loading = detectMut.isPending || batchProgress.total > 0 || validating;

  // ── Resizable sidebar ─────────────────────────────
  const [sidebarW, setSidebarW] = useState(288);
  const dragging = useRef(false);

  const onDragStart = () => { dragging.current = true; };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setSidebarW(Math.max(200, Math.min(500, e.clientX)));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ── Render ───────────────────────────────────────

  return (
    <>
      {/* Left sidebar */}
      <aside
        className="flex-shrink-0 border-r border-gray-200 bg-white flex flex-col gap-4 overflow-y-auto relative"
        style={{ width: sidebarW, padding: "1rem" }}
      >
        <h1 className="text-lg font-bold text-gray-800">
          {validateMode ? (
            <span className="text-green-600">YOLO 验证模式</span>
          ) : (
            "预标注训练"
          )}
        </h1>

        {validateMode && (
          <div className="rounded bg-green-50 border border-green-200 p-2 text-xs space-y-2">
            <p className="text-green-700 font-medium">模型: {validateMode.modelVariant}</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-gray-500">Conf</label>
                <input type="number" min={0.05} max={1} step={0.05} value={validateConf}
                  onChange={(e) => setValidateConf(Number(e.target.value))}
                  className="w-full rounded border border-gray-200 px-1 py-0.5 text-xs" />
              </div>
              <div className="flex-1">
                <label className="text-gray-500">IoU</label>
                <input type="number" min={0.1} max={1} step={0.05} value={validateIou}
                  onChange={(e) => setValidateIou(Number(e.target.value))}
                  className="w-full rounded border border-gray-200 px-1 py-0.5 text-xs" />
              </div>
            </div>
            <button
              onClick={() => { setValidateMode(null); setResult(null); }}
              className="text-green-600 hover:underline"
            >
              退出验证
            </button>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">上传图片</p>
          <ImageUploader onFiles={handleFiles} disabled={loading} />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">目标类别</p>
          <CategoryInput
            categories={categories}
            onChange={setCategories}
            disabled={loading}
            recentCategories={recentCategories}
          />
        </div>

        <button
          type="button"
          disabled={loading || files.length === 0 || (!validateMode && categories.length === 0)}
          onClick={handleDetect}
          className="w-full rounded bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                检测中 {batchProgress.total > 1 ? `(${batchProgress.current}/${batchProgress.total})` : "..."}
              </span>
            : validateMode
              ? `YOLO 验证`
              : `开始检测${files.length > 1 ? ` (${files.length} 张)` : ""}`}
        </button>

        <BatchProgress
          current={batchProgress.current}
          total={batchProgress.total}
          completed={batchResults.length}
          onCancel={() => { batchRef.current = false; setBatchProgress({ current: 0, total: 0 }); }}
        />

        <hr className="border-gray-100" />

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">历史记录</p>
          <Suspense fallback={<HistorySkeleton />}>
            <ErrorBoundary>
              <HistoryList data={historyData} onSelect={handleSelectHistory} />
            </ErrorBoundary>
          </Suspense>
        </div>

        <hr className="border-gray-100" />

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">YOLO 训练</p>
          <TrainingPanel detections={historyData?.items ?? []} />
        </div>
        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary-300 transition-colors z-10"
          style={{ marginRight: "-3px" }}
        />
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-y-auto p-6">
        {!result && !loading && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            上传图片并输入目标类别，点击"开始检测"
          </div>
        )}

        {loading && !result && <DetectionSkeleton />}

        {result && previewUrl && (
          <ErrorBoundary>
            <DetectionResult
              result={result}
              previewUrl={previewUrl}
              elapsedMs={elapsedMs}
              batchResults={batchResults}
              batchFiles={files}
              loading={loading}
              categories={categories}
              canvasMode={canvasMode}
              drawCategory={drawCategory}
              recentCategories={recentCategories}
              onCanvasModeChange={setCanvasMode}
              onDrawCategoryChange={setDrawCategory}
              onDeleteBox={handleDeleteBox}
              onSelectBatch={handleSelectBatch}
              onReDetect={handleReDetect}
              onDrawBox={handleDrawBox}
            />
          </ErrorBoundary>
        )}
      </main>
    </>
  );
}
