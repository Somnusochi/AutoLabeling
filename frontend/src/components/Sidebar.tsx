import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImageUploader } from "@/components/ImageUploader";
import { CategoryInput } from "@/components/CategoryInput";
import { HistoryList } from "@/components/HistoryList";
import { BatchProgress } from "@/components/BatchProgress";
import { TrainingPanel } from "@/components/TrainingPanel";
import { VideoPanel } from "@/components/VideoPanel";
import { ValidationSettings } from "@/components/ValidationSettings";
import { FilterPanel } from "@/components/FilterPanel";
import { HistorySkeleton } from "@/components/LoadingSkeleton";
import type { Detection } from "@/types";


export interface SidebarProps {
  appMode: "annotate" | "validate";
  setAppMode: (mode: "annotate" | "validate") => void;
  validateModelSource: "trained" | "upload";
  setValidateModelSource: (source: "trained" | "upload") => void;
  selectedTrainedJobId: string | null;
  setSelectedTrainedJobId: (id: string | null) => void;
  inputMode: "image" | "video";
  setInputMode: (mode: "image" | "video") => void;
  files: File[];
  setFiles: (files: File[]) => void;
  setPreviewUrl: (url: string | null) => void;
  categories: string[];
  setCategories: (categories: string[]) => void;
  validateVideoId: string | null;
  setValidateVideoId: (id: string | null) => void;
  setValidateRunKey: React.Dispatch<React.SetStateAction<number>>;
  externalModelFile: File | null;
  setExternalModelFile: (file: File | null) => void;
  validateConf: number;
  setValidateConf: (conf: number) => void;
  validateIou: number;
  setValidateIou: (iou: number) => void;
  recentCategories: string[];
  handleFiles: (fs: File[]) => void;
  handleDetect: () => void;
  handleSelectHistory: (det: Detection) => void;
  loading: boolean;
  batchProgress: { current: number; total: number };
  batchResults: Detection[];
  setBatchResults: React.Dispatch<React.SetStateAction<Detection[]>>;
  cancelBatch: () => void;
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  nmsIou: number;
  setNmsIou: (iou: number) => void;
  setHiddenIndices: React.Dispatch<React.SetStateAction<Set<string>>>;
  historyData?: { items: Detection[]; total: number };
  result: Detection | null;
  setResult: (result: Detection | null) => void;
  handleSelectKeyframe: (files: File[]) => void;
  useSam2: boolean;
  setUseSam2: (v: boolean) => void;
}

const LANG_KEYS = ["zh", "en", "ja"] as const;
const LANG_LABELS: Record<string, string> = { zh: "中", en: "EN", ja: "日" };
const LANG_TITLES: Record<string, string> = { zh: "中文", en: "English", ja: "日本語" };

