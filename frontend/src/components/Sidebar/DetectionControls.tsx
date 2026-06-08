import { useAppStore } from "@/store/useAppStore";

interface Props {
  recentCategories: string[];
  loading: boolean;
  filesCount: number;
  batchProgress: { current: number; total: number };
  onDetect: () => void;
}

export function DetectionControls({
  recentCategories,
  loading,
  filesCount,
  batchProgress,
  onDetect,
}: Props) {
  const { t } = useTranslation();
  const {
    appMode,
    categories,
    setCategories,
    isTraining,
    useSam2,
    setUseSam2,
    useSam3,
    useSam3Seg,
    setUseSam3Seg,
    sam3Threshold,
    setSam3Threshold,
    sam3MaskThreshold,
    setSam3MaskThreshold,
    sam2ScoreThreshold,
    setSam2ScoreThreshold,
  } = useAppStore();

  return (
    <>
      <div>
        <p className="text-sm font-medium text-gray-600 mb-2">{t("common.categories")}</p>
        <CategoryInput
          categories={categories}
          onChange={setCategories}
          disabled={loading}
          recentCategories={recentCategories}
        />
      </div>

      {appMode === "annotate" && !useSam3 && (
        <>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={useSam2}
              onChange={(e) => setUseSam2(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600"
            />
            {t("home.useSam2")}
          </label>
          {useSam2 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex-shrink-0">{`Score ≥ ${sam2ScoreThreshold.toFixed(1)}`}</span>
              <input
                type="range" min="0" max="1" step="0.1"
                value={sam2ScoreThreshold}
                onChange={(e) => setSam2ScoreThreshold(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-primary-600 cursor-pointer"
              />
            </div>
          )}
        </>
      )}
      {appMode === "annotate" && useSam3 && (
        <>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={useSam3Seg}
              onChange={(e) => setUseSam3Seg(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600"
            />
            {t("home.useSam3Seg")}
          </label>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex-shrink-0">{`Conf ≥ ${sam3Threshold.toFixed(1)}`}</span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={sam3Threshold}
              onChange={(e) => setSam3Threshold(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-primary-600 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex-shrink-0">{`Mask ≥ ${sam3MaskThreshold.toFixed(1)}`}</span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={sam3MaskThreshold}
              onChange={(e) => setSam3MaskThreshold(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-primary-600 cursor-pointer"
            />
          </div>
        </>
      )}

      {isTraining && (
        <div className="flex items-center gap-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          {t("trainingPanel.trainingInProgress")}
        </div>
      )}

      <button
        type="button"
        disabled={
          isTraining || loading || filesCount === 0
          || (appMode !== "validate" && categories.length === 0)
        }
        onClick={onDetect}
        className="w-full rounded bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {batchProgress.total > 1
              ? t("home.detectingCount", { current: batchProgress.current, total: batchProgress.total })
              : t("home.detectingDefault")}
          </span>
        ) : appMode === "validate" ? (
          t("home.yoloValidation")
        ) : filesCount > 1 ? (
          t("home.detectBtnImageCount", { count: filesCount })
        ) : (
          t("home.detectBtnImage")
        )}
      </button>
    </>
  );
}
