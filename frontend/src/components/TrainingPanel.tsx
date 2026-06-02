import { useEffect, useState } from "react";
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
  const [variant, setVariant] = useState("yolo26n");
  const [epochs, setEpochs] = useState(100);
  const [imgsz, setImgsz] = useState(640);
  const [batch, setBatch] = useState(16);
  const qc = useQueryClient();

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
    if (selected.size === detections.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(detections.map((d) => d.id)));
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

  const selectedCount = selected.size;

  return (
    <div className="space-y-3">
      {/* Selection summary */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          已选 {selectedCount} / {detections.length} 条
        </span>
        <button
          type="button"
          onClick={selectAll}
          className="text-xs text-primary-600 hover:underline"
        >
          {selectedCount === detections.length ? "取消全选" : "全选"}
        </button>
      </div>

      {/* Detection checklist */}
      <div className="max-h-40 overflow-y-auto space-y-0.5 rounded border border-gray-100 p-2">
        {detections.map((det) => (
          <label
            key={det.id}
            className="flex items-center gap-2 text-xs py-0.5 cursor-pointer hover:bg-gray-50 rounded px-1"
          >
            <input
              type="checkbox"
              checked={selected.has(det.id)}
              onChange={() => toggleSelect(det.id)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            <span className="truncate flex-1">{det.image_name}</span>
            <span className="text-gray-400">{det.boxes.length} 目标</span>
          </label>
        ))}
      </div>

      {/* Training params */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">模型</label>
          <select
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="yolo26n">YOLOv26 Nano</option>
            <option value="yolo26s">YOLOv26 Small</option>
            <option value="yolo26m">YOLOv26 Medium</option>
            <option value="yolo26l">YOLOv26 Large</option>
            <option value="yolo26x">YOLOv26 XLarge</option>
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

      {job.status === "completed" && (
        <div className="mt-1 flex gap-3">
          <a href={downloadModelUrl(job.id)} download className="text-primary-600 hover:underline font-medium">
            下载 .pt
          </a>
          <button
            onClick={() => {
              // Notify parent to switch to YOLO validation mode
              window.dispatchEvent(new CustomEvent("yolo-validate", {
                detail: { jobId: job.id, modelVariant: job.model_variant }
              }));
            }}
            className="text-green-600 hover:underline font-medium"
          >
            验证
          </button>
        </div>
      )}

      {job.status === "failed" && job.error_message && (
        <p className="mt-1 text-red-500">{job.error_message}</p>
      )}
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
