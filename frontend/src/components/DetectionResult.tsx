import { DetectionCanvas } from "@/components/DetectionCanvas";
import { ResultTable } from "@/components/ResultTable";
import { exportBatch, downloadBlob } from "@/services/api";
import { downloadYoloTxt } from "@/lib/yoloExport";
import { API_BASE } from "@/lib/constants";
import type { Detection } from "@/types";

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
              placeholder="标注类别..."
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
        {loading && (
          <div className="absolute inset-0 bg-white/60 rounded-lg flex flex-col items-center justify-center gap-2">
            <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium text-gray-500">{(elapsedMs / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">
          检测结果 ({result.boxes.length} 个目标)
          {result.elapsed_ms != null && result.elapsed_ms > 0 && (
            <span className="ml-2 text-gray-400 font-normal">
              耗时 {result.elapsed_ms >= 1000 ? `${(result.elapsed_ms / 1000).toFixed(1)}s` : `${result.elapsed_ms}ms`}
            </span>
          )}
          {batchResults.length > 1 && (
            <span className="ml-2 text-gray-400 font-normal">
              — {result.image_name} ({batchResults.indexOf(result) + 1}/{batchResults.length})
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
              保存过滤结果
            </button>
          )}
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
          <button
            type="button"
            onClick={() => downloadYoloTxt(result.boxes, categories, result.image_width, result.image_height, result.image_name)}
            className="rounded border border-primary-200 px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
          >
            导出 YOLO (.txt)
          </button>
          {!isValidation && (
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
          )}
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

      <ResultTable boxes={result.boxes} hiddenIndices={hiddenIndices} onToggleVisibility={onToggleVisibility} onDelete={onDeleteBox} />
    </div>
  );
}
