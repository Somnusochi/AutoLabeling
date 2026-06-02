import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteDetection, detectImage, exportBatch,
  listDetections, downloadBlob,
} from "@/services/api";

export function useDetectionListQuery(page = 1) {
  return useQuery({
    queryKey: ["detections", page],
    queryFn: () => listDetections(page),
    staleTime: 30_000,
  });
}

export function useDetectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, categories }: { file: File; categories: string[] }) =>
      detectImage(file, categories),
    onSuccess: (data) => {
      toast.success(`检测完成，找到 ${data.boxes.length} 个目标`);
      qc.invalidateQueries({ queryKey: ["detections"] });
    },
    onError: () => toast.error("检测失败，请重试"),
  });
}

export function useDeleteDetectionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDetection(id),
    onSuccess: () => {
      toast.success("已删除");
      qc.invalidateQueries({ queryKey: ["detections"] });
    },
    onError: () => toast.error("删除失败"),
  });
}

export function useExportBatchMutation() {
  return useMutation({
    mutationFn: (ids: string[]) => exportBatch(ids),
    onSuccess: (blob) => {
      downloadBlob(blob, "yolo_labels.zip");
      toast.success("导出成功");
    },
    onError: () => toast.error("导出失败"),
  });
}
