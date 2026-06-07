export function useDetectionListQuery(page = 1) {
  return useQuery({
    queryKey: ["detections", page],
    queryFn: () => listDetections(page),
    staleTime: 30_000,
  });
}

export function useDetectMutation() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      categories,
      useSam2,
      sam2ScoreThreshold,
      useSam3,
      sam3Text,
      useSam3Seg,
      sam3Threshold,
      sam3MaskThreshold,
    }: {
      file: File;
      categories: string[];
      useSam2?: boolean;
      sam2ScoreThreshold?: number;
      useSam3?: boolean;
      sam3Text?: string;
      useSam3Seg?: boolean;
      sam3Threshold?: number;
      sam3MaskThreshold?: number;
      signal?: AbortSignal;
    }) =>
      detectImage(
        file,
        categories,
        useSam2,
        sam2ScoreThreshold,
        useSam3,
        sam3Text,
        useSam3Seg,
        sam3Threshold,
        sam3MaskThreshold,
        signal,
      ),
    onMutate: ({ useSam2 }) => {
      qc.invalidateQueries({ queryKey: ["model-status"] });
      if (useSam2) qc.invalidateQueries({ queryKey: ["sam2-status"] });
    },
    onSuccess: (data, { useSam2 }) => {
      toast.success(t("detection.detectSuccess", { count: data.boxes.length }));
      qc.invalidateQueries({ queryKey: ["detections"] });
      qc.invalidateQueries({ queryKey: ["model-status"] });
      if (useSam2) qc.invalidateQueries({ queryKey: ["sam2-status"] });
    },
    onError: () => toast.error(t("detection.detectFailed")),
  });
}

export function useDeleteDetectionMutation() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDetection(id),
    onSuccess: () => {
      toast.success(t("historyList.deleteSuccess"));
      qc.invalidateQueries({ queryKey: ["detections"] });
    },
    onError: () => toast.error(t("historyList.deleteFailed")),
  });
}

export function useExportBatchMutation() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (ids: string[]) => exportBatch(ids),
    onSuccess: (blob) => {
      downloadBlob(blob, "yolo_labels.zip");
      toast.success(t("detection.exportSuccess"));
    },
    onError: () => toast.error(t("detection.exportFailed")),
  });
}
