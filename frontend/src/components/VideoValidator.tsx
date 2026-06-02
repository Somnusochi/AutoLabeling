import { useState } from "react";
import { API_BASE } from "@/lib/constants";

interface Props {
  videoId: string;
  jobId: string;
  conf: number;
  iou: number;
}

export function VideoValidator({ videoId, jobId, conf, iou }: Props) {
  const [paused, setPaused] = useState(false);
  const mjpegUrl = `${API_BASE}/train/jobs/${jobId}/validate-mjpeg/${videoId}?conf=${conf}&iou=${iou}&_=${Date.now()}`;

  return (
    <div className="space-y-3">
      <div className="bg-black rounded-lg overflow-hidden relative">
        <img src={mjpegUrl} alt="实时推理" className={`w-full ${paused ? "hidden" : ""}`} />
        {paused && (
          <div className="flex items-center justify-center py-24 text-sm text-gray-400 bg-gray-900">
            已暂停
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setPaused(!paused)}
          className="text-sm font-medium text-gray-700 hover:text-primary-600"
        >
          {paused ? "播放" : "暂停"}
        </button>
        <span className="text-xs text-gray-400">MJPEG 实时推理流 — 逐帧 YOLO 检测</span>
      </div>
    </div>
  );
}
