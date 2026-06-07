import { useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/useAppStore";
import { batchFileMap } from "@/lib/cache";
import { useDetectionTimer } from "./useDetectionTimer";
import { useBatchDetection } from "./useBatchDetection";
import { useYoloValidation } from "./useYoloValidation";
import { useDetectMutation } from "./useDetection";
import { optimisticModelLoading } from "./useModelEvents";
import { API_BASE, tokenCache, uploadCache } from "@/lib/constants";
import type { Detection } from "@/types";

export function useDetectionProcess() {
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
    result,
    setResult,
    setBatchResults,
  } = useAppStore();

  const timer = useDetectionTimer();
  const queryClient = useQueryClient();
  const detectMut = useDetectMutation();
  const abortRef = useRef<AbortController | null>(null);

  const { batchProgress, runBatch, cancelBatch, setBatchProgress } =
    useBatchDetection();
  const { validating, runValidation } = useYoloValidation();

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    cancelBatch();
  }, [cancelBatch]);

  // Create fresh AbortController for each operation
  const newAbortController = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    return ctrl;
  }, []);

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

  const handleFiles = useCallback(
    (fs: File[]) => {
      setFiles(fs);
      setBatchResults([]);
      setResult(null);
      setPreviewUrl(fs.length === 1 ? URL.createObjectURL(fs[0]) : null);
    },
    [setBatchResults, setFiles, setPreviewUrl, setResult],
  );

  const handleSelectKeyframe = useCallback(
    (fs: File[]) => {
      setFiles(fs);
      setPreviewUrl(fs.length === 1 ? URL.createObjectURL(fs[0]) : null);
      setBatchResults([]);
      setResult(null);
    },
    [setBatchResults, setFiles, setPreviewUrl, setResult],
  );

  const handleBatchSelect = useCallback(
    (det: Detection, file?: File) => {
      setResult(det);
      if (file) setPreviewUrl(URL.createObjectURL(file));
    },
    [setPreviewUrl, setResult],
  );

  const handleDetect = useCallback(async () => {
    if (files.length === 0) return;
    if (useSam2) optimisticModelLoading("sam2");
    if (!useSam2 && !useSam3) optimisticModelLoading("vlm");
    timer.startTimer();
    batchFileMap.clear();
    const ctrl = newAbortController();

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
                  signal: ctrl.signal,
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
            } catch (e) {
              if (e instanceof DOMException && e.name === "AbortError") return;
              console.error("Upload model failed:", e);
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
          if (ctrl.signal.aborted) break;
          const data = await runValidation(files[i], selectedTrainedJobId || undefined, token, ctrl.signal);
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
          batchFileMap.set(data.id, file);
          setBatchResults((prev) => {
            const exists = prev.some((p) => p.id === data.id);
            return exists ? prev : [...prev, data];
          });
          if (i === 0) {
            setResult(data);
            setPreviewUrl(URL.createObjectURL(file));
          }
        },
        ctrl.signal,
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
    setResult,
    t,
  ]);

  const handleReDetect = useCallback(async () => {
    if (!result) return;
    const ctrl = newAbortController();
    timer.startTimer();
    try {
      let file: File;
      const cached = batchFileMap.get(result.id);
      if (cached) {
        file = cached;
      } else {
        const blob = await fetch(`${API_BASE}/detections/${result.id}/image`, { signal: ctrl.signal }).then((r) => r.blob());
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
        signal: ctrl.signal,
      });
      if (data) batchFileMap.set(data.id, file);
      setResult(data);
      setBatchResults((prev) => prev.map((r) => (r.id === result.id ? data : r)));
    } catch (e) {
      console.error("Re-detect failed:", e);
      toast.error(t("home.redetectFailed") || "Re-detect failed");
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
    setResult,
    t,
  ]);

  const loading = detectMut.isPending || batchProgress.total > 0 || validating;

  return {
    elapsedMs: timer.elapsedMs,
    batchProgress,
    setBatchProgress,
    handleFiles,
    handleSelectKeyframe,
    handleBatchSelect,
    handleDetect,
    handleReDetect,
    cancel,
    loading,
  };
}