export function Sidebar({
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
  recentCategories,
  handleFiles,
  handleDetect,
  handleSelectHistory,
  loading,
  batchProgress,
  batchResults,
  setBatchResults,
  cancelBatch,
  filterMode,
  setFilterMode,
  nmsIou,
  setNmsIou,
  setHiddenIndices,
  historyData,
  result,
  setResult,
  handleSelectKeyframe,
  useSam2,
  setUseSam2,
}: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { themeMode, setThemeMode } = useTheme();

  return (
    <aside
      className="flex-shrink-0 border-r border-gray-200 bg-white flex flex-col gap-4 overflow-y-auto relative"
      style={{ width: 420, padding: '1rem' }}
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
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
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
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
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
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

      {/* VLM Model Status */}
      <ModelStatus />

      {/* Mode tabs */}
      <div className="flex border-b border-gray-200 mb-2">
        {(['annotate', 'validate'] as const).map(m => (
          <button
            key={m}
            onClick={() => {
              setAppMode(m)
              setResult(null)
              setValidateVideoId(null)
            }}
            className={`flex-1 pb-3 pt-1 text-sm font-bold transition-all duration-200 relative text-center cursor-pointer ${
              appMode === m
                ? 'text-primary-600 border-b-2 border-primary-600 scale-[1.02]'
                : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'
            }`}
          >
            {{ annotate: t("common.annotate"), validate: t("common.validate") }[m]}
          </button>
        ))}
      </div>

      {appMode === 'validate' && (
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
          {(['image', 'video'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setInputMode(mode)
                setFiles([])
                setPreviewUrl(null)
                setBatchResults([])
              }}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                inputMode === mode
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {{ image: t("common.image"), video: t("common.video") }[mode]}
            </button>
          ))}
        </div>
        {inputMode === 'image' ? (
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
              appMode === 'validate'
                ? videoId => {
                    setValidateVideoId(videoId)
                    setValidateRunKey(k => k + 1)
                  }
                : undefined
            }
            disabled={loading}
          />
        )}
      </div>

      {!(
        appMode === 'validate' &&
        inputMode === 'video' &&
        validateVideoId
      ) && (
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

          {appMode === "annotate" && (
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

          <button
            type="button"
            disabled={
              loading ||
              files.length === 0 ||
              (appMode !== 'validate' && categories.length === 0)
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
                  ? t("home.detectingCount", { current: batchProgress.current, total: batchProgress.total })
                  : t("home.detectingDefault")}
              </span>
            ) : appMode === 'validate' ? (
              t("home.yoloValidation")
            ) : files.length > 1 ? (
              t("home.detectBtnImageCount", { count: files.length })
            ) : (
              t("home.detectBtnImage")
            )}
          </button>
        </>
      )}

      {appMode === 'validate' && inputMode === 'video' && (
        <div className="text-xs text-gray-400 text-center py-2">
          {validateVideoId
            ? t("home.placeholderVideoRunning")
            : t("home.placeholderSelectVideo")}
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


function ModelStatus() {
  const { t } = useTranslation();
  const [unloading, setUnloading] = useState(false);
  const [unloadingSam2, setUnloadingSam2] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["model-status"],
    queryFn: getModelStatus,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === "downloading" || state === "loading") return 1500;
      return false;
    },
    staleTime: 10_000,
  });

  const sam2Query = useQuery({
    queryKey: ["sam2-status"],
    queryFn: getSam2Status,
    refetchInterval: (query) => {
      const s = query.state.data?.state;
      if (s === "downloading" || s === "loading") return 1500;
      return false;
    },
    staleTime: 10_000,
  });

  const state = data?.state ?? "unloaded";
  const loaded = state === "loaded";
  const isDownloading = state === "downloading";
  const isLoading = state === "loading";
  const isError = state === "error";
  const progress = data?.progress ?? 0;
  const stage = data?.stage ?? "";
  const sam2State = sam2Query.data?.state ?? "unloaded";
  const sam2Loaded = sam2State === "loaded";
  const sam2Downloading = sam2State === "downloading";
  const sam2Loading = sam2State === "loading";
  const sam2Progress = sam2Query.data?.progress ?? 0;
  const sam2Stage = sam2Query.data?.stage ?? "";
  const sam2Error = sam2Query.data?.error ?? "";

  const handleUnload = useCallback(async () => {
    setUnloading(true);
    try {
      await unloadModel();
      refetch();
      toast.success(t("modelStatus.unloadSuccess"));
    } catch {
      toast.error(t("modelStatus.unloadFailed"));
    } finally {
      setUnloading(false);
    }
  }, [t, refetch]);

  const handleUnloadSam2 = useCallback(async () => {
    setUnloadingSam2(true);
    try {
      await unloadSam2();
      sam2Query.refetch();
      toast.success(t("modelStatus.sam2UnloadSuccess"));
    } catch {
      toast.error(t("modelStatus.sam2UnloadFailed"));
    } finally {
      setUnloadingSam2(false);
    }
  }, [t, sam2Query]);

  const stageLabels: Record<string, string> = {
    starting: t("modelStatus.stageStarting"),
    tokenizer: t("modelStatus.stageTokenizer"),
    processor: t("modelStatus.stageProcessor"),
    model: t("modelStatus.stageModel"),
    gpu: t("modelStatus.stageGpu"),
  };

  return (
    <div className="space-y-1">
      {/* VLM Model */}
      <div
        className={`rounded px-2.5 py-1.5 text-[11px] ${
          isError ? "bg-red-50 border border-red-200" : "bg-gray-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {isDownloading || isLoading ? (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
            ) : isError ? (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            ) : (
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${loaded ? "bg-green-500" : "bg-gray-300"}`}
              />
            )}
            <span className={`${isError ? "text-red-600" : "text-gray-500"}`}>
              {isDownloading
                ? t("modelStatus.downloading")
                : isLoading
                  ? t("modelStatus.loading")
                  : isError
                    ? t("modelStatus.error")
                    : loaded
                      ? t("modelStatus.loaded")
                      : t("modelStatus.unloaded")}
            </span>
          </span>
          {loaded && (
            <button
              type="button"
              disabled={unloading}
              onClick={handleUnload}
              className="text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {unloading ? t("modelStatus.unloading") : t("modelStatus.unload")}
            </button>
          )}
        </div>
        {(isDownloading || isLoading) && (
          <div className="mt-1.5">
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>{stageLabels[stage] || stage || t("modelStatus.preparing")}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div
                className="bg-primary-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {isError && data?.error && (
          <div className="mt-1 text-[10px] text-red-500 truncate max-w-[380px]" title={data.error}>
            {data.error}
          </div>
        )}
      </div>

      {/* SAM2 Model */}
      <div
        className={`rounded px-2.5 py-1.5 text-[11px] ${
          sam2State === "error" ? "bg-red-50 border border-red-200" : "bg-gray-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {sam2Downloading || sam2Loading ? (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
            ) : sam2State === "error" ? (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            ) : (
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${sam2Loaded ? "bg-green-500" : "bg-gray-300"}`}
              />
            )}
            <span className={`${sam2State === "error" ? "text-red-600" : "text-gray-500"}`}>
              {sam2Downloading
                ? t("modelStatus.downloading")
                : sam2Loading
                  ? t("modelStatus.loading")
                  : sam2State === "error"
                    ? t("modelStatus.error")
                    : sam2Loaded
                      ? t("modelStatus.sam2Loaded")
                      : t("modelStatus.sam2Unloaded")}
            </span>
          </span>
          {sam2Loaded && (
            <button
              type="button"
              disabled={unloadingSam2}
              onClick={handleUnloadSam2}
              className="text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {unloadingSam2 ? t("modelStatus.unloading") : t("modelStatus.unload")}
            </button>
          )}
        </div>
        {(sam2Downloading || sam2Loading) && (
          <div className="mt-1.5">
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>{sam2Stage ? (stageLabels[sam2Stage] || sam2Stage) : t("modelStatus.preparing")}</span>
              <span>{sam2Progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div
                className="bg-primary-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${sam2Progress}%` }}
              />
            </div>
          </div>
        )}
        {sam2State === "error" && sam2Error && (
          <div className="mt-1 text-[10px] text-red-500 truncate max-w-[380px]" title={sam2Error}>
            {sam2Error}
          </div>
        )}
      </div>
    </div>
  );
}
