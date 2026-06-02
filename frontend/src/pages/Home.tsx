import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImageUploader } from "@/components/ImageUploader";
import { CategoryInput } from "@/components/CategoryInput";
import { DetectionResult } from "@/components/DetectionResult";
import { HistoryList } from "@/components/HistoryList";
import { BatchProgress } from "@/components/BatchProgress";
import { TrainingPanel } from "@/components/TrainingPanel";
import { DetectionSkeleton, HistorySkeleton } from "@/components/LoadingSkeleton";
import { useDetectMutation, useDetectionListQuery } from "@/hooks/useDetection";
import { useYoloValidation } from "@/hooks/useYoloValidation";
import { useBatchDetection } from "@/hooks/useBatchDetection";
import { applyFilter } from "@/lib/filterBoxes";
import type { FilterMode } from "@/lib/filterBoxes";
import toast from "react-hot-toast";
import { addBox, deleteBox, saveFilterSettings } from "@/services/api";
import { API_BASE } from "@/lib/constants";
import { parseCategories } from "@/lib/parsers";
import type { BBox, Detection } from "@/types";

export function Home() {
  // ── Upload & categories ──────────────────────────
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // ── Detection ────────────────────────────────────
  const detectMut = useDetectMutation();
  const [result, setResult] = useState<Detection | null>(null);

  // ── Batch processing ─────────────────────────────
  const { batchResults, batchProgress, runBatch, cancelBatch, setBatchResults } = useBatchDetection();

  // ── YOLO Validation ──────────────────────────────
  const {
    validateMode, validateConf, validateIou, validating,
    setValidateConf, setValidateIou, exitValidation, runValidation,
  } = useYoloValidation();

  // ── Manual annotation ────────────────────────────
  const [canvasMode, setCanvasMode] = useState<"view" | "draw">("view");
  const [drawCategory, setDrawCategory] = useState("");
  const [hiddenIndices, setHiddenIndices] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [nmsIou, setNmsIou] = useState(0.5);

  const handleSaveBoxes = useCallback(async () => {
    if (!result) return;
    try {
      await saveFilterSettings(result.id, filterMode, filterMode === "nms" ? nmsIou : null);
      setResult({ ...result, filter_mode: filterMode, filter_nms_iou: filterMode === "nms" ? nmsIou : null });
      toast.success("过滤设置已保存");
    } catch {
      toast.error("保存失败");
    }
  }, [result, filterMode, nmsIou]);

  const toggleBoxVisibility = useCallback((boxId: string) => {
    setHiddenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(boxId)) { next.delete(boxId); } else { next.add(boxId); }
      return next;
    });
  }, []);

  // ── Detection timer ───────────────────────────────
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setElapsedMs(0);
    timerRef.current = setInterval(() => setElapsedMs((prev) => prev + 100), 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── History ──────────────────────────────────────
  const { data: historyData } = useDetectionListQuery();
  const recentCategories = Array.from(
    new Set((historyData?.items ?? []).flatMap((d) => parseCategories(d.categories)))
  ).sort();

  // ── Handlers ─────────────────────────────────────

  const handleFiles = useCallback((fs: File[]) => {
    setFiles(fs);
    setBatchResults([]);
    setResult(null);
    setPreviewUrl(fs.length === 1 ? URL.createObjectURL(fs[0]) : null);
  }, [setBatchResults]);

  const handleDetect = useCallback(async () => {
    if (files.length === 0) return;

    startTimer();

    try {
      if (validateMode) {
        const data = await runValidation(files[0]);
        if (data) {
          setResult(data);
          setPreviewUrl(URL.createObjectURL(files[0]));
        }
        return;
      }

      if (categories.length === 0) return;
      await runBatch(files, categories, (data, file, i) => {
        if (i === files.length - 1) {
          setResult(data);
          setPreviewUrl(URL.createObjectURL(file));
        }
      });
    } finally {
      stopTimer();
    }
  }, [files, categories, validateMode, runValidation, runBatch, startTimer, stopTimer]);

  const handleSelectHistory = useCallback((det: Detection) => {
    setFiles([]);
    setPreviewUrl(`${API_BASE}/detections/${det.id}/image`);
    setResult(det);
    setBatchResults([]);
    setCategories(parseCategories(det.categories));
    if (det.filter_mode) setFilterMode(det.filter_mode as FilterMode);
    else setFilterMode("all");
    if (det.filter_nms_iou != null) setNmsIou(det.filter_nms_iou);
    setHiddenIndices(new Set());
  }, [setBatchResults]);

  const handleReDetect = useCallback(async () => {
    if (!result) return;
    startTimer();
    try {
      const blob = await fetch(`${API_BASE}/detections/${result.id}/image`).then((r) => r.blob());
      const data = await detectMut.mutateAsync({ file: new File([blob], result.image_name, { type: blob.type }), categories });
      setResult(data);
      setFiles([]);
    } catch { /* handled by mutation */ }
    finally { stopTimer(); }
  }, [result, categories, detectMut, startTimer, stopTimer]);

  const handleDrawBox = useCallback(async (raw: { x1: number; y1: number; x2: number; y2: number }) => {
    if (!result || !drawCategory.trim()) { toast.error("请先输入标注类别"); return; }
    try {
      await addBox(result.id, { ...raw, class_name: drawCategory.trim() });
      const newBox: BBox = { id: `manual-${Date.now()}`, class_name: drawCategory.trim(), ...raw, confidence: null };
      const updated = { ...result, boxes: [...result.boxes, newBox] };
      setResult(updated);
      setBatchResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch { /* ignore */ }
  }, [result, drawCategory, setBatchResults]);

  const handleDeleteBox = useCallback(async (boxId: string) => {
    if (!result) return;
    const box = result.boxes.find((b) => b.id === boxId);
    if (!box) return;
    try {
      await deleteBox(result.id, box.id);
      const updated = { ...result, boxes: result.boxes.filter((b) => b.id !== boxId) };
      setResult(updated);
      setBatchResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch { /* ignore */ }
  }, [result, setBatchResults]);

  const handleBatchSelect = useCallback((det: Detection, file?: File) => {
    setResult(det);
    if (file) setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const loading = detectMut.isPending || batchProgress.total > 0 || validating;

  const displayResult = useMemo(
    () => result ? { ...result, boxes: applyFilter(filterMode, result.boxes, nmsIou) } : null,
    [result, filterMode, nmsIou],
  );

  // ── Resizable sidebar ─────────────────────────────
  const [sidebarW, setSidebarW] = useState(288);
  const dragging = useRef(false);
  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) setSidebarW(Math.max(200, Math.min(500, e.clientX))); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ── Render ───────────────────────────────────────

  return (
    <>
      <aside
        className="flex-shrink-0 border-r border-gray-200 bg-white flex flex-col gap-4 overflow-y-auto relative"
        style={{ width: sidebarW, padding: "1rem" }}
      >
        <h1 className="text-lg font-bold text-gray-800">
          {validateMode ? <span className="text-green-600">YOLO 验证模式</span> : "预标注训练"}
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
            <button onClick={() => { exitValidation(); setResult(null); }} className="text-green-600 hover:underline">
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
          <CategoryInput categories={categories} onChange={setCategories} disabled={loading} recentCategories={recentCategories} />
        </div>

        <button
          type="button"
          disabled={loading || files.length === 0 || (!validateMode && categories.length === 0)}
          onClick={handleDetect}
          className="w-full rounded bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                检测中 {batchProgress.total > 1 ? `(${batchProgress.current}/${batchProgress.total})` : "..."}
              </span>
            : validateMode ? "YOLO 验证" : `开始检测${files.length > 1 ? ` (${files.length} 张)` : ""}`}
        </button>

        <BatchProgress current={batchProgress.current} total={batchProgress.total} completed={batchResults.length}
          onCancel={cancelBatch} />

        {result && (
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">过滤模式</p>
            <div className="flex gap-1 rounded bg-gray-100 p-1 text-xs">
              {(["best", "nms", "all"] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setFilterMode(mode); setHiddenIndices(new Set()); }}
                  className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${
                    filterMode === mode ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {{ best: "最优", nms: "去重", all: "全部" }[mode]}
                </button>
              ))}
            </div>
            {filterMode === "nms" && (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400">IoU</span>
                  <div className="relative flex-1">
                    <input
                      type="range" min={0.1} max={0.9} step={0.05} value={nmsIou}
                      onChange={(e) => setNmsIou(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500
                        [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-7 text-right">{nmsIou.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
                  <span>更少框</span>
                  <span>更多框</span>
                </div>
              </>
            )}
          </div>
        )}

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

        <div onMouseDown={() => { dragging.current = true; }}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary-300 transition-colors z-10"
          style={{ marginRight: "-3px" }} />
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto p-6">
        {!result && !loading && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            上传图片并输入目标类别，点击"开始检测"
          </div>
        )}
        {loading && !result && <DetectionSkeleton />}
        {displayResult && previewUrl && (
          <ErrorBoundary>
            <DetectionResult
              result={displayResult} previewUrl={previewUrl}
              batchResults={batchResults} batchFiles={files} loading={loading} elapsedMs={elapsedMs}
              categories={categories} canvasMode={canvasMode} drawCategory={drawCategory}
              recentCategories={recentCategories} hiddenIndices={hiddenIndices}
              onToggleVisibility={toggleBoxVisibility} isValidation={!!validateMode}
              onCanvasModeChange={setCanvasMode} onDrawCategoryChange={setDrawCategory}
              onDeleteBox={handleDeleteBox} onSelectBatch={handleBatchSelect}
              onReDetect={handleReDetect} onSaveBoxes={handleSaveBoxes} onDrawBox={handleDrawBox}
            />
          </ErrorBoundary>
        )}
      </main>
    </>
  );
}
