import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Detection, TrainingJob } from "@/types";
import { API_BASE } from "@/lib/constants";

// ── API helpers (inline to avoid circular deps) ─────

async function startTraining(params: {
  detection_ids: string[];
  model_variant: string;
  epochs: number;
  imgsz: number;
  batch: number;
}): Promise<TrainingJob> {
  const res = await fetch(`${API_BASE}/train/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "训练请求失败");
  return json.data;
}

async function fetchJobs(): Promise<TrainingJob[]> {
  const res = await fetch(`${API_BASE}/train/jobs`);
  const json = await res.json();
  return json.data?.items ?? [];
}

function downloadModelUrl(jobId: string): string {
  return `${API_BASE}/train/jobs/${jobId}/download`;
}

// ── Component ───────────────────────────────────────

interface Props {
  detections: Detection[];
}

export function TrainingPanel({ detections }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [series, setSeries] = useState("yolo26");
  const [variant, setVariant] = useState("yolo26n");
  const [epochs, setEpochs] = useState(100);
  const [imgsz, setImgsz] = useState(640);
  const [batch, setBatch] = useState(16);
  const qc = useQueryClient();

  const variantsQuery = useQuery({
    queryKey: ["yolo-variants"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/train/variants`);
      const json = await res.json();
      return json.data as Record<string, { label: string; variants: Record<string, string> }>;
    },
    staleTime: Infinity,
  });

  const seriesOptions = variantsQuery.data ?? {};
  const variantOptions = seriesOptions[series]?.variants ?? {};

  // Reset variant when series changes
  useEffect(() => {
    const variants = Object.keys(variantOptions);
    if (variants.length > 0 && !(variant in variantOptions)) {
      setVariant(variants[0]);
    }
  }, [series]);  // eslint-disable-line react-hooks/exhaustive-deps

  const jobsQuery = useQuery({
    queryKey: ["training-jobs"],
    queryFn: fetchJobs,
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
      next.has(id) ? next.delete(id) : next.add(id);
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
      detection_ids: [...selected],
      model_variant: variant,
      epochs,
      imgsz,
      batch,
    });
  };

  // Tag filter for training candidates
  const trainCategories = useMemo(() => {
    const count = new Map<string, number>();
    detections.forEach((d) => {
      try { (JSON.parse(d.categories) as string[]).forEach((c) => count.set(c, (count.get(c) ?? 0) + 1)); } catch {}
    });
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [detections]);
  const [trainFilter, setTrainFilter] = useState<Set<string>>(new Set());
  const filteredDetections = useMemo(() => {
    if (trainFilter.size === 0) return detections;
    return detections.filter((d) => {
      try { return (JSON.parse(d.categories) as string[]).some((c) => trainFilter.has(c)); } catch { return false; }
    });
  }, [detections, trainFilter]);

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
                next.has(name) ? next.delete(name) : next.add(name);
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
            <span className="truncate flex-1">{det.image_name}</span>
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
          <select value={variant} onChange={(e) => setVariant(e.target.value)}
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
    epoch: number; total_epochs: number; loss: number; mAP50?: number; mAP50_95?: number;
  } | null>(null);

  useEffect(() => {
    if (job.status !== "running") return;
    const es = new EventSource(`${API_BASE}/train/jobs/${job.id}/progress/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data);
        if (data.epoch >= data.total_epochs && data.total_epochs > 0) {
          es.close();
          qc.invalidateQueries({ queryKey: ["training-jobs"] });
        }
      } catch {}
    };
    es.onerror = () => { es.close(); };
    return () => es.close();
  }, [job.id, job.status, qc]);

  return (
    <div className="rounded border border-gray-100 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">{job.model_variant}</span>
        <StatusBadge status={job.status} />
      </div>

      {job.status === "running" && (
        progress && progress.total_epochs > 0 ? (
          <div className="mt-1.5 space-y-1">
            <div className="flex justify-between text-gray-400">
              <span>Epoch {progress.epoch}/{progress.total_epochs}</span>
              <span>{Math.round((progress.epoch / progress.total_epochs) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(progress.epoch / progress.total_epochs) * 100}%` }}
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
        <div className="mt-1 flex gap-3">
          {job.status === "completed" && (
            <>
              <a href={downloadModelUrl(job.id)} download className="text-primary-600 hover:underline font-medium">下载</a>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("yolo-validate", {
                    detail: { jobId: job.id, modelVariant: job.model_variant }
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
                fetch(`${API_BASE}/train/jobs/${job.id}/delete`, { method: "POST" })
                  .then(() => qc.invalidateQueries({ queryKey: ["training-jobs"] }))
                  .catch(() => toast.error("删除失败"));
              }
            }}
            className="text-red-400 hover:text-red-600 font-medium"
          >
            删除
          </button>
        </div>
      )}

      {job.status === "failed" && job.error_message && (
        <p className="mt-1 text-red-500">{job.error_message}</p>
      )}
    </div>
  );
}

function TrainingPreview({ detection }: { detection: Detection }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.src = `${API_BASE}/detections/${detection.id}/image`;
    img.onload = () => {
      const maxW = 420;
      const scale = Math.min(maxW / img.naturalWidth, 320 / img.naturalHeight, 1);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      detection.boxes.forEach((box, i) => {
        const x = box.x1 * scale, y = box.y1 * scale;
        const w = (box.x2 - box.x1) * scale, h = (box.y2 - box.y1) * scale;
        const color = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B"][i % 4];
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
        ctx.font = "10px system-ui";
        const tw = ctx.measureText(box.class_name).width + 4;
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 14, tw, 14);
        ctx.fillStyle = "#fff";
        ctx.fillText(box.class_name, x + 2, y - 4);
      });
    };
  }, [detection]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded shadow-lg border border-gray-200 bg-white"
    />
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
