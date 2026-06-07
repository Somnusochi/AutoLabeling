import { useAppStore } from "@/store/useAppStore";

export function useHomeState() {
  const { t } = useTranslation();
  const {
    appMode,
    setAppMode,
    validateModelSource,
    selectedTrainedJobId,
    externalModelFile,
    useSam2,
    sam2ScoreThreshold,
    useSam3,
    sam3Text,
    useSam3Seg,
    sam3Threshold,
    sam3MaskThreshold,
    files,
    setFiles,
    setPreviewUrl,
    categories,
    setCategories,
    filterMode,
    setFilterMode,
    nmsIou,
    setNmsIou,
    drawCategory,
    setHiddenIndices,
  } = useAppStore();

  // ── Composed state hooks ──────────────────────────
  const timer = useDetectionTimer();

  // ── Detection ────────────────────────────────────
  const queryClient = useQueryClient();
  const detectMut = useDetectMutation();
  const [result, setResult] = useState<Detection | null>(null);

  // ── Batch ────────────────────────────────────────
  const { batchResults, batchProgress, runBatch, cancelBatch, setBatchResults, setBatchProgress } =
    useBatchDetection();

  const { validating, runValidation } = useYoloValidation();

  // ── YOLO event listener ──────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAppMode("validate");
      useAppStore.setState({ validateModelSource: "trained", selectedTrainedJobId: detail.jobId });
    };
    window.addEventListener("yolo-validate", handler);
    return () => window.removeEventListener("yolo-validate", handler);
  }, [setAppMode]);

  // ── History ──────────────────────────────────────
  const { data: historyData } = useDetectionListQuery();
  const recentCategories = Array.from(
    new Set((historyData?.items ?? []).flatMap((d) => parseCategories(d.categories))),
  ).sort();

  const batchFileMap = useRef<Map<string, File>>(new Map());

  // ── Handlers ──────────────────────────────────────

  const handleFiles = useCallback(
    (fs: File[]) => {
      setFiles(fs);
      setBatchResults([]);
      setResult(null);
      setPreviewUrl(fs.length === 1 ? URL.createObjectURL(fs[0]) : null);
    },
    [setBatchResults, setFiles, setPreviewUrl],
  );

  const handleDetect = useCallback(async () => {
    if (files.length === 0) return;
    // Optimistically show loading state before SSE catches up
    if (useSam2) optimisticModelLoading("sam2");
    if (!useSam2 && !useSam3) optimisticModelLoading("vlm");
    timer.startTimer();
    batchFileMap.current.clear();

    try {
      if (appMode === "validate") {
        let token: string | undefined;
        if (validateModelSource === "upload") {
          if (!externalModelFile) {
            toast.error(t("home.modelUploadRequired"));
            return;
          }
          let cachedToken = tokenCache.get(externalModelFile);
          if (!cachedToken) {
            let promise = uploadCache.get(externalModelFile);
            if (!promise) {
              const form = new FormData();
              form.append("file", externalModelFile);
              promise = (async () => {
                const resp = await fetch(`${API_BASE}/train/upload-model`, {
                  method: "POST",
                  body: form,
                });
                const json = await resp.json();
                if (json.data?.token) {
                  tokenCache.set(externalModelFile, json.data.token);
                  return json.data.token;
                }
                throw new Error("No token returned");
              })();
              uploadCache.set(externalModelFile, promise);
            }
            try {
              cachedToken = await promise;
            } catch {
              tokenCache.delete(externalModelFile);
              uploadCache.delete(externalModelFile);
              toast.error(t("home.uploadModelFailed"));
              return;
            }
          }
          token = cachedToken;
        } else if (!selectedTrainedJobId) {
          toast.error(t("home.modelSelectionRequired"));
          return;
        }

        const results: Detection[] = [];
        setBatchProgress({ current: 0, total: files.length });
        for (let i = 0; i < files.length; i++) {
          const data = await runValidation(files[i], selectedTrainedJobId || undefined, token);
          if (data) {
            results.push(data);
            setBatchResults([...results]);
            if (i === 0) {
              setResult(data);
              setPreviewUrl(URL.createObjectURL(files[i]));
            }
          }
          setBatchProgress({ current: i + 1, total: files.length });
        }
        setBatchProgress({ current: 0, total: 0 });
        return;
      }

      if (categories.length === 0) return;
      await runBatch(
        files,
        categories,
        useSam2,
        sam2ScoreThreshold,
        useSam3,
        sam3Text,
        useSam3Seg,
        sam3Threshold,
        sam3MaskThreshold,
        (data, file, i) => {
          batchFileMap.current.set(data.id, file);
          if (i === 0) {
            setResult(data);
            setPreviewUrl(URL.createObjectURL(file));
          }
        },
      );
      queryClient.invalidateQueries({ queryKey: ["detections"] });
    } finally {
      timer.stopTimer();
    }
  }, [
    files,
    categories,
    appMode,
    useSam2,
    sam2ScoreThreshold,
    useSam3,
    sam3Text,
    useSam3Seg,
    sam3Threshold,
    sam3MaskThreshold,
    validateModelSource,
    externalModelFile,
    selectedTrainedJobId,
    runValidation,
    runBatch,
    timer,
    queryClient,
    setBatchResults,
    setBatchProgress,
    setPreviewUrl,
    t,
  ]);

  const handleSelectHistory = useCallback(
    async (det: Detection) => {
      setFiles([]);
      batchFileMap.current.clear();
      setPreviewUrl(`${API_BASE}/detections/${det.id}/image`);
      const full = await getDetection(det.id);
      setResult(full);
      setBatchResults([]);
      setCategories(parseCategories(full.categories));
      setFilterMode((full.filterMode as FilterMode) || "all");
      if (full.filterNmsIou != null) setNmsIou(full.filterNmsIou);
      setHiddenIndices(new Set());
    },
    [
      setBatchResults,
      setFiles,
      setPreviewUrl,
      setCategories,
      setFilterMode,
      setNmsIou,
      setHiddenIndices,
    ],
  );

  const handleReDetect = useCallback(async () => {
    if (!result) return;
    timer.startTimer();
    try {
      let file: File;
      const cached = batchFileMap.current.get(result.id);
      if (cached) {
        file = cached;
      } else {
        const blob = await fetch(`${API_BASE}/detections/${result.id}/image`).then((r) => r.blob());
        file = new File([blob], result.imageName, { type: blob.type });
      }
      const data = await detectMut.mutateAsync({
        file,
        categories,
        useSam2,
        sam2ScoreThreshold,
        useSam3,
        sam3Text,
        useSam3Seg,
        sam3Threshold,
        sam3MaskThreshold,
      });
      if (data) batchFileMap.current.set(data.id, file);
      setResult(data);
      setBatchResults((prev) => prev.map((r) => (r.id === result.id ? data : r)));
    } catch {
      /* handled by mutation */
    } finally {
      timer.stopTimer();
    }
  }, [
    result,
    categories,
    useSam2,
    sam2ScoreThreshold,
    useSam3,
    sam3Text,
    useSam3Seg,
    sam3Threshold,
    sam3MaskThreshold,
    detectMut,
    timer,
    setBatchResults,
  ]);

  const handleDrawBox = useCallback(
    async (raw: { x1: number; y1: number; x2: number; y2: number }) => {
      if (!result || !drawCategory.trim()) {
        toast.error(t("home.drawCategoryRequired"));
        return;
      }
      try {
        await addBox(result.id, { ...raw, className: drawCategory.trim() });
        const newBox: BBox = {
          id: `manual-${Date.now()}`,
          className: drawCategory.trim(),
          ...raw,
          confidence: null,
        };
        const updated = { ...result, boxes: [...result.boxes, newBox] };
        setResult(updated);
        setBatchResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } catch {
        /* ignore */
      }
    },
    [result, drawCategory, setBatchResults, t],
  );

  const handleDeleteBox = useCallback(
    async (boxId: string) => {
      if (!result) return;
      const box = result.boxes.find((b) => b.id === boxId);
      if (!box) return;
      try {
        await deleteBox(result.id, box.id);
        const updated = { ...result, boxes: result.boxes.filter((b) => b.id !== boxId) };
        setResult(updated);
        setBatchResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } catch {
        /* ignore */
      }
    },
    [result, setBatchResults],
  );

  const handleSelectKeyframe = useCallback(
    (fs: File[]) => {
      setFiles(fs);
      setPreviewUrl(fs.length === 1 ? URL.createObjectURL(fs[0]) : null);
      setBatchResults([]);
      setResult(null);
    },
    [setBatchResults, setFiles, setPreviewUrl],
  );

  const handleBatchSelect = useCallback(
    (det: Detection, file?: File) => {
      setResult(det);
      if (file) setPreviewUrl(URL.createObjectURL(file));
    },
    [setPreviewUrl],
  );

  const handleSaveBoxes = useCallback(async () => {
    if (!result) return;

    // Create an API call directly here if needed or migrate handleSaveBoxes from old hook
    // It seems the API was in useAnnotationState. We can just use the underlying fetch here.
    try {
      await fetch(`${API_BASE}/detections/${result.id}/filter-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter_mode: filterMode,
          filter_nms_iou: filterMode === "nms" ? nmsIou : null,
        }),
      });
      toast.success(t("home.savedSuccessfully"));
    } catch {
      toast.error(t("home.saveFailed"));
    }
    setResult((prev) =>
      prev
        ? { ...prev, filterMode: filterMode, filterNmsIou: filterMode === "nms" ? nmsIou : null }
        : null,
    );
  }, [result, filterMode, nmsIou, t]);

  const loading = detectMut.isPending || batchProgress.total > 0 || validating;

  const toggleBoxVisibility = useCallback(
    (id: string) => {
      setHiddenIndices((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [setHiddenIndices],
  );

  const displayResult = useMemo(
    () => (result ? { ...result, boxes: applyFilter(filterMode, result.boxes, nmsIou) } : null),
    [result, filterMode, nmsIou],
  );

  return {
    // Timer
    elapsedMs: timer.elapsedMs,

    // Core state
    result,
    setResult,
    batchResults,
    setBatchResults,
    batchProgress,
    setBatchProgress,
    historyData,
    recentCategories,

    // Handlers
    handleFiles,
    handleDetect,
    handleSelectHistory,
    handleReDetect,
    handleDrawBox,
    handleDeleteBox,
    handleSelectKeyframe,
    handleBatchSelect,
    handleSaveBoxes,
    cancelBatch,
    toggleBoxVisibility,
    loading,
    displayResult,
  };
}
