import axios from "axios";
import type { Detection, DetectResponse, TrainingJob, VideoInfo, ListResponse } from "@/types";
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
): Promise<{ items: Detection[]; total: number }> {
  const { data } = await client.get<ListResponse<Detection>>("/detections", {
    params: { page, pageSize },
  });
  return { items: data.data, total: data.total };
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
  box: { className: string; x1: number; y1: number; x2: number; y2: number },
): Promise<void> {
  await client.post(`/detections/${detectionId}/boxes`, box);
}

export function exportSingleUrl(id: string): string {
  return `${API_BASE}/detections/${id}/export`;
}

export async function exportBatch(ids: string[]): Promise<Blob> {
  const { data } = await client.post(
    "/detections/export-batch",
    { detectionIds: ids },
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
  detectionIds: string[];
  modelVariant: string;
  epochs: number;
  imgsz: number;
  batch: number;
  splitRatio: number;
  taskType: string;
}): Promise<TrainingJob> {
  const { data } = await client.post<{ data: TrainingJob }>("/train/jobs", params);
  return data.data;
}

export async function fetchTrainingJobs(): Promise<TrainingJob[]> {
  const { data } = await client.get<ListResponse<TrainingJob>>("/train/jobs");
  return data.data ?? [];
}

export async function deleteTrainingJob(id: string): Promise<void> {
  await client.post(`/train/jobs/${id}/delete`);
}

// ── Utils ───────────────────────────────────────

export async function saveFilterSettings(
  detectionId: string,
  filterMode: string,
  filterNmsIou: number | null,
): Promise<void> {
  await client.put(`/detections/${detectionId}/filter-settings`, {
    filterMode,
    filterNmsIou,
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Video ───────────────────────────────────────

export async function uploadVideo(file: File): Promise<VideoInfo> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<{ data: VideoInfo }>("/videos/upload", form);
  return data.data;
}

export async function listVideos(page = 1, pageSize = 20): Promise<{ items: VideoInfo[]; total: number }> {
  const { data } = await client.get<ListResponse<VideoInfo>>("/videos", {
    params: { page, pageSize },
  });
  return { items: data.data, total: data.total };
}

export async function getVideo(id: string): Promise<VideoInfo> {
  const { data } = await client.get<{ data: VideoInfo }>(`/videos/${id}`);
  return data.data;
}

export async function extractKeyframes(
  videoId: string,
  params: { method: string; threshold?: number; intervalSeconds?: number; maxFrames?: number; ssimThreshold?: number },
): Promise<VideoInfo> {
  const { data } = await client.post<{ data: VideoInfo }>(
    `/videos/${videoId}/extract-keyframes`,
    params,
  );
  return data.data;
}

export async function deleteVideo(id: string): Promise<void> {
  await client.post(`/videos/${id}/delete`);
}

export function keyframeImageUrl(videoId: string, keyframeId: string): string {
  return `${API_BASE}/videos/${videoId}/keyframes/${keyframeId}/image`;
}
