import { useEffect, useRef, useState } from "react";
import { BOX_COLORS, API_BASE } from "@/lib/constants";
import type { BBox } from "@/types";

interface Props {
  videoFile: File;
  jobId: string;
  conf: number;
  iou: number;
}

interface FrameResult {
  frame: number;
  timestamp: number;
  boxes: BBox[];
  imageWidth: number;
  imageHeight: number;
}

export function VideoValidator({ videoFile, jobId, conf, iou }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const resultsRef = useRef<FrameResult[]>([]);
  const currentBoxesRef = useRef<BBox[]>([]);

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  // Auto-start SSE processing on mount
  useEffect(() => {
    startProcessing();
  }, []);

  // SSE: send video → receive frame-by-frame detections
  const startProcessing = async () => {
    if (processing) return;
    setProcessing(true);
    resultsRef.current = [];
    currentBoxesRef.current = [];
    setProgress({ done: 0, total: 0 });
    drawBoxes([]);

    const form = new FormData();
    form.append("file", videoFile, "video.mp4");
    form.append("conf", String(conf));
    form.append("iou", String(iou));
    form.append("interval", "1.0");

    // Use fetch to POST the video, then read the SSE response
    const resp = await fetch(`${API_BASE}/train/jobs/${jobId}/predict-video-stream`, {
      method: "POST",
      body: form,
    });
    if (!resp.ok || !resp.body) { setProcessing(false); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const totalEstimate = Math.ceil(duration);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.done) {
            setProgress({ done: data.frames, total: data.frames });
            continue;
          }
          const fr: FrameResult = {
            frame: data.frame,
            timestamp: data.timestamp,
            imageWidth: data.imageWidth,
            imageHeight: data.imageHeight,
            boxes: data.boxes.map((b: Record<string, unknown>, i: number) => ({
              id: `v-${data.frame}-${i}`,
              className: b.className as string,
              x1: b.x1 as number, y1: b.y1 as number,
              x2: b.x2 as number, y2: b.y2 as number,
              confidence: b.confidence as number,
            })),
          };
          resultsRef.current.push(fr);
          setProgress({ done: resultsRef.current.length, total: totalEstimate });
        } catch { /* skip malformed */ }
      }
    }
    setProcessing(false);
  };

  // Sync boxes to current video time
  const syncBoxes = () => {
    const results = resultsRef.current;
    if (results.length === 0) return;

    const t = videoRef.current?.currentTime ?? 0;
    // Find closest result by timestamp
    let closest = results[0];
    let minDiff = Math.abs(closest.timestamp - t);
    for (const r of results) {
      const diff = Math.abs(r.timestamp - t);
      if (diff < minDiff) { minDiff = diff; closest = r; }
    }
    currentBoxesRef.current = closest.boxes;
    drawBoxes(closest.boxes);
  };

  // Draw boxes on canvas overlay
  const drawBoxes = (boxes: BBox[]) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = video.clientWidth;
    const h = video.clientHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    const result = resultsRef.current[0];
    const sx = w / ((result?.imageWidth || video.videoWidth) || 1);
    const sy = h / ((result?.imageHeight || video.videoHeight) || 1);

    boxes.forEach((box, i) => {
      const x = box.x1 * sx, y = box.y1 * sy;
      const bw = (box.x2 - box.x1) * sx, bh = (box.y2 - box.y1) * sy;
      const color = BOX_COLORS[i % BOX_COLORS.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, bw, bh);
      const label = `${box.className} ${box.confidence != null ? (box.confidence * 100).toFixed(0) + "%" : ""}`;
      const tw = ctx.measureText(label).width + 8;
      const ly = y < 20 ? y + 2 : y - 20;
      const ty = y < 20 ? y + 14 : y - 6;
      ctx.fillStyle = color;
      ctx.fillRect(x, ly, tw, 20);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x + 4, ty);
    });
  };

  useEffect(() => {
    const iv = setInterval(syncBoxes, 100);
    return () => clearInterval(iv);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v?.duration) return;
    v.currentTime = ((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth) * v.duration;
  };

  if (!videoUrl) return null;

  return (
    <div className="space-y-3">
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full"
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onClick={togglePlay}
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={togglePlay} className="text-sm font-medium text-gray-700 hover:text-primary-600">
          {playing ? "暂停" : "播放"}
        </button>
        {processing && (
          <span className="text-xs text-gray-500">推理中... {progress.done} 帧</span>
        )}
        {!processing && resultsRef.current.length > 0 && (
          <span className="text-xs text-gray-400">完成 {resultsRef.current.length} 帧</span>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-gray-200 cursor-pointer relative" onClick={seek}>
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
        {resultsRef.current.length > 0 && (
          resultsRef.current.map((r) => (
            <div
              key={r.frame}
              className="absolute top-0 h-full w-0.5 bg-green-400"
              style={{ left: `${(r.timestamp / duration) * 100}%` }}
              title={`${r.boxes.length} detections`}
            />
          ))
        )}
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        <span>{currentBoxesRef.current.length} 个目标</span>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
