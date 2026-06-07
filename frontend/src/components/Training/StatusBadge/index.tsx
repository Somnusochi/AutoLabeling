export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    pending: "text-gray-400",
    running: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
  };
  const labels: Record<string, string> = {
    pending: t("trainingPanel.statusPending"),
    running: t("trainingPanel.statusRunning"),
    completed: t("trainingPanel.statusCompleted"),
    failed: t("trainingPanel.statusFailed"),
  };
  return <span className={map[status] ?? "text-gray-400"}>{labels[status] ?? status}</span>;
}
