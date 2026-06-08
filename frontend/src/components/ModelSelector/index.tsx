import { Select, Radio } from "antd";

interface Props {
  selectedJobId: string | null;
  onSelectJob: (id: string | null) => void;
  modelSource: "trained" | "upload";
  onSourceChange: (s: "trained" | "upload") => void;
  externalFile: File | null;
  onExternalFile: (f: File | null) => void;
}

export function ModelSelector({
  selectedJobId,
  onSelectJob,
  modelSource,
  onSourceChange,
  externalFile,
  onExternalFile,
}: Props) {
  const { t, i18n } = useTranslation();
  const { data: jobs } = useQuery({
    queryKey: ["training-jobs"],
    queryFn: () => fetchTrainingJobs(),
  });

  const completedJobs = (jobs?.items ?? []).filter((j: TrainingJob) => j.status === "completed");

  return (
    <div className="space-y-2">
      <Radio.Group
        value={modelSource}
        onChange={(e) => onSourceChange(e.target.value)}
        style={{ display: "flex", gap: "12px", marginBottom: "8px" }}
      >
        <Radio value="trained">{t("validationSettings.trainedModel")}</Radio>
        <Radio value="upload">{t("validationSettings.uploadModel")}</Radio>
      </Radio.Group>

      {modelSource === "trained" && (
        <Select
          placeholder={t("validationSettings.selectTrainedModel")}
          value={selectedJobId}
          onChange={onSelectJob}
          options={completedJobs.map((j) => ({
            value: j.id,
            label: `${j.modelVariant} — ${new Date(j.completedAt || j.createdAt).toLocaleString(i18n.language.startsWith("zh") ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}${j.metrics?.mAP50 != null ? ` (mAP50: ${(j.metrics.mAP50 as number).toFixed(2)})` : ""}`,
          }))}
          className="w-full"
        />
      )}

      {modelSource === "upload" && (
        <label className="flex items-center justify-between rounded border border-dashed border-gray-300 px-2.5 py-2 cursor-pointer hover:border-green-400 transition-colors">
          <span className="text-[11px] text-gray-400 truncate flex-1">
            {externalFile ? externalFile.name : t("validationSettings.selectPtModel")}
          </span>
          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
            {externalFile ? t("validationSettings.selected") : t("validationSettings.browse")}
          </span>
          <input
            type="file"
            accept=".pt"
            className="hidden"
            onChange={(e) => onExternalFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}
