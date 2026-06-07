import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImageUploader } from "@/components/ImageUploader";
import { CategoryInput } from "@/components/CategoryInput";
import { HistoryList } from "@/components/HistoryList";
import { BatchProgress } from "@/components/BatchProgress";
import { ModelStatus } from "@/components/ModelStatus";
import { Sam3Status } from "@/components/Sam3Status";
import { TrainingPanel } from "@/components/TrainingPanel";
import { VideoPanel } from "@/components/VideoPanel";
import { ValidationSettings } from "@/components/ValidationSettings";
import { FilterPanel } from "@/components/FilterPanel";
import { HistorySkeleton } from "@/components/LoadingSkeleton";
import type { Detection } from "@/types";
import { useAppStore } from "@/store/useAppStore";

export interface SidebarProps {
  recentCategories: string[];
  handleFiles: (fs: File[]) => void;
  handleDetect: () => void;
  handleSelectHistory: (det: Detection) => void;
  loading: boolean;
  batchProgress: { current: number; total: number };
  batchResults: Detection[];
  setBatchResults: React.Dispatch<React.SetStateAction<Detection[]>>;
  cancelBatch: () => void;
  historyData?: { items: Detection[]; total: number };
  result: Detection | null;
  setResult: (result: Detection | null) => void;
  handleSelectKeyframe: (files: File[]) => void;
}

const LANG_KEYS = ["zh", "en", "ja"] as const;
const LANG_LABELS: Record<string, string> = { zh: "中", en: "EN", ja: "日" };
const LANG_TITLES: Record<string, string> = { zh: "中文", en: "English", ja: "日本語" };

