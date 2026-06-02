import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Button, Segmented, Slider } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImageUploader } from "@/components/ImageUploader";
import { CategoryInput } from "@/components/CategoryInput";
import { DetectionResult } from "@/components/DetectionResult";
import { HistoryList } from "@/components/HistoryList";
import { BatchProgress } from "@/components/BatchProgress";
import { TrainingPanel } from "@/components/TrainingPanel";
import { VideoPanel } from "@/components/VideoPanel";
import { VideoValidator } from "@/components/VideoValidator";
import { ModelSelector } from "@/components/ModelSelector";
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
  // ── Mode ────────────────────────────────────────
  const [appMode, setAppMode] = useState<"annotate" | "validate">("annotate");
  const [validateModelSource, setValidateModelSource] = useState<"trained" | "upload">("trained");
  const [selectedTrainedJobId, setSelectedTrainedJobId] = useState<string | null>(null);

  // ── Upload & categories ──────────────────────────
  const [inputMode, setInputMode] = useState<"image" | "video">("image");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [validateVideoId, setValidateVideoId] = useState<string | null>(null);
  const [validateRunKey, setValidateRunKey] = useState(0);
  const [externalModelFile, setExternalModelFile] = useState<File | null>(null);

  // ── Detection ────────────────────────────────────
  const queryClient = useQueryClient();
  const detectMut = useDetectMutation();
  const [result, setResult] = useState<Detection | null>(null);

  // ── Batch processing ─────────────────────────────
  const { batchResults, batchProgress, runBatch, cancelBatch, setBatchResults, setBatchProgress } = useBatchDetection();

  // ── YOLO Validation ──────────────────────────────
  const {
    validateMode: _validateMode, validateConf, validateIou, validating,
    setValidateConf, setValidateIou, runValidation,
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
      setResult({ ...result, filterMode: filterMode, filterNmsIou: filterMode === "nms" ? nmsIou : null });
      queryClient.invalidateQueries({ queryKey: ["detections"] });
      toast.success("过滤设置已保存");
    } catch {
      toast.error("保存失败");
    }
  }, [result, filterMode, nmsIou, queryClient]);

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

  // Maps detection_id → File for batch results that can be re-detected
  const batchFileMap = useRef<Map<string, File>>(new Map());

  const handleDetect = useCallback(async () => {
    if (files.length === 0) return;

    startTimer();
    batchFileMap.current.clear();

    try {
      if (appMode === "validate") {
        // Batch-validate all files
        const results: Detection[] = [];
        setBatchProgress({ current: 0, total: files.length });
        for (let i = 0; i < files.length; i++) {
          const data = await runValidation(files[i]);
          if (data) {
            results.push(data);
            setBatchResults([...results]);
            if (i === 0) {
              setResult(data);
              setPreviewUrl(URL.createObjectURL(files[i]));
            }
          }
          setBatchProgress({ current: i + 1, total: files.length });
        }
        setBatchProgress({ current: 0, total: 0 });
        return;
      }

      if (categories.length === 0) return;
      await runBatch(files, categories, (data, file, i) => {
        batchFileMap.current.set(data.id, file);
        if (i === 0) {
          setResult(data);
          setPreviewUrl(URL.createObjectURL(file));
        }
      });
      queryClient.invalidateQueries({ queryKey: ["detections"] });
    } finally {
      stopTimer();
    }
  }, [files, categories, appMode === "validate", runValidation, runBatch, startTimer, stopTimer, queryClient]);

  const handleSelectHistory = useCallback((det: Detection) => {
    setFiles([]);
    batchFileMap.current.clear();
    setPreviewUrl(`${API_BASE}/detections/${det.id}/image`);
    setResult(det);
    setBatchResults([]);
    setCategories(parseCategories(det.categories));
    if (det.filterMode) setFilterMode(det.filterMode as FilterMode);
    else setFilterMode("all");
    if (det.filterNmsIou != null) setNmsIou(det.filterNmsIou);
    setHiddenIndices(new Set());
  }, [setBatchResults]);

  const handleReDetect = useCallback(async () => {
    if (!result) return;
    startTimer();
    try {
      let file: File;
      const cached = batchFileMap.current.get(result.id);
      if (cached) {
        file = cached;
      } else {
        const blob = await fetch(`${API_BASE}/detections/${result.id}/image`).then((r) => r.blob());
        file = new File([blob], result.imageName, { type: blob.type });
      }
      const data = await detectMut.mutateAsync({ file, categories });
      if (data) batchFileMap.current.set(data.id, file);
      setResult(data);
      setBatchResults((prev) => prev.map((r) => (r.id === result.id ? data : r)));
    } catch { /* handled by mutation */ }
    finally { stopTimer(); }
  }, [result, categories, detectMut, startTimer, stopTimer, setBatchResults]);

  const handleDrawBox = useCallback(async (raw: { x1: number; y1: number; x2: number; y2: number }) => {
    if (!result || !drawCategory.trim()) { toast.error("请先输入标注类别"); return; }
    try {
      await addBox(result.id, { ...raw, className: drawCategory.trim() });
      const newBox: BBox = { id: `manual-${Date.now()}`, className: drawCategory.trim(), ...raw, confidence: null };
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

  const handleSelectKeyframe = useCallback((files: File[]) => {
    setFiles(files);
    setPreviewUrl(files.length === 1 ? URL.createObjectURL(files[0]) : null);
    setBatchResults([]);
    setResult(null);
  }, [setBatchResults]);

  const handleBatchSelect = useCallback((det: Detection, file?: File) => {
    setResult(det);
    if (file) setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const loading = detectMut.isPending || batchProgress.total > 0 || validating;

  const displayResult = useMemo(
    () => result ? { ...result, boxes: applyFilter(filterMode, result.boxes, nmsIou) } : null,
    [result, filterMode, nmsIou],
  );


  // ── Render ───────────────────────────────────────

  return (
    <>
      <aside
        className="flex-shrink-0 border-r border-gray-200 bg-white flex flex-col gap-4 overflow-y-auto relative"
        style={{ width: 420, padding: "1rem" }}
      >
        <Segmented
          block
          value={appMode}
          onChange={(v) => { setAppMode(v as "annotate" | "validate"); setResult(null); setValidateVideoId(null); }}
          options={[
            { value: "annotate", label: "标注预训练" },
            { value: "validate", label: "YOLO 验证" },
          ]}
        />

        {appMode === "validate" && (
          <div className="space-y-2">
            <ModelSelector
              selectedJobId={selectedTrainedJobId}
              onSelectJob={setSelectedTrainedJobId}
              modelSource={validateModelSource}
              onSourceChange={setValidateModelSource}
              externalFile={externalModelFile}
              onExternalFile={setExternalModelFile}
            />
            <div className="flex gap-2 text-xs">
              <div className="flex-1">
                <div className="text-gray-500 mb-0.5">Conf</div>
                <Slider min={0.05} max={1} step={0.05} value={validateConf} onChange={setValidateConf}
                  tooltip={{ formatter: (v) => v?.toFixed(2) }} />
              </div>
              <div className="flex-1">
                <div className="text-gray-500 mb-0.5">IoU</div>
                <Slider min={0.1} max={1} step={0.05} value={validateIou} onChange={setValidateIou}
                  tooltip={{ formatter: (v) => v?.toFixed(2) }} />
              </div>
            </div>
          </div>
        )}

        <div>
          <Segmented
            block
            value={inputMode}
            onChange={(v) => { setInputMode(v as "image" | "video"); setFiles([]); setPreviewUrl(null); setBatchResults([]); }}
            options={[
              { value: "image", label: "图片" },
              { value: "video", label: "视频" },
            ]}
          />
          {inputMode === "image" ? (
            <ImageUploader onFiles={handleFiles} disabled={loading} />
          ) : (
            <VideoPanel
              onLoadKeyframes={handleSelectKeyframe}
              onValidateVideo={appMode === "validate" ? (videoId) => { setValidateVideoId(videoId); setValidateRunKey((k) => k + 1); } : undefined}
              disabled={loading}
            />
          )}
        </div>

        {!(appMode === "validate" && inputMode === "video" && validateVideoId) && (
          <>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">目标类别</p>
              <CategoryInput categories={categories} onChange={setCategories} disabled={loading} recentCategories={recentCategories} />
            </div>

            <Button type="primary" block loading={loading} size="large"
              disabled={files.length === 0 || (appMode !== "validate" && categories.length === 0)}
              onClick={handleDetect}>
              {loading ? `检测中 ${batchProgress.total > 1 ? `(${batchProgress.current}/${batchProgress.total})` : "..."}`
                : appMode === "validate" ? "YOLO 验证" : `开始检测${files.length > 1 ? ` (${files.length} 张)` : ""}`}
            </Button>
          </>
        )}

        {appMode === "validate" && inputMode === "video" && (
          <div className="text-xs text-gray-400 text-center py-2">
            {validateVideoId ? '视频推理中，调整上方 Conf/IoU 后重新点击「验证视频」' : '选择一个视频，展开后点击「验证视频」'}
          </div>
        )}

        <BatchProgress current={batchProgress.current} total={batchProgress.total} completed={batchResults.length}
          onCancel={cancelBatch} />

        {result && (
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">过滤模式</p>
            <Segmented
              block
              value={filterMode}
              onChange={(v) => { setFilterMode(v as FilterMode); setHiddenIndices(new Set()); }}
              options={[
                { value: "best", label: "最优" },
                { value: "nms", label: "去重" },
                { value: "all", label: "全部" },
              ]}
            />
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
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto p-6">
        {validateVideoId && appMode === "validate" && (
          <VideoValidator
            key={validateRunKey}
            videoId={validateVideoId}
            jobId={externalModelFile ? undefined : (selectedTrainedJobId ?? undefined)}
            modelFile={externalModelFile ?? undefined}
            conf={validateConf}
            iou={validateIou}
          />
        )}

        {!validateVideoId && !result && !loading && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            上传图片/视频并输入目标类别，点击"开始检测"
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
              onToggleVisibility={toggleBoxVisibility} isValidation={appMode === "validate"}
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
