import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/constants";

interface Props {
  videoId: string;
  jobId?: string;
  modelFile?: File;
  conf: number;
  iou: number;
}

export function VideoValidator({ videoId, jobId, modelFile, conf, iou }: Props) {
  const [paused, setPaused] = useState(false);
  const [mjpegUrl, setMjpegUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      if (modelFile) {
        // Step 1: upload model → get token
        const form = new FormData();
        form.append("file", modelFile);
        const resp = await fetch(`${API_BASE}/train/upload-model`, { method: "POST", body: form });
        const json = await resp.json();
        if (!cancelled && json.data?.token) {
          setMjpegUrl(`${API_BASE}/train/validate-mjpeg/${json.data.token}/${videoId}?conf=${conf}&iou=${iou}`);
        }
      } else if (jobId) {
        setMjpegUrl(`${API_BASE}/train/jobs/${jobId}/validate-mjpeg/${videoId}?conf=${conf}&iou=${iou}`);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [videoId, jobId, modelFile, conf, iou]);

  return (
    <div className="space-y-3">
      <div className="bg-black rounded-lg overflow-hidden relative">
        {loading && (
          <div className="flex items-center justify-center py-24 text-sm text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {modelFile ? "上传模型中..." : "连接中..."}
          </div>
        )}
        {mjpegUrl && !loading && (
          <img src={mjpegUrl} alt="实时推理" className={`w-full ${paused ? "hidden" : ""}`} />
        )}
        {paused && !loading && (
          <div className="flex items-center justify-center py-24 text-sm text-gray-400 bg-gray-900">已暂停</div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setPaused(!paused)} disabled={loading || !mjpegUrl}
          className="text-sm font-medium text-gray-700 hover:text-primary-600 disabled:opacity-50">
          {paused ? "播放" : "暂停"}
        </button>
        <span className="text-xs text-gray-400">MJPEG 实时推理流 — 逐帧 YOLO 检测</span>
      </div>
    </div>
  );
}
