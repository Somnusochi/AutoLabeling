import { API_BASE } from "@/lib/constants";

interface Props {
  videoId: string;
  jobId: string;
  conf: number;
  iou: number;
}

export function VideoValidator({ videoId, jobId, conf, iou }: Props) {
  const mjpegUrl = `${API_BASE}/train/jobs/${jobId}/validate-mjpeg/${videoId}?conf=${conf}&iou=${iou}&_=${Date.now()}`;

  return (
    <div className="space-y-3">
      <div className="bg-black rounded-lg overflow-hidden">
        <img src={mjpegUrl} alt="实时推理" className="w-full" />
      </div>
      <p className="text-xs text-gray-400">MJPEG 实时推理流 — 逐帧 YOLO 检测</p>
    </div>
  );
}