export function Sidebar({
  recentCategories,
  handleFiles,
  handleDetect,
  handleSelectHistory,
  loading,
  batchProgress,
  batchResults,
  setBatchResults,
  cancelBatch,
  historyData,
  result,
  setResult,
  handleSelectKeyframe,
}: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { themeMode, setThemeMode } = useTheme();

  const {
    appMode,
    setAppMode,
    validateModelSource,
    setValidateModelSource,
    selectedTrainedJobId,
    setSelectedTrainedJobId,
    inputMode,
    setInputMode,
    files,
    setFiles,
    setPreviewUrl,
    categories,
    setCategories,
    validateVideoId,
    setValidateVideoId,
    setValidateRunKey,
    externalModelFile,
    setExternalModelFile,
    validateConf,
    setValidateConf,
    validateIou,
    setValidateIou,
    filterMode,
    setFilterMode,
    nmsIou,
    setNmsIou,
    setHiddenIndices,
    useSam2,
    setUseSam2,
    useSam3,
    setUseSam3,
    useSam3Seg,
    setUseSam3Seg,
    sam3Threshold,
    setSam3Threshold,
    sam3MaskThreshold,
    setSam3MaskThreshold,
    sam2ScoreThreshold,
    setSam2ScoreThreshold,
    isTraining,
  } = useAppStore();

  return (
    <aside
      className="flex-shrink-0 border-r border-gray-200 bg-white flex flex-col gap-4 overflow-y-auto relative"
      style={{ width: 440, padding: "1.25rem" }}
    >
      {/* Header: Title + Controls */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold text-gray-400 tracking-wider">VLM-AutoYOLO</span>
        <div className="flex gap-1.5 items-center">
          {/* Theme Mode Selector - Three buttons side by side */}
          <div className="flex rounded border border-gray-200 bg-gray-50 overflow-hidden h-7">
            <button
              onClick={() => setThemeMode("light")}
              className={`flex items-center justify-center w-7 transition-colors cursor-pointer ${
                themeMode === "light"
                  ? "bg-primary-500 text-white"
                  : "text-gray-500 hover:text-primary-600 hover:bg-gray-100"
              }`}
              title={t("common.themeLight")}
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </button>
            <button
              onClick={() => setThemeMode("dark")}
              className={`flex items-center justify-center w-7 transition-colors cursor-pointer ${
                themeMode === "dark"
                  ? "bg-primary-500 text-white"
                  : "text-gray-500 hover:text-primary-600 hover:bg-gray-100"
              }`}
              title={t("common.themeDark")}
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </button>
            <button
              onClick={() => setThemeMode("system")}
              className={`flex items-center justify-center w-7 transition-colors cursor-pointer ${
                themeMode === "system"
                  ? "bg-primary-500 text-white"
                  : "text-gray-500 hover:text-primary-600 hover:bg-gray-100"
              }`}
              title={t("common.themeSystem")}
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>

          {/* Language Selector */}
          <div className="flex rounded border border-gray-200 bg-gray-50 overflow-hidden h-7">
            {LANG_KEYS.map((lang) => {
              const active = i18n.language.startsWith(lang);
              return (
                <button
                  key={lang}
                  onClick={() => i18n.changeLanguage(lang)}
                  className={`text-[10px] font-semibold px-1.5 transition-colors cursor-pointer ${
                    active
                      ? "bg-primary-500 text-white"
                      : "text-gray-500 hover:text-primary-600 hover:bg-gray-100"
                  }`}
                  title={LANG_TITLES[lang]}
                >
                  {LANG_LABELS[lang]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Model selector */}
      <div className="flex rounded-lg border border-gray-200/60 bg-gray-100/80 p-1 relative min-h-[36px] mb-2 shadow-inner">
        {(["vlm+sam2", "sam3"] as const).map((mode) => {
          const active = mode === "sam3" ? useSam3 : !useSam3;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setUseSam2(mode === "vlm+sam2");
                setUseSam3(mode === "sam3");
              }}
              className={`flex-1 text-xs font-semibold px-3 py-1 rounded-md transition-all duration-300 cursor-pointer relative z-10 ${
                active
                  ? "bg-white text-primary-600 shadow-sm ring-1 ring-black/5"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
              }`}
            >
              {mode === "sam3" ? "SAM3" : "VLM + SAM2"}
            </button>
          );
        })}
      </div>

      {/* Model Status */}
      {useSam3 ? <Sam3Status /> : <ModelStatus />}

      {/* Mode tabs */}
      <div className="flex border-b border-gray-200 mb-2">
        {(["annotate", "validate"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setAppMode(m);
              setResult(null);
              setValidateVideoId(null);
            }}
            className={`flex-1 pb-3 pt-1 text-sm font-bold transition-all duration-200 relative text-center cursor-pointer ${
              appMode === m
                ? "text-primary-600 border-b-2 border-primary-600 scale-[1.02]"
                : "text-gray-400 hover:text-gray-600 border-b-2 border-transparent"
            }`}
          >
            {{ annotate: t("common.annotate"), validate: t("common.validate") }[m]}
          </button>
        ))}
      </div>

      {appMode === "validate" && (
        <ValidationSettings
          selectedJobId={selectedTrainedJobId}
          onSelectJob={setSelectedTrainedJobId}
          modelSource={validateModelSource}
          onSourceChange={setValidateModelSource}
          externalFile={externalModelFile}
          onExternalFile={setExternalModelFile}
          validateConf={validateConf}
          onConfChange={setValidateConf}
          validateIou={validateIou}
          onIouChange={setValidateIou}
        />
      )}

      <div>
        <div className="flex gap-1 rounded bg-gray-100 p-0.5 mb-2">
          {(["image", "video"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setInputMode(mode);
                setFiles([]);
                setPreviewUrl(null);
                setBatchResults([]);
              }}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                inputMode === mode
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {{ image: t("common.image"), video: t("common.video") }[mode]}
            </button>
          ))}
        </div>
        {inputMode === "image" ? (
          <ImageUploader
            onFiles={handleFiles}
            onClear={() => {
              setFiles([]);
              setPreviewUrl(null);
              setBatchResults([]);
            }}
            disabled={loading}
          />
        ) : (
          <VideoPanel
            onLoadKeyframes={handleSelectKeyframe}
            onValidateVideo={
              appMode === "validate"
                ? (videoId) => {
                    setValidateVideoId(videoId);
                    setValidateRunKey((k) => k + 1);
                  }
                : undefined
            }
            disabled={loading}
          />
        )}
      </div>

      {!(appMode === "validate" && inputMode === "video" && validateVideoId) && (
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
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={useSam2}
                onChange={(e) => setUseSam2(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600"
              />
              {t("home.useSam2")}
            </label>
          )}
          {appMode === "annotate" && useSam2 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex-shrink-0">{`Score ≥ ${sam2ScoreThreshold.toFixed(1)}`}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={sam2ScoreThreshold}
                onChange={(e) => setSam2ScoreThreshold(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-primary-600 cursor-pointer"
              />
            </div>
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
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sam3Threshold}
                  onChange={(e) => setSam3Threshold(parseFloat(e.target.value))}
                  className="flex-1 h-1 accent-primary-600 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex-shrink-0">{`Mask ≥ ${sam3MaskThreshold.toFixed(1)}`}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
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
              isTraining || loading || files.length === 0 || (appMode !== "validate" && categories.length === 0)
            }
            onClick={handleDetect}
            className="w-full rounded bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                {batchProgress.total > 1
                  ? t("home.detectingCount", {
                      current: batchProgress.current,
                      total: batchProgress.total,
                    })
                  : t("home.detectingDefault")}
              </span>
            ) : appMode === "validate" ? (
              t("home.yoloValidation")
            ) : files.length > 1 ? (
              t("home.detectBtnImageCount", { count: files.length })
            ) : (
              t("home.detectBtnImage")
            )}
          </button>
        </>
      )}

      {appMode === "validate" && inputMode === "video" && (
        <div className="text-xs text-gray-400 text-center py-2">
          {validateVideoId ? t("home.placeholderVideoRunning") : t("home.placeholderSelectVideo")}
        </div>
      )}

      <BatchProgress
        current={batchProgress.current}
        total={batchProgress.total}
        completed={batchResults.length}
        onCancel={cancelBatch}
      />

      {result && (
        <FilterPanel
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          nmsIou={nmsIou}
          onNmsIouChange={setNmsIou}
          setHiddenIndices={setHiddenIndices}
        />
      )}

      <hr className="border-gray-100" />

      <div>
        <p className="text-sm font-medium text-gray-600 mb-2">{t("common.history")}</p>
        <Suspense fallback={<HistorySkeleton />}>
          <ErrorBoundary>
            <HistoryList data={historyData} onSelect={handleSelectHistory} />
          </ErrorBoundary>
        </Suspense>
      </div>

      <hr className="border-gray-100" />

      <div>
        <p className="text-sm font-medium text-gray-600 mb-2">{t("common.yoloTrain")}</p>
        <TrainingPanel detections={historyData?.items ?? []} />
      </div>
    </aside>
  );
}
