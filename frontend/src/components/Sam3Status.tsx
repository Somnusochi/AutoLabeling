export function Sam3Status() {
  const { t } = useTranslation();
  const { sam3 } = useModelEvents();
  const [unloading, setUnloading] = useState(false);

  const loaded = sam3.status === "loaded";
  const isLoading = sam3.status === "starting" || sam3.status === "loading";

  const handleUnload = useCallback(async () => {
    setUnloading(true);
    try {
      await unloadSam3();
    } catch {
      toast.error(t("modelStatus.sam3UnloadFailed"));
    } finally {
      setUnloading(false);
    }
  }, [t]);

  return (
    <div className="rounded px-2.5 py-1.5 text-[11px] bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          {isLoading ? (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
          ) : (
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${loaded ? "bg-green-500" : "bg-gray-300"}`} />
          )}
          <span className="text-gray-500">
            {isLoading ? t("modelStatus.loading") : loaded ? t("modelStatus.sam3Loaded") : t("modelStatus.sam3Unloaded")}
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
    </div>
  );
}
