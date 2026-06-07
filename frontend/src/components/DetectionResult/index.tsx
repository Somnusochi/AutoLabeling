import { Dropdown } from "antd";

interface Props {
  result: Detection;
  previewUrl: string;
  batchResults: Detection[];
  batchFiles: File[];
  loading: boolean;
  elapsedMs: number;
  categories: string[];
  canvasMode: "view" | "draw";
  drawCategory: string;
  recentCategories: string[];
  hiddenIndices: Set<string>;
  onToggleVisibility: (boxId: string) => void;
  onCanvasModeChange: (mode: "view" | "draw") => void;
  onDrawCategoryChange: (cat: string) => void;
  onDeleteBox: (boxId: string) => void;
  onSelectBatch: (det: Detection, file?: File) => void;
  onReDetect: () => void;
  onSaveBoxes: () => void;
  onDrawBox: (box: { x1: number; y1: number; x2: number; y2: number }) => void;
  isValidation?: boolean;
}

export function DetectionResult({
  result,
  previewUrl,
  batchResults,
  batchFiles,
  loading,
  elapsedMs,
  categories,
  canvasMode,
  drawCategory,
  recentCategories,
  hiddenIndices,
  onToggleVisibility,
  onCanvasModeChange,
  onDrawCategoryChange,
  onDeleteBox,
  onSelectBatch,
  onReDetect,
  onSaveBoxes,
  onDrawBox,
  isValidation = false,
}: Props) {
  const { t } = useTranslation();

  // Stable blob URLs — only recreate when batchFiles identity changes
  const blobCache = useRef<{ files: File[]; urls: string[] } | null>(null);
  if (blobCache.current?.files !== batchFiles) {
    blobCache.current?.urls.forEach((u) => URL.revokeObjectURL(u));
    blobCache.current = { files: batchFiles, urls: batchFiles.map((f) => URL.createObjectURL(f)) };
  }
  const blobUrls = blobCache.current.urls;
  useEffect(() => () => blobCache.current?.urls.forEach((u) => URL.revokeObjectURL(u)), []);

  return (
    <div className="space-y-4">
      <div className="relative">
        <DetectionCanvas
          imageUrl={previewUrl}
          boxes={result.boxes}
          imgWidth={result.imageWidth}
          imgHeight={result.imageHeight}
          mode={canvasMode}
          hiddenIndices={hiddenIndices}
          onModeChange={onCanvasModeChange}
          onDrawBox={onDrawBox}
        />
        {canvasMode === "draw" && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={drawCategory}
              onChange={(e) => onDrawCategoryChange(e.target.value)}
              placeholder={t("detectionResult.drawCategoryPlaceholder")}
              className="rounded border border-gray-300 px-2 py-1 text-xs w-32"
            />
            {recentCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onDrawCategoryChange(c)}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                  drawCategory === c
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {loading && <LoadingOverlay elapsedMs={elapsedMs} />}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          {t("detectionResult.resultCount", { count: result.boxes.length })}
          {result.elapsedMs != null && result.elapsedMs > 0 && (
            <span className="ml-2 text-gray-400 font-normal">
              {t("detectionResult.timeElapsed")}{" "}
              {result.elapsedMs >= 1000
                ? `${(result.elapsedMs / 1000).toFixed(1)}s`
                : `${result.elapsedMs}ms`}
            </span>
          )}
          {batchResults.length > 1 && (
            <span className="ml-2 text-gray-400 font-normal">
              — {result.imageName} ({batchResults.indexOf(result) + 1}/{batchResults.length})
            </span>
          )}
        </h2>

        <div className="flex gap-2">
          {!isValidation && (
            <button
              type="button"
              onClick={onSaveBoxes}
              className="rounded border border-green-300 px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-50 transition-colors"
            >
              {t("detectionResult.saveFilter")}
            </button>
          )}
          {!isValidation && categories.length > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={onReDetect}
              className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? t("common.detecting") : t("detectionResult.redetect")}
            </button>
          )}
          <Dropdown
            menu={{
              items: [
                { key: "yolo", label: "YOLO (.txt)" },
                { key: "yolo-seg", label: "YOLO Segmentation" },
                { key: "coco", label: "COCO (.json)" },
                { key: "voc", label: "Pascal VOC (.xml)" },
                { key: "createml", label: "CreateML (.json)" },
              ],
              onClick: async ({ key }) => {
                if (key === "yolo") {
                  downloadYoloTxt(
                    result.boxes,
                    categories,
                    result.imageWidth,
                    result.imageHeight,
                    result.imageName,
                  );
                } else {
                  const labels: Record<string, string> = {
                    coco: "COCO",
                    "yolo-seg": "YOLO_Seg",
                    voc: "VOC",
                    createml: "CreateML",
                  };
                  const blob = await exportBatch([result.id], key);
                  downloadBlob(blob, `${labels[key] ?? key}_dataset.zip`);
                }
              },
            }}
            trigger={["click"]}
          >
            <button
              type="button"
              className="rounded border border-primary-200 px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
            >
              {t("detectionResult.exportLabel")}
            </button>
          </Dropdown>
          {!isValidation && (
            <Dropdown
              menu={{
                items: [
                  { key: "yolo", label: "YOLO (.txt)" },
                  { key: "yolo-seg", label: "YOLO Segmentation" },
                  { key: "coco", label: "COCO (.json)" },
                  { key: "voc", label: "Pascal VOC (.xml)" },
                  { key: "createml", label: "CreateML (.json)" },
                ],
                onClick: async ({ key }) => {
                  const ids = batchResults.length > 1 ? batchResults.map((r) => r.id) : [result.id];
                  const labels: Record<string, string> = {
                    yolo: "YOLO",
                    "yolo-seg": "YOLO_Seg",
                    coco: "COCO",
                    voc: "VOC",
                    createml: "CreateML",
                  };
                  const blob = await exportBatch(ids, key);
                  downloadBlob(blob, `${labels[key] ?? key}_dataset.zip`);
                },
              }}
              trigger={["click"]}
            >
              <button
                type="button"
                className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
              >
                {batchResults.length > 1
                  ? t("detectionResult.exportAllDataset", { count: batchResults.length })
                  : t("detectionResult.exportDataset")}
              </button>
            </Dropdown>
          )}
        </div>
      </div>

      {batchFiles.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {batchFiles.map((file, i) => {
            const res = batchResults[i];
            const done = !!res;
            const pending = !done && loading;
            const isActive = done
              ? result.id === res.id
              : previewUrl === blobUrls[i];
            return (
              <button
                key={i}
                onClick={() => onSelectBatch(res || null, file)}
                disabled={false}
                className={`relative flex-shrink-0 rounded border-2 p-1 transition-colors ${
                  isActive
                    ? "border-primary-500"
                    : done
                      ? "border-transparent hover:border-gray-200"
                      : "border-gray-200 opacity-40"
                }`}
              >
                <img
                  src={blobUrls[i]}
                  alt={file.name}
                  className="h-14 w-14 rounded object-cover"
                />
                {done ? (
                  <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {res.boxes.length}
                  </span>
                ) : pending ? (
                  <div className="absolute inset-0 bg-white/50 rounded flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 text-primary-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <ResultTable
        boxes={result.boxes}
        hiddenIndices={hiddenIndices}
        onToggleVisibility={onToggleVisibility}
        onDelete={onDeleteBox}
      />
    </div>
  );
}

function LoadingOverlay({ elapsedMs }: { elapsedMs: number }) {
  const { t } = useTranslation();
  const { vlm, sam2, sam3 } = useModelEvents();
  const modelLoading =
    vlm.state === "loading" ||
    vlm.state === "downloading" ||
    sam2.state === "loading" ||
    sam2.state === "downloading" ||
    sam3.status === "loading" ||
    sam3.status === "starting";

  return (
    <div className="absolute inset-0 bg-white/60 rounded-lg flex flex-col items-center justify-center gap-3">
      <svg className="animate-spin h-10 w-10 text-primary-500" viewBox="0 0 24 24">
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
      <p className="text-sm font-medium text-gray-600">
        {modelLoading ? t("detectionResult.loadingModel") : t("detectionResult.detecting")}
      </p>
      <p className="text-xs text-gray-400">
        {modelLoading ? t("detectionResult.pleaseWait") : `${(elapsedMs / 1000).toFixed(1)}s`}
      </p>
    </div>
  );
}
