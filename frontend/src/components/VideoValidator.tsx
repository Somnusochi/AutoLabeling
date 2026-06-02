import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/constants";

interface Props {
  videoFile: File;
  jobId: string;
  conf: number;
  iou: number;
}

export function VideoValidator({ videoFile, jobId, conf, iou }: Props) {
  const [mjpegUrl, setMjpegUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoading(true);
    const form = new FormData();
    form.append("file", videoFile, "video.mp4");
    form.append("conf", String(conf));
    form.append("iou", String(iou));

    const url = `${API_BASE}/train/jobs/${jobId}/validate-mjpeg`;
    // Use XHR to POST and get the stream URL
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "blob";
    xhr.onload = () => {
      if (xhr.status === 200) {
        const blobUrl = URL.createObjectURL(xhr.response);
        setMjpegUrl(blobUrl);
        setLoading(false);
      }
    };
    xhr.onerror = () => setLoading(false);
    xhr.send(form);

    return () => {
      xhr.abort();
      if (mjpegUrl) URL.revokeObjectURL(mjpegUrl);
    };
  }, [videoFile, jobId, conf, iou]);

  return (
    <div className="space-y-3">
      <div className="bg-black rounded-lg overflow-hidden">
        {loading && !mjpegUrl && (
          <div className="flex items-center justify-center py-24 text-sm text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            正在启动推理...
          </div>
        )}
        {mjpegUrl && (
          <img ref={imgRef} src={mjpegUrl} alt="实时推理" className="w-full" />
        )}
      </div>
      {!loading && mjpegUrl && (
        <p className="text-xs text-gray-400">MJPEG 实时推理流 — 已连接到后端</p>
      )}
    </div>
  );
}
