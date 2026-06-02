import { DetectionCanvas } from "@/components/DetectionCanvas";
import { ResultTable } from "@/components/ResultTable";
import { exportSingleUrl, exportBatch, downloadBlob } from "@/services/api";
import { API_BASE } from "@/lib/constants";
import type { Detection } from "@/types";

interface Props {
  result: Detection;
  previewUrl: string;
  elapsedMs: number;
  batchResults: Detection[];
  batchFiles: File[];
  loading: boolean;
  categories: string[];
  canvasMode: "view" | "draw";
  drawCategory: string;
  onCanvasModeChange: (mode: "view" | "draw") => void;
  onDrawCategoryChange: (cat: string) => void;
  onDeleteBox: (boxIndex: number) => void;
  onSelectBatch: (det: Detection, file?: File) => void;
  onReDetect: () => void;
  onDrawBox: (box: { x1: number; y1: number; x2: number; y2: number }) => void;
}

export function DetectionResult({
  result,
  previewUrl,
  elapsedMs,
  batchResults,
  batchFiles,
  loading,
  categories,
  canvasMode,
  drawCategory,
  onCanvasModeChange,
  onDrawCategoryChange,
  onDeleteBox,
  onSelectBatch,
  onReDetect,
  onDrawBox,
}: Props) {
  const isHistory = batchFiles.length === 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <DetectionCanvas
          imageUrl={previewUrl}
          boxes={result.boxes}
          imgWidth={result.image_width}
          imgHeight={result.image_height}
          mode={canvasMode}
          onModeChange={onCanvasModeChange}
          onDrawBox={onDrawBox}
        />
        {canvasMode === "draw" && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={drawCategory}
              onChange={(e) => onDrawCategoryChange(e.target.value)}
              placeholder="标注类别..."
              className="rounded border border-gray-300 px-2 py-1 text-xs w-32"
            />
            <span className="text-xs text-gray-400">画框前先输入类别名</span>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          检测结果 ({result.boxes.length} 个目标)
          {elapsedMs > 0 && (
            <span className="ml-2 text-gray-400 font-normal">
              耗时 {elapsedMs >= 1000 ? `${(elapsedMs / 1000).toFixed(1)}s` : `${elapsedMs}ms`}
            </span>
          )}
          {batchResults.length > 1 && (
            <span className="ml-2 text-gray-400 font-normal">
              — {result.image_name} ({batchResults.indexOf(result) + 1}/{batchResults.length})
            </span>
          )}
        </h2>

        <div className="flex gap-2">
          {isHistory && categories.length > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={onReDetect}
              className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "检测中..." : "重新检测"}
            </button>
          )}
          <a
            href={exportSingleUrl(result.id)}
            download
            className="rounded border border-primary-200 px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
          >
            导出 YOLO (.txt)
          </a>
          <button
            type="button"
            onClick={async () => {
              const ids = batchResults.length > 1 ? batchResults.map((r) => r.id) : [result.id];
              const blob = await exportBatch(ids);
              downloadBlob(blob, "yolo_labels.zip");
            }}
            className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
          >
            {batchResults.length > 1 ? `导出全部 (${batchResults.length} zip)` : "导出 YOLO (zip)"}
          </button>
        </div>
      </div>

      {batchResults.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {batchResults.map((res, i) => (
            <button
              key={res.id}
              onClick={() => onSelectBatch(res, batchFiles[i])}
              className={`flex-shrink-0 rounded border-2 p-1 transition-colors ${
                result.id === res.id ? "border-primary-500" : "border-transparent hover:border-gray-200"
              }`}
            >
              <img
                src={`${API_BASE}/detections/${res.id}/image`}
                alt={res.image_name}
                className="h-14 w-14 rounded object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <ResultTable boxes={result.boxes} onDelete={onDeleteBox} />
    </div>
  );
}
