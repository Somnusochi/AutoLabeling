export function DetectionSkeleton() {
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
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
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
      <p className="text-sm font-medium text-gray-500">
        {modelLoading ? t("detectionResult.loadingModel") : t("detectionResult.detecting")}
      </p>
      <p className="text-xs text-gray-400">{t("detectionResult.pleaseWait")}</p>
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 rounded bg-gray-100" />
      ))}
    </div>
  );
}
