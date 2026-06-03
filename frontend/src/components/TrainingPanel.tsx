import {Modal, Select} from "antd";





// ── Component ───────────────────────────────────────

interface Props {
  detections: Detection[];
}

export function TrainingPanel({ detections }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [series, setSeries] = useState("yolo26");
  const [variant, setVariant] = useState("yolo26n");
  const [epochs, setEpochs] = useState(DEFAULT_EPOCHS);
  const [imgsz, setImgsz] = useState(DEFAULT_IMGSZ);
  const [batch, setBatch] = useState(DEFAULT_BATCH);
  const [splitPreset, setSplitPreset] = useState("70/20/10");
  const [taskType, setTaskType] = useState("detect");

  const splitPresets: Record<string, { train: number; val: number }> = {
    "70 / 20 / 10": { train: 0.7, val: 0.2 },
    "80 / 20":      { train: 0.8, val: 0.2 },
    "90 / 10":      { train: 0.9, val: 0.1 },
    "60 / 20 / 20": { train: 0.6, val: 0.2 },
  };
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
      toast.success(t("trainingPanel.trainStarted"));
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
      toast.error(t("trainingPanel.selectRecordRequired"));
      return;
    }
    const p = splitPresets[splitPreset] ?? { train: 0.7, val: 0.2 };
    trainMut.mutate({
      detectionIds: [...selected],
      modelVariant: currentVariant,
      epochs,
      imgsz,
      batch,
      trainRatio: p.train,
      valRatio: p.val,
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

  const [hoveredDetId, setHoveredDetId] = useState<string | null>(null);
  const [hoveredRect, setHoveredRect] = useState<{ right: number; top: number } | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

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
          {t("trainingPanel.selectedCountTotal", {
            current: selectedCount,
            filtered: trainFilter.size > 0 ? ` / ${filteredDetections.length}` : "",
            total: detections.length,
          })}
        </span>
        <button type="button" onClick={selectAll}
          className="text-xs text-primary-600 hover:underline">
          {(() => {
            const targets = trainFilter.size > 0 ? filteredDetections : detections;
            return selectedCount === targets.length && targets.every((d) => selected.has(d.id))
              ? t("trainingPanel.deselectAll") : t("trainingPanel.selectAll");
          })()}
        </button>
      </div>

      {/* Detection checklist with thumbnails */}
      <div className="max-h-44 overflow-y-auto rounded border border-gray-100 p-2 space-y-1">
        {filteredDetections.map((det) => (
          <label
            key={det.id}
            className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-gray-50 rounded px-1 group"
            onMouseEnter={(e) => {
              if (leaveTimerRef.current) {
                clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = null;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              setHoveredDetId(det.id);
              setHoveredRect({ right: rect.right, top: rect.top });
            }}
            onMouseLeave={() => {
              leaveTimerRef.current = window.setTimeout(() => {
                setHoveredDetId(null);
                setHoveredRect(null);
              }, 150);
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(det.id)}
              onChange={() => toggleSelect(det.id)}
              className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0"
            />
            <img
              src={`${API_BASE}/detections/${det.id}/image`}
              alt=""
              loading="lazy"
              className="h-8 w-8 rounded object-cover flex-shrink-0"
            />
            <span className="truncate flex-1">{det.imageName}</span>
            <span className="text-gray-400 flex-shrink-0">
              {t("trainingPanel.targetsCount", { count: det.boxes.length })}
            </span>
          </label>
        ))}
      </div>

      {/* Global single-instance hover preview popup */}
      {hoveredDetId && hoveredRect && (() => {
        const det = filteredDetections.find((d) => d.id === hoveredDetId);
        if (!det) return null;
        return (
          <div
            className="fixed z-50"
            style={{
              left: `${hoveredRect.right + 8}px`,
              top: `${Math.max(60, hoveredRect.top - 40)}px`,
            }}
            onMouseEnter={() => {
              if (leaveTimerRef.current) {
                clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = null;
              }
            }}
            onMouseLeave={() => {
              leaveTimerRef.current = window.setTimeout(() => {
                setHoveredDetId(null);
                setHoveredRect(null);
              }, 150);
            }}
          >
            <TrainingPreview detection={det} />
          </div>
        );
      })()}

      {/* Training params */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t("trainingPanel.series")}</label>
          <select value={series} onChange={(e) => setSeries(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
            {Object.entries(seriesOptions).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">{t("trainingPanel.specification")}</label>
          <select value={currentVariant} onChange={(e) => setVariant(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
            {Object.entries(variantOptions).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">{t("trainingPanel.epochs")}</label>
          <input
            type="number"
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t("trainingPanel.imgsz")}</label>
          <input
            type="number"
            value={imgsz}
            onChange={(e) => setImgsz(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t("trainingPanel.batch")}</label>
          <input
            type="number"
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value))}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">
            {t("trainingPanel.splitRatio", {
              test: splitPreset.split("/").length >= 3 ? t("trainingPanel.splitRatioTest") : "",
            })}
          </label>
          <Select
            value={splitPreset}
            onChange={setSplitPreset}
            options={Object.keys(splitPresets).map((k) => ({ value: k, label: k }))}
            className="w-full"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">{t("trainingPanel.taskType")}</label>
          <Select
            value={taskType}
            onChange={setTaskType}
            options={[
              { value: "detect", label: t("trainingPanel.taskDetect") },
              { value: "segment", label: t("trainingPanel.taskSegment"), disabled: true },
              { value: "classify", label: t("trainingPanel.taskClassify"), disabled: true },
              { value: "pose", label: t("trainingPanel.taskPose"), disabled: true },
              { value: "obb", label: t("trainingPanel.taskObb"), disabled: true },
            ]}
            className="w-full"
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
        {trainMut.isPending ? t("trainingPanel.starting") : t("trainingPanel.startTrainCount", { count: selectedCount })}
      </button>

      {/* Job history */}
      {jobsQuery.data && jobsQuery.data.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">{t("trainingPanel.trainJobs")}</p>
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
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [chartOpen, setChartOpen] = useState(false);
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
        <div>
          <span className="font-medium">{job.modelVariant}</span>
          {job.completedAt && (
            <span className="text-gray-400 ml-2">
              {new Date(job.completedAt).toLocaleString(i18n.language.startsWith("zh") ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
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
            {t("trainingPanel.waitingToStart")}
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
              <span className="text-gray-400">{t("trainingPanel.samples")}</span>
              <span className="text-gray-400">{t("trainingPanel.classes")}</span>
              <span className="font-medium">{(job.metrics.recall as number)?.toFixed(3) ?? "-"}</span>
              <span className="font-medium">{String(job.metrics.num_samples ?? "-")}</span>
              <span className="font-medium">{String(job.metrics.num_classes ?? "-")}</span>
            </div>
          )}
          <div className="mt-1.5 flex gap-3">
            {job.status === "completed" && (
              <>
                <a href={downloadModelUrl(job.id)} download className="text-primary-600 hover:underline font-medium">{t("trainingPanel.model")}</a>
                <a href={downloadDatasetUrl(job.id)} download className="text-primary-600 hover:underline font-medium">{t("trainingPanel.dataset")}</a>
                <a href={downloadOnnxUrl(job.id)} className="text-primary-600 hover:underline font-medium">ONNX</a>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("yolo-validate", {
                      detail: { jobId: job.id, modelVariant: job.modelVariant }
                    }));
                  }}
                  className="text-green-600 hover:underline font-medium"
                >
                  {t("common.validate")}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const resp = await fetch(`${API_BASE}/train/jobs/${job.id}/retrain`, { method: "POST" });
                      if (resp.ok) { toast.success(t("trainingPanel.retrainCreated")); qc.invalidateQueries({ queryKey: ["training-jobs"] }); }
                      else { toast.error(t("trainingPanel.retrainFailed")); }
                    } catch { toast.error(t("trainingPanel.retrainFailed")); }
                  }}
                  className="text-orange-500 hover:text-orange-600 font-medium"
                >{t("trainingPanel.retrain")}</button>
                <button onClick={() => setChartOpen(true)} className="text-gray-500 hover:text-gray-700 font-medium">{t("trainingPanel.details")}</button>
              </>
            )}
            <button
              onClick={() => {
                if (confirm(t("trainingPanel.deleteJobConfirm"))) {
                  deleteTrainingJob(job.id)
                    .then(() => qc.invalidateQueries({ queryKey: ["training-jobs"] }))
                    .catch(() => toast.error(t("trainingPanel.deleteFailed")));
                }
              }}
              className="text-red-400 hover:text-red-600 font-medium"
            >
              {t("common.delete")}
            </button>
          </div>
          <Modal open={chartOpen} onCancel={() => setChartOpen(false)} footer={null} width={800} title={t("trainingPanel.chartModalTitle")}>
            <img src={chartUrl(job.id)} alt={t("trainingPanel.chartModalTitle")} className="w-full" />
          </Modal>
        </>
      )}

      {job.status === "failed" && job.errorMessage && (
        <p className="mt-1 text-red-500">{job.errorMessage}</p>
      )}
    </div>
  );
}

function TrainingPreview({ detection }: { detection: Detection }) {
  const { t } = useTranslation();
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
          <p className="mt-0.5 text-[11px] text-gray-400">{t("trainingPanel.targetsCount", { count: detection.boxes.length })}</p>
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
  const { t } = useTranslation();
  const map: Record<string, string> = {
    pending: "text-gray-400",
    running: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
  };
  const labels: Record<string, string> = {
    pending: t("trainingPanel.statusPending"),
    running: t("trainingPanel.statusRunning"),
    completed: t("trainingPanel.statusCompleted"),
    failed: t("trainingPanel.statusFailed"),
  };
  return <span className={map[status] ?? "text-gray-400"}>{labels[status] ?? status}</span>;
}
