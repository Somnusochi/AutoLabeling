/** Web Worker: chunked file upload with resume support. */

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_RETRIES = 3;
const API_BASE = "/api/v1";

interface UploadRequest {
  file: File;
  format: string;
  uploadId?: string;
}

interface InitResponse {
  uploadId: string;
  totalChunks: number;
  uploadedChunks: number[];
}

let _cancelled = false;

async function uploadChunk(
  uploadId: string,
  index: number,
  data: Blob,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (_cancelled) return false;
    try {
      const resp = await fetch(
        `${API_BASE}/datasets/import/chunk/${uploadId}/${index}`,
        { method: "PUT", body: data },
      );
      if (resp.ok) return true;
      if (resp.status === 404) throw new Error("Upload session not found");
    } catch {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  return false;
}

async function doUpload(file: File, format: string, uploadId?: string) {
  _cancelled = false;

  // 1. Init or resume upload session
  const initResp = await fetch(`${API_BASE}/datasets/import/chunk/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      totalSize: file.size,
      chunkSize: CHUNK_SIZE,
      format,
    }),
  });

  if (!initResp.ok) {
    const err = await initResp.json().catch(() => ({}));
    self.postMessage({ type: "error", message: err.detail || "Failed to init upload" });
    return;
  }

  const init: InitResponse = (await initResp.json()).data;
  const { uploadId: uid, totalChunks, uploadedChunks } = init;
  const skipSet = new Set(uploadedChunks);

  self.postMessage({ type: "init", uploadId: uid, totalChunks, uploadedChunks });

  // 2. Upload missing chunks
  for (let i = 0; i < totalChunks; i++) {
    if (_cancelled) {
      self.postMessage({ type: "cancelled" });
      return;
    }

    if (skipSet.has(i)) {
      self.postMessage({ type: "progress", chunk: i, totalChunks, skipped: true });
      continue;
    }

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);

    const ok = await uploadChunk(uid, i, blob);
    if (!ok) {
      self.postMessage({ type: "error", message: `Failed to upload chunk ${i}` });
      return;
    }

    self.postMessage({ type: "progress", chunk: i, totalChunks, skipped: false });
  }

  // 3. Complete
  if (_cancelled) {
    self.postMessage({ type: "cancelled" });
    return;
  }

  self.postMessage({ type: "complete", uploadId: uid, format });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "upload") {
    doUpload(msg.file, msg.format, msg.uploadId);
  } else if (msg.type === "cancel") {
    _cancelled = true;
  }
};
