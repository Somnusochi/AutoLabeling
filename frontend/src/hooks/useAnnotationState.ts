/** Manual annotation state: canvas mode, draw, filter, visibility. */
export function useAnnotationState() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [canvasMode, setCanvasMode] = useState<"view" | "draw">("view");
  const [drawCategory, setDrawCategory] = useState("");
  const [hiddenIndices, setHiddenIndices] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [nmsIou, setNmsIou] = useState(0.5);

  const toggleBoxVisibility = useCallback((boxId: string) => {
    setHiddenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(boxId)) next.delete(boxId);
      else next.add(boxId);
      return next;
    });
  }, []);

  const handleSaveBoxes = useCallback(async (result: Detection | null) => {
    if (!result) return;
    try {
      await saveFilterSettings(result.id, filterMode, filterMode === "nms" ? nmsIou : null);
      toast.success(t("home.saveFilterSuccess"));
      queryClient.invalidateQueries({ queryKey: ["detections"] });
    } catch {
      toast.error(t("home.saveFilterFailed"));
    }
  }, [filterMode, nmsIou, queryClient, t]);

  return {
    canvasMode, setCanvasMode,
    drawCategory, setDrawCategory,
    hiddenIndices, setHiddenIndices,
    filterMode, setFilterMode,
    nmsIou, setNmsIou,
    toggleBoxVisibility,
    handleSaveBoxes,
  };
}
