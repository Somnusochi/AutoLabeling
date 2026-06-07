import { Select, Modal } from "antd";

const FORMATS = [
  { value: "yolo", label: "YOLO" },
  { value: "yolo-seg", label: "YOLO Segmentation" },
  { value: "coco", label: "COCO JSON" },
  { value: "voc", label: "Pascal VOC" },
  { value: "createml", label: "CreateML JSON" },
];

const MAX_SIZE = 1024 * 1024 * 1024; // 1GB

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DatasetImportModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [fmt, setFmt] = useState("yolo");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ total: 0, completed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "importing" | "completed" | "failed">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setImporting(false);
    setImportId(null);
    setProgress({ total: 0, completed: 0 });
    setError(null);
    setStatus("idle");
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const handleFile = useCallback((f: File | null) => {
    setError(null);
    if (f) {
      if (!f.name.endsWith(".zip")) {
        setError(t("datasetImport.invalidZip"));
        return;
      }
      if (f.size > MAX_SIZE) {
        setError(t("datasetImport.fileTooLarge"));
        return;
      }
      setFile(f);
    }
  }, [t]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0] ?? null);
    },
    [handleFile],
  );

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setStatus("importing");
    setError(null);
    try {
      const result = await importDataset(file, fmt);
      setImportId(result.importId);
      pollRef.current = setInterval(async () => {
        try {
          const p = await fetchImportProgress(result.importId);
          setProgress({ total: p.total, completed: p.completed });
          if (p.status === "completed") {
            setStatus("completed");
            setImporting(false);
            if (pollRef.current) clearInterval(pollRef.current);
            qc.invalidateQueries({ queryKey: ["detections"] });
            toast.success(t("datasetImport.importSuccess", { count: p.total }));
          } else if (p.status === "failed") {
            setStatus("failed");
            setImporting(false);
            setError(p.error || t("datasetImport.importFailed"));
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          // polling error, continue
        }
      }, 500);
    } catch (e) {
      setStatus("failed");
      setImporting(false);
      setError(e instanceof Error ? e.message : t("datasetImport.importFailed"));
    }
  }, [file, fmt, qc, t]);

  const handleCancel = useCallback(async () => {
    if (importId) {
      try { await cancelImport(importId); } catch { /* ignore */ }
    }
    reset();
  }, [importId, reset]);

  const handleClose = useCallback(() => {
    if (importing) return; // prevent closing during import
    reset();
    onClose();
  }, [importing, onClose, reset]);

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={t("datasetImport.title")}
      maskClosable={!importing}
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
            disabled={importing}
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
              dragOver
                ? "border-primary-500 bg-primary-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50"
            }`}
          >
            <p className="text-sm text-gray-500">{t("datasetImport.dropZip")}</p>
            <p className="mt-1 text-xs text-gray-400">.zip</p>
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between">
            <span className="text-sm text-gray-700 truncate">{file.name}</span>
            {!importing && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-red-400 hover:text-red-600 ml-2 flex-shrink-0"
              >
                {t("common.delete")}
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Progress */}
        {status === "importing" && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{t("datasetImport.importing")}</span>
              {progress.total > 0 && (
                <span>{progress.completed} / {progress.total}</span>
              )}
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-300"
                style={{
                  width: progress.total > 0
                    ? `${(progress.completed / progress.total) * 100}%`
                    : "100%",
                }}
              />
            </div>
          </div>
        )}

        {/* Completed */}
        {status === "completed" && (
          <div className="rounded bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
            {t("datasetImport.importSuccess", { count: progress.total })}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          {importing ? (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
          ) : status === "completed" || status === "failed" ? (
            <button
              type="button"
              onClick={handleClose}
              className="rounded bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 transition-colors"
            >
              {t("common.close")}
            </button>
          ) : (
            <button
              type="button"
              disabled={!file}
              onClick={handleImport}
              className="rounded bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {t("datasetImport.import")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
