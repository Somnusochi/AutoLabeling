// Using auto-imported centralized request helper

export async function detectImage(
  file: File,
  categories: string[],
  useSam2?: boolean,
): Promise<DetectResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("categories", JSON.stringify(categories));
  if (useSam2) form.append("use_sam2", "true");
  const { data } = await request.post<{ data: DetectResponse }>("/detect", form);
  return data.data;
}

export async function listDetections(
  page = 1,
  pageSize = 20,
): Promise<{ items: Detection[]; total: number }> {
  const { data } = await request.get<ListResponse<Detection>>("/detections", {
    params: { page, pageSize },
  });
  return { items: data.data, total: data.total };
}

export async function getDetection(id: string): Promise<Detection> {
  const { data } = await request.get<{ data: Detection }>(`/detections/${id}`);
  return data.data;
}

export async function deleteDetection(id: string): Promise<void> {
  await request.post(`/detections/${id}/delete`);
}

export async function deleteBox(detectionId: string, boxId: string): Promise<void> {
  await request.post(`/detections/${detectionId}/boxes/${boxId}/delete`);
}

export async function addBox(
  detectionId: string,
  box: { className: string; x1: number; y1: number; x2: number; y2: number },
): Promise<void> {
  await request.post(`/detections/${detectionId}/boxes`, box);
}

export function exportSingleUrl(id: string): string {
  return `${API_BASE}/detections/${id}/export`;
}

export async function exportBatch(ids: string[], format = "yolo"): Promise<Blob> {
  const { data } = await request.post(
    "/detections/export-batch",
    { detectionIds: ids, format },
    { responseType: "blob" },
  );
  return data;
}

// ── Training ────────────────────────────────────

export type YoloSeries = Record<string, { label: string; variants: Record<string, string> }>;

export async function fetchYoloSeries(): Promise<YoloSeries> {
  const { data } = await request.get<{ data: YoloSeries }>("/train/variants");
  return data.data;
}

export async function startTraining(params: {
  detectionIds: string[];
  modelVariant: string;
  epochs: number;
  imgsz: number;
  batch: number;
  trainRatio: number;
  valRatio: number;
  taskType: string;
}): Promise<TrainingJob> {
  const { data } = await request.post<{ data: TrainingJob }>("/train/jobs", params);
  return data.data;
}

export async function fetchTrainingJobs(): Promise<TrainingJob[]> {
  const { data } = await request.get<ListResponse<TrainingJob>>("/train/jobs");
  return data.data ?? [];
}

export async function deleteTrainingJob(id: string): Promise<void> {
  await request.post(`/train/jobs/${id}/delete`);
}

// ── Utils ───────────────────────────────────────

export async function saveFilterSettings(
  detectionId: string,
  filterMode: string,
  filterNmsIou: number | null,
): Promise<void> {
  await request.put(`/detections/${detectionId}/filter-settings`, {
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
  const { data } = await request.post<{ data: VideoInfo }>("/videos/upload", form);
  return data.data;
}

export async function listVideos(page = 1, pageSize = 20): Promise<{ items: VideoInfo[]; total: number }> {
  const { data } = await request.get<ListResponse<VideoInfo>>("/videos", {
    params: { page, pageSize },
  });
  return { items: data.data, total: data.total };
}

export async function getVideo(id: string): Promise<VideoInfo> {
  const { data } = await request.get<{ data: VideoInfo }>(`/videos/${id}`);
  return data.data;
}

export async function extractKeyframes(
  videoId: string,
  params: { method: string; threshold?: number; intervalSeconds?: number; maxFrames?: number; ssimThreshold?: number },
): Promise<VideoInfo> {
  const { data } = await request.post<{ data: VideoInfo }>(
    `/videos/${videoId}/extract-keyframes`,
    params,
  );
  return data.data;
}

export async function deleteVideo(id: string): Promise<void> {
  await request.post(`/videos/${id}/delete`);
}

export function keyframeImageUrl(videoId: string, keyframeId: string): string {
  return `${API_BASE}/videos/${videoId}/keyframes/${keyframeId}/image`;
}

export function downloadModelUrl(jobId: string): string {
  return `${API_BASE}/train/jobs/${jobId}/download`;
}

export function chartUrl(jobId: string): string {
  return `${API_BASE}/train/jobs/${jobId}/charts/results.png`;
}

export function downloadOnnxUrl(jobId: string): string {
  return `${API_BASE}/train/jobs/${jobId}/export-onnx`;
}

export function downloadDatasetUrl(jobId: string): string {
  return `${API_BASE}/train/jobs/${jobId}/dataset`;
}

// ── Model ────────────────────────────────────────

export async function getModelStatus(): Promise<{ loaded: boolean }> {
  const { data } = await request.get<{ data: { loaded: boolean } }>("/model/status");
  return data.data;
}

export async function unloadModel(): Promise<void> {
  await request.post("/model/unload");
}
