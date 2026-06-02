import { useQuery } from "@tanstack/react-query";
import { Radio, Select, Upload, Button } from "antd";
import { UploadOutlined } from "@ant-design/icons";
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
      <Radio.Group value={modelSource} onChange={(e) => onSourceChange(e.target.value)} size="small"
        optionType="button" buttonStyle="solid" block>
        <Radio.Button value="trained">已训练模型</Radio.Button>
        <Radio.Button value="upload">上传模型</Radio.Button>
      </Radio.Group>

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
        <Upload accept=".pt" maxCount={1} showUploadList={false}
          beforeUpload={(f) => { onExternalFile(f); return false; }}>
          <Button size="small" icon={<UploadOutlined />} block>
            {externalFile ? externalFile.name : "选择 .pt 文件"}
          </Button>
        </Upload>
      )}
    </div>
  );
}
