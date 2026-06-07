// Using auto-imported centralized request helper

export async function detectImage(
  file: File,
  categories: string[],
  useSam2?: boolean,
  sam2ScoreThreshold?: number,
  useSam3?: boolean,
  sam3Text?: string,
  useSam3Seg?: boolean,
  sam3Threshold?: number,
  sam3MaskThreshold?: number,
): Promise<DetectResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("categories", JSON.stringify(categories));
  if (useSam3) {
    form.append("use_sam3", "true");
    if (sam3Text) form.append("sam3_text", sam3Text);
    if (useSam3Seg === false) form.append("use_sam3_seg", "false");
    if (sam3Threshold != null) form.append("sam3_threshold", String(sam3Threshold));
    if (sam3MaskThreshold != null) form.append("sam3_mask_threshold", String(sam3MaskThreshold));
  } else if (useSam2) {
    form.append("use_sam2", "true");
    if (sam2ScoreThreshold != null) form.append("sam2_score_threshold", String(sam2ScoreThreshold));
  }
  const { data } = await request.post<{ data: DetectResponse }>("/detect", form);
  return data.data;
}

export async function listDetections(
  page = 1,
  pageSize = 10000,
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
  const { data } = await request.get<ListResponse<TrainingJob>>("/train/jobs", {
    params: { pageSize: 10000 },
  });
  return data.data ?? [];
}

export async function cancelTrainingJob(id: string): Promise<TrainingJob> {
  const { data } = await request.post<{ data: TrainingJob }>(`/train/jobs/${id}/cancel`);
  return data.data;
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

export async function listVideos(
  page = 1,
  pageSize = 20,
): Promise<{ items: VideoInfo[]; total: number }> {
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
  params: {
    method: string;
    threshold?: number;
    intervalSeconds?: number;
    maxFrames?: number;
    ssimThreshold?: number;
  },
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

export interface ModelStatus {
  loaded: boolean;
  state: "unloaded" | "downloading" | "loading" | "loaded" | "error";
  stage: string;
  progress: number;
  error: string;
}

export async function getModelStatus(): Promise<ModelStatus> {
  const { data } = await request.get<{ data: ModelStatus }>("/model/status");
  return data.data;
}

export async function unloadModel(): Promise<void> {
  await request.post("/model/unload");
}

export async function getSam2Status(): Promise<ModelStatus> {
  const { data } = await request.get<{ data: ModelStatus }>("/model/sam2/status");
  return data.data;
}

export async function unloadSam2(): Promise<void> {
  await request.post("/model/sam2/unload");
}

export interface Sam3Status {
  loaded: boolean;
  status: string; // "starting" | "loading" | "loaded" | "unloaded"
}

export async function checkSam3Health(): Promise<Sam3Status> {
  try {
    const resp = await request.get("/model/sam3/status");
    const inner = resp.data?.data;
    return {
      loaded: inner?.loaded === true,
      status: inner?.status || "unloaded",
    };
  } catch {
    return { loaded: false, status: "unloaded" };
  }
}

export async function unloadSam3(): Promise<void> {
  await request.post("/model/sam3/unload");
}
