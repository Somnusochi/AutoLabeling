import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  deleteDetection,
  detectImage,
  exportBatch,
  getDetection,
  listDetections,
  downloadBlob,
} from "@/services/api";

// ── Queries ──────────────────────────────────────────

export function useDetectionListQuery(page = 1) {
  return useQuery({
    queryKey: ["detections", page],
    queryFn: () => listDetections(page),
    staleTime: 30_000,
  });
}

export function useDetectionDetailQuery(id: string) {
  return useQuery({
    queryKey: ["detections", id],
    queryFn: () => getDetection(id),
    enabled: !!id,
  });
}

// ── Mutations ────────────────────────────────────────

export function useDetectMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ file, categories }: { file: File; categories: string[] }) =>
      detectImage(file, categories),
    onSuccess: (data) => {
      toast.success(`检测完成，找到 ${data.boxes.length} 个目标`);
      qc.invalidateQueries({ queryKey: ["detections"] });
    },
    onError: () => {
      toast.error("检测失败，请重试");
    },
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
