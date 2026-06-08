import { Select, Modal } from "antd";

const FORMATS = [
  { value: "yolo", label: "YOLO" },
  { value: "yolo-seg", label: "YOLO Segmentation" },
  { value: "coco", label: "COCO JSON" },
  { value: "voc", label: "Pascal VOC" },
  { value: "createml", label: "CreateML JSON" },
];

type UploadStatus = "idle" | "uploading" | "assembling" | "importing" | "completed" | "failed";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB

export function DatasetImportModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [fmt, setFmt] = useState("yolo");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 0 });
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ total: 0, completed: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup ──────────────────────────────────────
  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setFile(null);
    setStatus("idle");
    setError(null);
    setChunkProgress({ current: 0, total: 0 });
    setUploadId(null);
    setImportProgress({ total: 0, completed: 0 });
  }, []);

  useEffect(() => () => {
    workerRef.current?.terminate();
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // ── File selection ───────────────────────────────
  const handleFile = useCallback((f: File | null) => {
    setError(null);
    if (f && !f.name.endsWith(".zip")) {
      setError(t("datasetImport.invalidZip"));
      return;
    }
    if (f && f.size > MAX_FILE_SIZE) {
      setError(t("datasetImport.fileTooLarge"));
      return;
    }
    setFile(f);
    setStatus("idle");
    setChunkProgress({ current: 0, total: 0 });
    setUploadId(null);
  }, [t]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0] ?? null);
  }, [handleFile]);

  // ── Worker upload ────────────────────────────────
  const pollImport = useCallback((importId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const p = await fetchImportProgress(importId);
        setImportProgress({ total: p.total, completed: p.completed });
        if (p.status === "completed") {
          setStatus("completed");
          if (pollRef.current) clearInterval(pollRef.current);
          qc.invalidateQueries({ queryKey: ["detections"] });
          toast.success(t("datasetImport.importSuccess", { count: p.total }));
        } else if (p.status === "failed") {
          setStatus("failed");
          setError(p.error || t("datasetImport.importFailed"));
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* polling error */ }
    }, 500);
  }, [qc, t]);


  const startUpload = useCallback(() => {
    if (!file) return;
    setStatus("uploading");
    setError(null);

    const worker = new Worker(
      new URL("@/workers/uploadChunks.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case "progress":
          setChunkProgress({ current: msg.chunk + 1, total: msg.totalChunks });
          break;
        case "complete":
          setUploadId(msg.uploadId);
          setStatus("assembling");
          // Signal backend to assemble and import
          importChunkComplete(msg.uploadId, fmt).then((result) => {
            setUploadId(result.importId);
            setStatus("importing");
            pollImport(result.importId);
          }).catch((err) => {
            setStatus("failed");
            setError(err instanceof Error ? err.message : t("datasetImport.importFailed"));
          });
          break;
        case "error":
          setStatus("failed");
          setError(msg.message);
          break;
        case "cancelled":
          setStatus("idle");
          break;
      }
    };

    worker.onerror = () => {
      setStatus("failed");
      setError(t("datasetImport.importFailed"));
    };

    worker.postMessage({ type: "upload", file, format: fmt });
  }, [file, fmt, t, pollImport]);


  const handleCancel = useCallback(async () => {
    workerRef.current?.postMessage({ type: "cancel" });
    if (uploadId) {
      try {
        if (status === "uploading" || status === "assembling") {
          await importChunkCancel(uploadId);
        } else {
          await cancelImport(uploadId);
        }
      } catch { /* ignore */ }
    }
    reset();
  }, [uploadId, status, reset]);

  const handleClose = useCallback(() => {
    if (status === "uploading" || status === "importing") return;
    reset();
    onClose();
  }, [status, onClose, reset]);

  // ── Render helpers ───────────────────────────────
  const showProgress = status === "uploading" || status === "assembling" || status === "importing";
  const isBusy = status === "uploading" || status === "assembling" || status === "importing";

  const progressLabel = () => {
    if (status === "uploading") return t("datasetImport.uploading");
    if (status === "assembling") return t("datasetImport.assembling");
    if (status === "importing") return t("datasetImport.importing");
    return "";
  };

  const progressPercent = () => {
    if (status === "uploading" && chunkProgress.total > 0) {
      return (chunkProgress.current / chunkProgress.total) * 100;
    }
    if ((status === "assembling" || status === "importing") && importProgress.total > 0) {
      return (importProgress.completed / importProgress.total) * 100;
    }
    return 0;
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={t("datasetImport.title")}
      mask={{ closable: !isBusy }}
    >
      <div className="space-y-4 py-2">
        {/* Format selector */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">{t("datasetImport.format")}</label>
          <Select
            value={fmt}
            onChange={setFmt}
            options={FORMATS}
            className="w-full"
            disabled={isBusy}
          />
        </div>

        {/* Drop zone */}
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-primary-500 bg-primary-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"
            }`}
          >
            <p className="text-sm text-gray-500">{t("datasetImport.dropZip")}</p>
            <p className="mt-1 text-xs text-gray-400">.zip (max 10GB, resume support)</p>
            <input ref={inputRef} type="file" accept=".zip" className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm text-gray-700 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            {!isBusy && (
              <button type="button" onClick={() => setFile(null)}
                className="text-xs text-red-400 hover:text-red-600 ml-2 flex-shrink-0">
                {t("common.delete")}
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        {/* Progress */}
        {showProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{progressLabel()}</span>
              {chunkProgress.total > 0 && status === "uploading" && (
                <span>{chunkProgress.current} / {chunkProgress.total} chunks</span>
              )}
              {importProgress.total > 0 && (status === "importing" || status === "assembling") && (
                <span>{importProgress.completed} / {importProgress.total}</span>
              )}
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-primary-500 transition-all duration-300"
                style={{ width: `${progressPercent()}%` }} />
            </div>
          </div>
        )}

        {/* Completed */}
        {status === "completed" && (
          <div className="rounded bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
            {t("datasetImport.importSuccess", { count: importProgress.total })}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          {isBusy ? (
            <button type="button" onClick={handleCancel}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              {t("common.cancel")}
            </button>
          ) : status === "completed" || status === "failed" ? (
            <button type="button" onClick={handleClose}
              className="rounded bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 transition-colors">
              {t("common.close")}
            </button>
          ) : (
            <button type="button" disabled={!file} onClick={startUpload}
              className="rounded bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {t("datasetImport.import")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
