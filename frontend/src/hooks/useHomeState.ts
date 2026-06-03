export function useHomeState() {
  const { t } = useTranslation();
  // ── Mode ────────────────────────────────────────
  const [appMode, setAppMode] = useState<"annotate" | "validate">("annotate");
  const [validateModelSource, setValidateModelSource] = useState<"trained" | "upload">("trained");
  const [selectedTrainedJobId, setSelectedTrainedJobId] = useState<string | null>(null);

  // ── Upload & categories ──────────────────────────
  const [inputMode, setInputMode] = useState<"image" | "video">("image");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [validateVideoId, setValidateVideoId] = useState<string | null>(null);
  const [validateRunKey, setValidateRunKey] = useState(0);
  const [externalModelFile, setExternalModelFile] = useState<File | null>(null);

  // ── Detection ────────────────────────────────────
  const queryClient = useQueryClient();
  const detectMut = useDetectMutation();
  const [result, setResult] = useState<Detection | null>(null);

  // ── Batch processing ─────────────────────────────
  const { batchResults, batchProgress, runBatch, cancelBatch, setBatchResults, setBatchProgress } = useBatchDetection();

  // ── YOLO Validation ──────────────────────────────
  const {
    validateConf, validateIou, validating,
    setValidateConf, setValidateIou, runValidation,
  } = useYoloValidation();

  // Synchronize validation panel tabs and select the training job when "yolo-validate" is triggered
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAppMode("validate");
      setValidateModelSource("trained");
      setSelectedTrainedJobId(detail.jobId);
    };
    window.addEventListener("yolo-validate", handler);
    return () => window.removeEventListener("yolo-validate", handler);
  }, []);

  // ── Manual annotation ────────────────────────────
  const [canvasMode, setCanvasMode] = useState<"view" | "draw">("view");
  const [drawCategory, setDrawCategory] = useState("");
  const [hiddenIndices, setHiddenIndices] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [nmsIou, setNmsIou] = useState(0.5);

  const handleSaveBoxes = useCallback(async () => {
    if (!result) return;
    try {
      await saveFilterSettings(result.id, filterMode, filterMode === "nms" ? nmsIou : null);
      setResult({ ...result, filterMode: filterMode, filterNmsIou: filterMode === "nms" ? nmsIou : null });
      queryClient.invalidateQueries({ queryKey: ["detections"] });
      toast.success(t("home.saveFilterSuccess"));
    } catch {
      toast.error(t("home.saveFilterFailed"));
    }
  }, [result, filterMode, nmsIou, queryClient, t]);

  const toggleBoxVisibility = useCallback((boxId: string) => {
    setHiddenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(boxId)) { next.delete(boxId); } else { next.add(boxId); }
      return next;
    });
  }, []);

  // ── Detection timer ───────────────────────────────
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setElapsedMs(0);
    timerRef.current = setInterval(() => setElapsedMs((prev) => prev + 100), 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── History ──────────────────────────────────────
  const { data: historyData } = useDetectionListQuery();
  const recentCategories = Array.from(
    new Set((historyData?.items ?? []).flatMap((d) => parseCategories(d.categories)))
  ).sort();

  // ── Handlers ─────────────────────────────────────

  const handleFiles = useCallback((fs: File[]) => {
    setFiles(fs);
    setBatchResults([]);
    setResult(null);
    setPreviewUrl(fs.length === 1 ? URL.createObjectURL(fs[0]) : null);
  }, [setBatchResults]);

  // Maps detection_id → File for batch results that can be re-detected
  const batchFileMap = useRef<Map<string, File>>(new Map());

  const handleDetect = useCallback(async () => {
    if (files.length === 0) return;

    startTimer();
    batchFileMap.current.clear();

    try {
      if (appMode === "validate") {
        let token: string | undefined = undefined;

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
                const resp = await fetch(`${API_BASE}/train/upload-model`, { method: "POST", body: form });
                const json = await resp.json();
                if (json.data?.token) {
                  tokenCache.set(externalModelFile, json.data.token);
                  return json.data.token;
                }
                throw new Error("No token returned from server");
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
        } else {
          if (!selectedTrainedJobId) {
            toast.error(t("home.modelSelectionRequired"));
            return;
          }
        }

        // Batch-validate all files
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
      await runBatch(files, categories, (data, file, i) => {
        batchFileMap.current.set(data.id, file);
        if (i === 0) {
          setResult(data);
          setPreviewUrl(URL.createObjectURL(file));
        }
      });
      queryClient.invalidateQueries({ queryKey: ["detections"] });
    } finally {
      stopTimer();
    }
  }, [files, categories, appMode, validateModelSource, externalModelFile, selectedTrainedJobId, runValidation, runBatch, startTimer, stopTimer, queryClient, setBatchResults, setBatchProgress]);

  const handleSelectHistory = useCallback((det: Detection) => {
    setFiles([]);
    batchFileMap.current.clear();
    setPreviewUrl(`${API_BASE}/detections/${det.id}/image`);
    setResult(det);
    setBatchResults([]);
    setCategories(parseCategories(det.categories));
    if (det.filterMode) setFilterMode(det.filterMode as FilterMode);
    else setFilterMode("all");
    if (det.filterNmsIou != null) setNmsIou(det.filterNmsIou);
    setHiddenIndices(new Set());
  }, [setBatchResults]);

  const handleReDetect = useCallback(async () => {
    if (!result) return;
    startTimer();
    try {
      let file: File;
      const cached = batchFileMap.current.get(result.id);
      if (cached) {
        file = cached;
      } else {
        const blob = await fetch(`${API_BASE}/detections/${result.id}/image`).then((r) => r.blob());
        file = new File([blob], result.imageName, { type: blob.type });
      }
      const data = await detectMut.mutateAsync({ file, categories });
      if (data) batchFileMap.current.set(data.id, file);
      setResult(data);
      setBatchResults((prev) => prev.map((r) => (r.id === result.id ? data : r)));
    } catch { /* handled by mutation */ }
    finally { stopTimer(); }
  }, [result, categories, detectMut, startTimer, stopTimer, setBatchResults]);

  const handleDrawBox = useCallback(async (raw: { x1: number; y1: number; x2: number; y2: number }) => {
    if (!result || !drawCategory.trim()) { toast.error(t("home.drawCategoryRequired")); return; }
    try {
      await addBox(result.id, { ...raw, className: drawCategory.trim() });
      const newBox: BBox = { id: `manual-${Date.now()}`, className: drawCategory.trim(), ...raw, confidence: null };
      const updated = { ...result, boxes: [...result.boxes, newBox] };
      setResult(updated);
      setBatchResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch { /* ignore */ }
  }, [result, drawCategory, setBatchResults]);

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

  const handleSelectKeyframe = useCallback((files: File[]) => {
    setFiles(files);
    setPreviewUrl(files.length === 1 ? URL.createObjectURL(files[0]) : null);
    setBatchResults([]);
    setResult(null);
  }, [setBatchResults]);

  const handleBatchSelect = useCallback((det: Detection, file?: File) => {
    setResult(det);
    if (file) setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const loading = detectMut.isPending || batchProgress.total > 0 || validating;

  const displayResult = useMemo(
    () => result ? { ...result, boxes: applyFilter(filterMode, result.boxes, nmsIou) } : null,
    [result, filterMode, nmsIou],
  );

  return {
    appMode, setAppMode,
    validateModelSource, setValidateModelSource,
    selectedTrainedJobId, setSelectedTrainedJobId,
    inputMode, setInputMode,
    files, setFiles,
    previewUrl, setPreviewUrl,
    categories, setCategories,
    validateVideoId, setValidateVideoId,
    validateRunKey, setValidateRunKey,
    externalModelFile, setExternalModelFile,
    result, setResult,
    batchResults, setBatchResults,
    batchProgress, setBatchProgress,
    validateConf, setValidateConf,
    validateIou, setValidateIou,
    validating,
    canvasMode, setCanvasMode,
    drawCategory, setDrawCategory,
    hiddenIndices, setHiddenIndices,
    filterMode, setFilterMode,
    nmsIou, setNmsIou,
    elapsedMs, setElapsedMs,
    historyData, recentCategories,
    handleFiles, handleDetect, handleSelectHistory, handleReDetect,
    handleDrawBox, handleDeleteBox, handleSelectKeyframe, handleBatchSelect,
    loading, displayResult, toggleBoxVisibility, handleSaveBoxes, cancelBatch
  };
}
