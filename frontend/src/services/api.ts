import axios from "axios";
import type { Detection, DetectionList, DetectResponse, TrainingJob } from "@/types";
import { API_BASE } from "@/lib/constants";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 300_000,
});

export async function detectImage(
  file: File,
  categories: string[],
): Promise<DetectResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("categories", JSON.stringify(categories));
  const { data } = await client.post<{ data: DetectResponse }>("/detect", form);
  return data.data;
}

export async function listDetections(
  page = 1,
  pageSize = 20,
): Promise<DetectionList> {
  const { data } = await client.get<{ data: DetectionList }>("/detections", {
    params: { page, page_size: pageSize },
  });
  return data.data;
}

export async function getDetection(id: string): Promise<Detection> {
  const { data } = await client.get<{ data: Detection }>(`/detections/${id}`);
  return data.data;
}

export async function deleteDetection(id: string): Promise<void> {
  await client.post(`/detections/${id}/delete`);
}

export async function deleteBox(detectionId: string, boxId: string): Promise<void> {
  await client.post(`/detections/${detectionId}/boxes/${boxId}/delete`);
}

export async function addBox(
  detectionId: string,
  box: { class_name: string; x1: number; y1: number; x2: number; y2: number },
): Promise<void> {
  await client.post(`/detections/${detectionId}/boxes`, box);
}

export function exportSingleUrl(id: string): string {
  return `${API_BASE}/detections/${id}/export`;
}

export async function exportBatch(ids: string[]): Promise<Blob> {
  const { data } = await client.post(
    "/detections/export-batch",
    { detection_ids: ids },
    { responseType: "blob" },
  );
  return data;
}

// ── Training ────────────────────────────────────

export type YoloSeries = Record<string, { label: string; variants: Record<string, string> }>;

export async function fetchYoloSeries(): Promise<YoloSeries> {
  const { data } = await client.get<{ data: YoloSeries }>("/train/variants");
  return data.data;
}

export async function startTraining(params: {
  detection_ids: string[];
  model_variant: string;
  epochs: number;
  imgsz: number;
  batch: number;
}): Promise<TrainingJob> {
  const { data } = await client.post<{ data: TrainingJob }>("/train/jobs", params);
  return data.data;
}

export async function fetchTrainingJobs(): Promise<TrainingJob[]> {
  const { data } = await client.get<{ data: { items: TrainingJob[] } }>("/train/jobs");
  return data.data?.items ?? [];
}

export async function deleteTrainingJob(id: string): Promise<void> {
  await client.post(`/train/jobs/${id}/delete`);
}

// ── Utils ───────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
