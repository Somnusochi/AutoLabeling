import { useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useDetectionListQuery } from "./useDetection";
import { getDetection } from "@/services/api";
import { API_BASE } from "@/lib/constants";
import type { Detection } from "@/types";
import { parseCategories } from "@/lib/parsers";
import type { FilterMode } from "@/lib/filterBoxes";
import { batchFileMap } from "@/lib/cache";

export function useDetectionHistory() {
  const { setPreviewUrl, setCategories, setFilterMode, setNmsIou, setHiddenIndices, setResult, setFiles, setBatchResults } =
    useAppStore();

  const { data: historyData } = useDetectionListQuery();
  const recentCategories = Array.from<string>(
    new Set((historyData?.items ?? []).flatMap((d: Detection) => parseCategories(d.categories))),
  ).sort();

  const handleSelectHistory = useCallback(
    async (det: Detection) => {
      setFiles([]);
      batchFileMap.clear();
      try {
        const full = await getDetection(det.id);
        setBatchResults([]);
        setResult(full);
        setPreviewUrl(`${API_BASE}/detections/${det.id}/image`);
        setCategories(parseCategories(full.categories));
        setFilterMode((full.filterMode as FilterMode) || "all");
        if (full.filterNmsIou != null) setNmsIou(full.filterNmsIou);
        setHiddenIndices(new Set());
      } catch (e) {
        console.error("Failed to load history detection:", e);
      }
    },
    [
      setBatchResults,
      setFiles,
      setPreviewUrl,
      setCategories,
      setFilterMode,
      setNmsIou,
      setHiddenIndices,
      setResult,
    ],
  );

  return {
    historyData,
    recentCategories,
    handleSelectHistory,
  };
}
