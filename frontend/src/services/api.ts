import axios from "axios";
import type { Detection, DetectionList, DetectResponse } from "@/types";
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

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
