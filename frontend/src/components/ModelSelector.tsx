import { useQuery } from "@tanstack/react-query";
import { Select } from "antd";
import { fetchTrainingJobs } from "@/services/api";

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
            label: `${j.modelVariant} (${new Date(j.createdAt).toLocaleDateString("zh-CN")})`,
          }))}
          className="w-full"
          size="small"
        />
      )}

      {modelSource === "upload" && (
        <div>
          <input type="file" accept=".pt" className="text-[10px]"
            onChange={(e) => onExternalFile(e.target.files?.[0] ?? null)} />
          {externalFile && <div className="text-green-700 text-[10px] mt-0.5">{externalFile.name}</div>}
        </div>
      )}
    </div>
  );
}
