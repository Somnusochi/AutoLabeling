export function useHomeState() {
  const { t } = useTranslation();

  // ── Composed state hooks ──────────────────────────
  const model = useModelConfig();
  const upload = useUploadState();
  const annotation = useAnnotationState();
  const timer = useDetectionTimer();

  // ── Detection ────────────────────────────────────
  const queryClient = useQueryClient();
  const detectMut = useDetectMutation();
  const [result, setResult] = useState<Detection | null>(null);

  // ── Batch ────────────────────────────────────────
  const { batchResults, batchProgress, runBatch, cancelBatch, setBatchResults, setBatchProgress } = useBatchDetection();

  // ── YOLO Validation ──────────────────────────────
  const [validateModelSource, setValidateModelSource] = useState<"trained" | "upload">("trained");
  const [selectedTrainedJobId, setSelectedTrainedJobId] = useState<string | null>(null);
  const [validateVideoId, setValidateVideoId] = useState<string | null>(null);
  const [validateRunKey, setValidateRunKey] = useState(0);
  const [externalModelFile, setExternalModelFile] = useState<File | null>(null);
  const {
    validateConf, validateIou, validating,
    setValidateConf, setValidateIou, runValidation,
  } = useYoloValidation();

  // ── YOLO event listener ──────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      model.setAppMode("validate");
      setValidateModelSource("trained");
      setSelectedTrainedJobId(detail.jobId);
    };
    window.addEventListener("yolo-validate", handler);
    return () => window.removeEventListener("yolo-validate", handler);
  }, [model.setAppMode]);

  // ── History ──────────────────────────────────────
  const { data: historyData } = useDetectionListQuery();
  const recentCategories = Array.from(
    new Set((historyData?.items ?? []).flatMap((d) => parseCategories(d.categories)))
  ).sort();

  const batchFileMap = useRef<Map<string, File>>(new Map());

  // ── Handlers ──────────────────────────────────────

  const handleFiles = useCallback((fs: File[]) => {
    upload.setFiles(fs);
    setBatchResults([]);
    setResult(null);
    upload.setPreviewUrl(fs.length === 1 ? URL.createObjectURL(fs[0]) : null);
  }, [setBatchResults, upload.setFiles, upload.setPreviewUrl]);

  const handleDetect = useCallback(async () => {
    if (upload.files.length === 0) return;
    timer.startTimer();
    batchFileMap.current.clear();

    try {
      if (model.appMode === "validate") {
        let token: string | undefined;
        if (validateModelSource === "upload") {
          if (!externalModelFile) { toast.error(t("home.modelUploadRequired")); return; }
          let cachedToken = tokenCache.get(externalModelFile);
          if (!cachedToken) {
            let promise = uploadCache.get(externalModelFile);
            if (!promise) {
              const form = new FormData();
              form.append("file", externalModelFile);
              promise = (async () => {
                const resp = await fetch(`${API_BASE}/train/upload-model`, { method: "POST", body: form });
                const json = await resp.json();
                if (json.data?.token) { tokenCache.set(externalModelFile, json.data.token); return json.data.token; }
                throw new Error("No token returned");
              })();
              uploadCache.set(externalModelFile, promise);
            }
            try { cachedToken = await promise; } catch {
              tokenCache.delete(externalModelFile); uploadCache.delete(externalModelFile);
              toast.error(t("home.uploadModelFailed")); return;
            }
          }
          token = cachedToken;
        } else if (!selectedTrainedJobId) { toast.error(t("home.modelSelectionRequired")); return; }

        const results: Detection[] = [];
        setBatchProgress({ current: 0, total: upload.files.length });
        for (let i = 0; i < upload.files.length; i++) {
          const data = await runValidation(upload.files[i], selectedTrainedJobId || undefined, token);
          if (data) {
            results.push(data); setBatchResults([...results]);
            if (i === 0) { setResult(data); upload.setPreviewUrl(URL.createObjectURL(upload.files[i])); }
          }
          setBatchProgress({ current: i + 1, total: upload.files.length });
        }
        setBatchProgress({ current: 0, total: 0 });
        return;
      }

      if (upload.categories.length === 0) return;
      await runBatch(
        upload.files, upload.categories,
        model.useSam2, model.sam2ScoreThreshold,
        model.useSam3, model.sam3Text, model.useSam3Seg,
        model.sam3Threshold, model.sam3MaskThreshold,
        (data, file, i) => {
          batchFileMap.current.set(data.id, file);
          if (i === 0) { setResult(data); upload.setPreviewUrl(URL.createObjectURL(file)); }
        },
      );
      queryClient.invalidateQueries({ queryKey: ["detections"] });
    } finally { timer.stopTimer(); }
  }, [
    upload.files, upload.categories, model.appMode, model.useSam2, model.sam2ScoreThreshold,
    model.useSam3, model.sam3Text, model.useSam3Seg, model.sam3Threshold, model.sam3MaskThreshold,
    validateModelSource, externalModelFile, selectedTrainedJobId,
    runValidation, runBatch, timer.startTimer, timer.stopTimer,
    queryClient, setBatchResults, setBatchProgress, upload.setPreviewUrl, t,
  ]);

  const handleSelectHistory = useCallback(async (det: Detection) => {
    upload.setFiles([]);
    batchFileMap.current.clear();
    upload.setPreviewUrl(`${API_BASE}/detections/${det.id}/image`);
    const full = await getDetection(det.id);
    setResult(full);
    setBatchResults([]);
    upload.setCategories(parseCategories(full.categories));
    annotation.setFilterMode((full.filterMode as FilterMode) || "all");
    if (full.filterNmsIou != null) annotation.setNmsIou(full.filterNmsIou);
    annotation.setHiddenIndices(new Set());
  }, [setBatchResults, upload.setFiles, upload.setPreviewUrl, upload.setCategories, annotation.setFilterMode, annotation.setNmsIou, annotation.setHiddenIndices]);

  const handleReDetect = useCallback(async () => {
    if (!result) return;
    timer.startTimer();
    try {
      let file: File;
      const cached = batchFileMap.current.get(result.id);
      if (cached) { file = cached; } else {
        const blob = await fetch(`${API_BASE}/detections/${result.id}/image`).then((r) => r.blob());
        file = new File([blob], result.imageName, { type: blob.type });
      }
      const data = await detectMut.mutateAsync({
        file, categories: upload.categories,
        useSam2: model.useSam2, sam2ScoreThreshold: model.sam2ScoreThreshold,
        useSam3: model.useSam3, sam3Text: model.sam3Text, useSam3Seg: model.useSam3Seg,
        sam3Threshold: model.sam3Threshold, sam3MaskThreshold: model.sam3MaskThreshold,
      });
      if (data) batchFileMap.current.set(data.id, file);
      setResult(data);
      setBatchResults((prev) => prev.map((r) => (r.id === result.id ? data : r)));
    } catch { /* handled by mutation */ }
    finally { timer.stopTimer(); }
  }, [result, upload.categories, model, detectMut, timer, setBatchResults]);

  const handleDrawBox = useCallback(async (raw: { x1: number; y1: number; x2: number; y2: number }) => {
    if (!result || !annotation.drawCategory.trim()) { toast.error(t("home.drawCategoryRequired")); return; }
    try {
      await addBox(result.id, { ...raw, className: annotation.drawCategory.trim() });
      const newBox: BBox = { id: `manual-${Date.now()}`, className: annotation.drawCategory.trim(), ...raw, confidence: null };
      const updated = { ...result, boxes: [...result.boxes, newBox] };
      setResult(updated);
      setBatchResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch { /* ignore */ }
  }, [result, annotation.drawCategory, setBatchResults, t]);

  const handleDeleteBox = useCallback(async (boxId: string) => {
    if (!result) return;
    const box = result.boxes.find((b) => b.id === boxId);
    if (!box) return;
    try {
      await deleteBox(result.id, box.id);
      const updated = { ...result, boxes: result.boxes.filter((b) => b.id !== boxId) };
      setResult(updated);
      setBatchResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch { /* ignore */ }
  }, [result, setBatchResults]);

  const handleSelectKeyframe = useCallback((fs: File[]) => {
    upload.setFiles(fs);
    upload.setPreviewUrl(fs.length === 1 ? URL.createObjectURL(fs[0]) : null);
    setBatchResults([]);
    setResult(null);
  }, [setBatchResults, upload.setFiles, upload.setPreviewUrl]);

  const handleBatchSelect = useCallback((det: Detection, file?: File) => {
    setResult(det);
    if (file) upload.setPreviewUrl(URL.createObjectURL(file));
  }, [upload.setPreviewUrl]);

  const handleSaveBoxes = useCallback(async () => {
    if (!result) return;
    await annotation.handleSaveBoxes(result);
    setResult((prev) => prev ? { ...prev, filterMode: annotation.filterMode, filterNmsIou: annotation.filterMode === "nms" ? annotation.nmsIou : null } : null);
  }, [result, annotation]);

  const loading = detectMut.isPending || batchProgress.total > 0 || validating;

  const displayResult = useMemo(
    () => result ? { ...result, boxes: applyFilter(annotation.filterMode, result.boxes, annotation.nmsIou) } : null,
    [result, annotation.filterMode, annotation.nmsIou],
  );

  return {
    // Model config
    appMode: model.appMode, setAppMode: model.setAppMode,
    useSam2: model.useSam2, setUseSam2: model.setUseSam2,
    useSam3: model.useSam3, setUseSam3: model.setUseSam3,
    useSam3Seg: model.useSam3Seg, setUseSam3Seg: model.setUseSam3Seg,
    sam3Threshold: model.sam3Threshold, setSam3Threshold: model.setSam3Threshold,
    sam3MaskThreshold: model.sam3MaskThreshold, setSam3MaskThreshold: model.setSam3MaskThreshold,
    sam2ScoreThreshold: model.sam2ScoreThreshold, setSam2ScoreThreshold: model.setSam2ScoreThreshold,
    sam3Text: model.sam3Text, setSam3Text: model.setSam3Text,

    // Upload
    inputMode: upload.inputMode, setInputMode: upload.setInputMode,
    files: upload.files, setFiles: upload.setFiles,
    previewUrl: upload.previewUrl, setPreviewUrl: upload.setPreviewUrl,
    categories: upload.categories, setCategories: upload.setCategories,

    // Validation
    validateModelSource, setValidateModelSource,
    selectedTrainedJobId, setSelectedTrainedJobId,
    validateVideoId, setValidateVideoId,
    validateRunKey, setValidateRunKey,
    externalModelFile, setExternalModelFile,
    validateConf, setValidateConf, validateIou, setValidateIou, validating,

    // Annotation
    canvasMode: annotation.canvasMode, setCanvasMode: annotation.setCanvasMode,
    drawCategory: annotation.drawCategory, setDrawCategory: annotation.setDrawCategory,
    hiddenIndices: annotation.hiddenIndices, setHiddenIndices: annotation.setHiddenIndices,
    filterMode: annotation.filterMode, setFilterMode: annotation.setFilterMode,
    nmsIou: annotation.nmsIou, setNmsIou: annotation.setNmsIou,
    toggleBoxVisibility: annotation.toggleBoxVisibility,

    // Timer
    elapsedMs: timer.elapsedMs,

    // Core state
    result, setResult,
    batchResults, setBatchResults,
    batchProgress, setBatchProgress,
    historyData, recentCategories,

    // Handlers
    handleFiles, handleDetect, handleSelectHistory, handleReDetect,
    handleDrawBox, handleDeleteBox, handleSelectKeyframe, handleBatchSelect,
    handleSaveBoxes, cancelBatch,
    loading, displayResult,
  };
}
