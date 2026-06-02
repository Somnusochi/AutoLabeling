import {Select} from "antd";


interface Props {
  selectedJobId: string | null;
  onSelectJob: (id: string | null) => void;
  modelSource: "trained" | "upload";
  onSourceChange: (s: "trained" | "upload") => void;
  externalFile: File | null;
  onExternalFile: (f: File | null) => void;
}

export function ModelSelector({ selectedJobId, onSelectJob, modelSource, onSourceChange, externalFile, onExternalFile }: Props) {
  const { data: jobs } = useQuery({
    queryKey: ["training-jobs"],
    queryFn: fetchTrainingJobs,
  });

  const completedJobs = (jobs ?? []).filter((j) => j.status === "completed");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="radio" checked={modelSource === "trained"}
            onChange={() => onSourceChange("trained")} className="h-3 w-3" />
          <span className="text-gray-600">已训练模型</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="radio" checked={modelSource === "upload"}
            onChange={() => onSourceChange("upload")} className="h-3 w-3" />
          <span className="text-gray-600">上传模型</span>
        </label>
      </div>

      {modelSource === "trained" && (
        <Select
          placeholder="选择已训练的模型"
          value={selectedJobId}
          onChange={onSelectJob}
          options={completedJobs.map((j) => ({
            value: j.id,
            label: `${j.modelVariant} — ${new Date(j.completedAt || j.createdAt).toLocaleString("zh-CN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}${j.metrics?.mAP50 != null ? ` (mAP50: ${(j.metrics.mAP50 as number).toFixed(2)})` : ""}`,
          }))}
          className="w-full"
        />
      )}

      {modelSource === "upload" && (
        <label className="flex items-center justify-between rounded border border-dashed border-gray-300 px-2.5 py-2 cursor-pointer hover:border-green-400 transition-colors">
          <span className="text-[11px] text-gray-400 truncate flex-1">
            {externalFile ? externalFile.name : "选择 .pt 模型文件"}
          </span>
          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
            {externalFile ? "已选择" : "浏览"}
          </span>
          <input type="file" accept=".pt" className="hidden"
            onChange={(e) => onExternalFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
    </div>
  );
}
