import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "antd";
import type { Detection, TrainingJob } from "@/types";
import { API_BASE, BOX_COLORS, DEFAULT_BATCH, DEFAULT_EPOCHS, DEFAULT_IMGSZ } from "@/lib/constants";
import { parseCategories } from "@/lib/parsers";
import { deleteTrainingJob, fetchTrainingJobs, fetchYoloSeries, startTraining } from "@/services/api";

function downloadModelUrl(jobId: string): string {
  return `${API_BASE}/train/jobs/${jobId}/download`;
}
function downloadDatasetUrl(jobId: string): string {
  return `${API_BASE}/train/jobs/${jobId}/dataset`;
}

// ── Component ───────────────────────────────────────

interface Props {
  detections: Detection[];
}

export function TrainingPanel({ detections }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [series, setSeries] = useState("yolo26");
  const [variant, setVariant] = useState("yolo26n");
  const [epochs, setEpochs] = useState(DEFAULT_EPOCHS);
  const [imgsz, setImgsz] = useState(DEFAULT_IMGSZ);
  const [batch, setBatch] = useState(DEFAULT_BATCH);
  const [trainRatio, setTrainRatio] = useState(0.7);
  const [valRatio, setValRatio] = useState(0.2);
  const [taskType, setTaskType] = useState("detect");
  const qc = useQueryClient();

  const variantsQuery = useQuery({
    queryKey: ["yolo-variants"],
    queryFn: fetchYoloSeries,
    staleTime: Infinity,
  });

  const seriesOptions = variantsQuery.data ?? {};
  const variantOptions = seriesOptions[series]?.variants ?? {};
  const variantKeys = Object.keys(variantOptions);
  const currentVariant = variant in variantOptions ? variant : variantKeys[0] ?? variant;

  const jobsQuery = useQuery({
    queryKey: ["training-jobs"],
    queryFn: fetchTrainingJobs,
    refetchInterval: 10_000,
  });

  const trainMut = useMutation({
    mutationFn: startTraining,
    onSuccess: () => {
      toast.success("训练任务已启动");
      qc.invalidateQueries({ queryKey: ["training-jobs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const targets = trainFilter.size > 0 ? filteredDetections : detections;
    if (selected.size === targets.length && targets.every((d) => selected.has(d.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(targets.map((d) => d.id)));
    }
  };

  const handleTrain = () => {
    if (selected.size === 0) {
      toast.error("请至少选择一条检测记录");
      return;
    }
    trainMut.mutate({
      detectionIds: [...selected],
      modelVariant: currentVariant,
      epochs,
      imgsz,
      batch,
      trainRatio,
      valRatio,
      taskType,
    });
  };

  // Tag filter for training candidates
  const trainCategories = useMemo(() => {
    const count = new Map<string, number>();
    detections.forEach((d) => {
      parseCategories(d.categories).forEach((c) => count.set(c, (count.get(c) ?? 0) + 1));
    });
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [detections]);
  const [trainFilter, setTrainFilter] = useState<Set<string>>(new Set());
  const filteredDetections = trainFilter.size === 0
    ? detections
    : detections.filter((d) => parseCategories(d.categories).some((c) => trainFilter.has(c)));

  const selectedCount = selected.size;

  return (
    <div className="space-y-3">
      {/* Tag filter */}
      {trainCategories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {trainCategories.map(([name, count]) => (
            <button key={name} type="button"
              onClick={() => setTrainFilter((prev) => {
                const next = new Set(prev);
                if (next.has(name)) {
                  next.delete(name);
                } else {
                  next.add(name);
                }
                return next;
              })}
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                trainFilter.has(name) ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {name} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Selection summary */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          已选 {selectedCount}{trainFilter.size > 0 ? ` / ${filteredDetections.length}` : ""} / {detections.length} 条
        </span>
        <button type="button" onClick={selectAll}
          className="text-xs text-primary-600 hover:underline">
          {(() => {
            const targets = trainFilter.size > 0 ? filteredDetections : detections;
            return selectedCount === targets.length && targets.every((d) => selected.has(d.id))
              ? "取消全选" : "全选";
          })()}
        </button>
      </div>

      {/* Detection checklist with thumbnails */}
      <div className="max-h-44 overflow-y-auto space-y-0.5 rounded border border-gray-100 p-2">
        {filteredDetections.map((det) => (
          <label
            key={det.id}
            className="flex items-center gap-2 text-xs py-0.5 cursor-pointer hover:bg-gray-50 rounded px-1 group relative"
            onMouseEnter={(e) => {
              clearTimeout((e.currentTarget as HTMLElement).dataset._tid ? Number((e.currentTarget as HTMLElement).dataset._tid) : undefined);
              const pop = e.currentTarget.querySelector(".preview-pop") as HTMLElement;
              if (!pop) return;
              const rect = e.currentTarget.getBoundingClientRect();
              pop.style.position = "fixed";
              pop.style.left = `${rect.right + 8}px`;
              pop.style.top = `${Math.max(60, rect.top - 40)}px`;
              pop.style.zIndex = "50";
              pop.classList.remove("hidden");
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              const tid = window.setTimeout(() => {
                const pop = el.querySelector(".preview-pop") as HTMLElement;
                if (pop) pop.classList.add("hidden");
              }, 200);
              el.dataset._tid = String(tid);
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(det.id)}
              onChange={() => toggleSelect(det.id)}
              className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0"
            />
            <img src={`${API_BASE}/detections/${det.id}/image`} alt=""
              className="h-8 w-8 rounded object-cover flex-shrink-0" />
            <span className="truncate flex-1">{det.imageName}</span>
            <span className="text-gray-400 flex-shrink-0">{det.boxes.length} 目标</span>
            <div className="preview-pop hidden"
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).classList.remove("hidden")}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).classList.add("hidden")}
            >
              <TrainingPreview detection={det} />
            </div>
          </label>
        ))}
      </div>

      {/* Training params */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">系列</label>
          <select value={series} onChange={(e) => setSeries(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
            {Object.entries(seriesOptions).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">规格</label>
          <select value={currentVariant} onChange={(e) => setVariant(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
            {Object.entries(variantOptions).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Epochs</label>
          <input
            type="number"
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Image Size</label>
          <input
            type="number"
            value={imgsz}
            onChange={(e) => setImgsz(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Batch</label>
          <input
            type="number"
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">
            训练/验证/测试 ({Math.round(trainRatio * 100)}% / {Math.round(valRatio * 100)}% / {Math.max(0, Math.round((1 - trainRatio - valRatio) * 100))}%)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-10 text-right">训练</span>
            <input type="range" min={0.1} max={0.9} step={0.05} value={trainRatio}
              onChange={(e) => { const v = Number(e.target.value); setTrainRatio(v); if (v + valRatio > 1) setValRatio(1 - v); }}
              className="flex-1 h-1 accent-blue-500" />
            <span className="text-xs text-gray-600 w-8">{Math.round(trainRatio * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-10 text-right">验证</span>
            <input type="range" min={0} max={1 - trainRatio} step={0.05} value={valRatio}
              onChange={(e) => setValRatio(Number(e.target.value))}
              className="flex-1 h-1 accent-green-500" />
            <span className="text-xs text-gray-600 w-8">{Math.round(valRatio * 100)}%</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">任务类型</label>
          <Select
            value={taskType}
            onChange={setTaskType}
            options={[
              { value: "detect", label: "目标检测 (Detect)" },
              { value: "segment", label: "实例分割 (Segment)", disabled: true },
              { value: "classify", label: "图像分类 (Classify)", disabled: true },
              { value: "pose", label: "姿态估计 (Pose)", disabled: true },
              { value: "obb", label: "旋转框 (OBB)", disabled: true },
            ]}
            className="w-full"
            size="small"
          />
        </div>
      </div>

      {/* Train button */}
      <button
        type="button"
        disabled={trainMut.isPending || selectedCount === 0}
        onClick={handleTrain}
        className="w-full rounded bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {trainMut.isPending ? "启动中..." : `开始训练 YOLO (${selectedCount} 张)`}
      </button>

      {/* Job history */}
      {jobsQuery.data && jobsQuery.data.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">训练任务</p>
          <div className="space-y-1">
            {jobsQuery.data.map((job) => (
              <TrainingJobItem key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrainingJobItem({ job }: { job: TrainingJob }) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<{
    epoch: number; totalEpochs: number; loss: number; mAP50?: number; mAP50_95?: number;
  } | null>(null);

  useEffect(() => {
    if (job.status !== "running" && job.status !== "pending") return;
    const es = new EventSource(`${API_BASE}/train/jobs/${job.id}/progress/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data);
        if (data.epoch >= data.totalEpochs && data.totalEpochs > 0) {
          es.close();
          qc.invalidateQueries({ queryKey: ["training-jobs"] });
        }
      } catch {
        setProgress(null);
      }
    };
    es.onerror = () => { es.close(); };
    return () => es.close();
  }, [job.id, job.status, qc]);

  return (
    <div className="rounded border border-gray-100 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">{job.modelVariant}</span>
        <StatusBadge status={job.status} />
      </div>

      {(job.status === "pending" || job.status === "running") && (
        progress && progress.totalEpochs > 0 ? (
          <div className="mt-1.5 space-y-1">
            <div className="flex justify-between text-gray-400">
              <span>Epoch {progress.epoch}/{progress.totalEpochs}</span>
              <span>{Math.round((progress.epoch / progress.totalEpochs) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(progress.epoch / progress.totalEpochs) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Loss: {progress.loss.toFixed(3)}</span>
              {progress.mAP50 != null && <span>mAP50: {progress.mAP50.toFixed(3)}</span>}
            </div>
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-2 text-gray-400">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            等待训练开始...
          </div>
        )
      )}

      {(job.status === "completed" || job.status === "failed") && (
        <>
          {job.status === "completed" && job.metrics && (
            <div className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-gray-400">mAP50</span>
              <span className="text-gray-400">mAP50-95</span>
              <span className="text-gray-400">Precision</span>
              <span className="font-medium">{(job.metrics.mAP50 as number)?.toFixed(3) ?? "-"}</span>
              <span className="font-medium">{(job.metrics["mAP50-95"] as number)?.toFixed(3) ?? "-"}</span>
              <span className="font-medium">{(job.metrics.precision as number)?.toFixed(3) ?? "-"}</span>
              <span className="text-gray-400">Recall</span>
              <span className="text-gray-400">样本</span>
              <span className="text-gray-400">类别</span>
              <span className="font-medium">{(job.metrics.recall as number)?.toFixed(3) ?? "-"}</span>
              <span className="font-medium">{String(job.metrics.num_samples ?? "-")}</span>
              <span className="font-medium">{String(job.metrics.num_classes ?? "-")}</span>
            </div>
          )}
          <div className="mt-1.5 flex gap-3">
            {job.status === "completed" && (
              <>
                <a href={downloadModelUrl(job.id)} download className="text-primary-600 hover:underline font-medium">模型</a>
                <a href={downloadDatasetUrl(job.id)} download className="text-primary-600 hover:underline font-medium">数据集</a>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("yolo-validate", {
                      detail: { jobId: job.id, modelVariant: job.modelVariant }
                    }));
                  }}
                  className="text-green-600 hover:underline font-medium"
                >
                  验证
                </button>
              </>
            )}
            <button
              onClick={() => {
                if (confirm("确定删除该训练任务吗？此操作不可撤销。")) {
                  deleteTrainingJob(job.id)
                    .then(() => qc.invalidateQueries({ queryKey: ["training-jobs"] }))
                    .catch(() => toast.error("删除失败"));
                }
              }}
              className="text-red-400 hover:text-red-600 font-medium"
            >
              删除
            </button>
          </div>
        </>
      )}

      {job.status === "failed" && job.errorMessage && (
        <p className="mt-1 text-red-500">{job.errorMessage}</p>
      )}
    </div>
  );
}

function TrainingPreview({ detection }: { detection: Detection }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Build className → color map at component level (used by both canvas and chips)
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
        const x = box.x1 * scale, y = box.y1 * scale;
        const w = (box.x2 - box.x1) * scale, h = (box.y2 - box.y1) * scale;
        const color = colorMap.get(box.className)!;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
        ctx.font = "10px system-ui";
        const tw = ctx.measureText(box.className).width + 4;
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 14, tw, 14);
        ctx.fillStyle = "#fff";
        ctx.fillText(box.className, x + 2, y - 4);
      });
    };
  }, [colorMap, detection]);

  return (
    <div className="w-[min(520px,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-gray-700">{detection.imageName}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">{detection.boxes.length} 个目标</p>
        </div>
        {(() => {
          const cats = new Set<string>();
          detection.boxes.forEach((b) => cats.add(b.className));
          parseCategories(detection.categories).forEach((c) => cats.add(c));
          if (cats.size === 0) return null;
          return (
            <div className="flex max-w-56 flex-wrap justify-end gap-1">
              {[...cats].map((name) => (
                <span key={name}
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${colorMap.get(name) ?? BOX_COLORS[0]}20`, color: colorMap.get(name) ?? BOX_COLORS[0] }}
                >
                  {name}
                </span>
              ))}
            </div>
          );
        })()}
      </div>
      <canvas
        ref={canvasRef}
        className="block max-w-full rounded-md border border-gray-100 bg-gray-50"
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "text-gray-400",
    running: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
  };
  const labels: Record<string, string> = {
    pending: "等待中",
    running: "训练中",
    completed: "已完成",
    failed: "失败",
  };
  return <span className={map[status] ?? "text-gray-400"}>{labels[status] ?? status}</span>;
}
