import { Modal, Popconfirm, Popover } from "antd";
import { StatusBadge } from "../StatusBadge";

export function TrainingJobItem({ job }: { job: TrainingJob }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(job.name || "");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{
    epoch: number;
    totalEpochs: number;
    loss: number;
    mAP50?: number;
    mAP50_95?: number;
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
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [job.id, job.status, qc]);

  return (
    <div className="rounded border border-gray-100 p-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={async () => {
                setEditingName(false);
                const trimmed = nameValue.trim();
                if (trimmed !== (job.name || "")) {
                  try {
                    await renameTrainingJob(job.id, trimmed);
                    qc.invalidateQueries({ queryKey: ["training-jobs"] });
                  } catch { /* ignore */ }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setNameValue(job.name || "");
                  setEditingName(false);
                }
              }}
              className="text-xs font-medium border border-primary-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary-400 max-w-[160px]"
              maxLength={128}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="font-medium cursor-pointer hover:text-primary-600 truncate max-w-[200px]"
              onClick={() => {
                setNameValue(job.name || "");
                setEditingName(true);
                setTimeout(() => nameInputRef.current?.select(), 0);
              }}
              title={t("trainingPanel.clickToRename")}
            >
              {job.name || job.modelVariant}
            </span>
          )}
          {job.completedAt && (
            <span className="text-gray-400 ml-2">
              {new Date(job.completedAt).toLocaleString(
                i18n.language.startsWith("zh") ? "zh-CN" : "en-US",
                {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </span>
          )}
        </div>
        <StatusBadge status={job.status} />
      </div>

      {(job.status === "pending" || job.status === "running") && (
        <div className="mt-1.5 flex items-center justify-between">
          {progress && progress.totalEpochs > 0 ? (
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-gray-400">
                <span>
                  Epoch {progress.epoch}/{progress.totalEpochs}
                </span>
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
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {t("trainingPanel.waitingToStart")}
            </div>
          )}
          <Popconfirm
            title={t("trainingPanel.cancelJobConfirm")}
            onConfirm={async () => {
              setCancelling(true);
              try {
                await cancelTrainingJob(job.id);
                qc.invalidateQueries({ queryKey: ["training-jobs"] });
              } catch {
                toast.error(t("trainingPanel.cancelFailed"));
              } finally {
                setCancelling(false);
              }
            }}
            okText={t("common.cancel")}
            cancelText={t("common.close")}
            okButtonProps={{ danger: true }}
          >
            <button
              type="button"
              disabled={cancelling}
              className="text-[10px] text-red-400 hover:text-red-600 disabled:opacity-50 flex-shrink-0 ml-2"
            >
              {cancelling ? t("common.cancelling") : t("common.cancel")}
            </button>
          </Popconfirm>
        </div>
      )}

      {(job.status === "completed" || job.status === "failed") && (
        <>
          {job.status === "completed" && job.metrics && (
            <div className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-gray-400">mAP50</span>
              <span className="text-gray-400">mAP50-95</span>
              <span className="text-gray-400">Precision</span>
              <span className="font-medium">
                {(job.metrics.mAP50 as number)?.toFixed(3) ?? "-"}
              </span>
              <span className="font-medium">
                {(job.metrics["mAP50-95"] as number)?.toFixed(3) ?? "-"}
              </span>
              <span className="font-medium">
                {(job.metrics.precision as number)?.toFixed(3) ?? "-"}
              </span>
              <span className="text-gray-400">Recall</span>
              <span className="text-gray-400">{t("trainingPanel.samples")}</span>
              <span className="text-gray-400">{t("trainingPanel.classes")}</span>
              <span className="font-medium">
                {(job.metrics.recall as number)?.toFixed(3) ?? "-"}
              </span>
              <span className="font-medium">{String(job.metrics.num_samples ?? "-")}</span>
              <span className="font-medium">
                {(() => {
                  const cMap = (job.metrics?.class_map as Record<string, string>) || job.classMap;
                  if (cMap && Object.values(cMap).length > 0) {
                    return (
                      <Popover
                        content={
                          <div className="max-w-[200px] flex flex-wrap gap-1">
                            {Object.values(cMap).map((cat) => (
                              <span
                                key={cat}
                                className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        }
                        title={null}
                        trigger="hover"
                        placement="top"
                      >
                        <span className="cursor-pointer border-b border-dashed border-gray-300 text-primary-600">
                          {String(job.metrics?.num_classes ?? "-")}
                        </span>
                      </Popover>
                    );
                  }
                  return String(job.metrics?.num_classes ?? "-");
                })()}
              </span>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {job.status === "completed" && (
              <>
                <a
                  href={downloadModelUrl(job.id)}
                  download
                  className="text-primary-600 hover:underline font-medium"
                >
                  {t("trainingPanel.model")}
                </a>
                <a
                  href={downloadDatasetUrl(job.id)}
                  download
                  className="text-primary-600 hover:underline font-medium"
                >
                  {t("trainingPanel.dataset")}
                </a>
                <a
                  href={downloadOnnxUrl(job.id)}
                  className="text-primary-600 hover:underline font-medium"
                >
                  ONNX
                </a>
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("yolo-validate", {
                        detail: { jobId: job.id, modelVariant: job.modelVariant },
                      }),
                    );
                  }}
                  className="text-green-600 hover:underline font-medium"
                >
                  {t("common.validate")}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const resp = await fetch(`${API_BASE}/train/jobs/${job.id}/retrain`, {
                        method: "POST",
                      });
                      if (resp.ok) {
                        toast.success(t("trainingPanel.retrainCreated"));
                        qc.invalidateQueries({ queryKey: ["training-jobs"] });
                      } else {
                        toast.error(t("trainingPanel.retrainFailed"));
                      }
                    } catch {
                      toast.error(t("trainingPanel.retrainFailed"));
                    }
                  }}
                  className="text-orange-500 hover:text-orange-600 font-medium"
                >
                  {t("trainingPanel.retrain")}
                </button>
                <button
                  onClick={() => setChartOpen(true)}
                  className="text-gray-500 hover:text-gray-700 font-medium"
                >
                  {t("trainingPanel.details")}
                </button>
              </>
            )}
            <Popconfirm
              title={t("trainingPanel.deleteJobConfirm")}
              onConfirm={() =>
                deleteTrainingJob(job.id)
                  .then(() => qc.invalidateQueries({ queryKey: ["training-jobs"] }))
                  .catch(() => toast.error(t("trainingPanel.deleteFailed")))
              }
              okText={t("common.delete")}
              cancelText={t("common.cancel")}
              okButtonProps={{ danger: true }}
            >
              <button className="text-red-400 hover:text-red-600 font-medium">
                {t("common.delete")}
              </button>
            </Popconfirm>
          </div>
          <Modal
            open={chartOpen}
            onCancel={() => setChartOpen(false)}
            footer={null}
            width={800}
            title={t("trainingPanel.chartModalTitle")}
          >
            <img
              src={chartUrl(job.id)}
              alt={t("trainingPanel.chartModalTitle")}
              className="w-full"
            />
          </Modal>
        </>
      )}

      {job.status === "failed" && job.errorMessage && (
        <p className="mt-1 text-red-500">{job.errorMessage}</p>
      )}
    </div>
  );
}
