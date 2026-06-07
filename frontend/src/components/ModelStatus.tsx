export function ModelStatus() {
  const { t } = useTranslation();
  const { vlm, sam2 } = useModelEvents();
  const [unloading, setUnloading] = useState(false);
  const [unloadingSam2, setUnloadingSam2] = useState(false);

  const state = vlm.state;
  const loaded = state === "loaded";
  const isDownloading = state === "downloading";
  const isLoading = state === "loading";
  const isError = state === "error";
  const progress = vlm.progress;
  const stage = vlm.stage;

  const sam2State = sam2.state;
  const sam2Loaded = sam2State === "loaded";
  const sam2Downloading = sam2State === "downloading";
  const sam2Loading = sam2State === "loading";
  const sam2Progress = sam2.progress;
  const sam2Stage = sam2.stage;
  const sam2Error = sam2.error;

  const handleUnload = useCallback(async () => {
    setUnloading(true);
    try {
      await unloadModel();
      toast.success(t("modelStatus.unloadSuccess"));
    } catch {
      toast.error(t("modelStatus.unloadFailed"));
    } finally {
      setUnloading(false);
      optimisticModelUnloaded("vlm");
    }
  }, [t]);

  const handleUnloadSam2 = useCallback(async () => {
    setUnloadingSam2(true);
    try {
      await unloadSam2();
      optimisticModelUnloaded("sam2");
      toast.success(t("modelStatus.sam2UnloadSuccess"));
    } catch {
      toast.error(t("modelStatus.sam2UnloadFailed"));
    } finally {
      setUnloadingSam2(false);
    }
  }, [t]);

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
        {isError && vlm.error && (
          <div className="mt-1 text-[10px] text-red-500 truncate max-w-[380px]" title={vlm.error}>
            {vlm.error}
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
