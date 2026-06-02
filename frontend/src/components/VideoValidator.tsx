import { useCallback, useEffect, useRef, useState } from "react";
import { BOX_COLORS, API_BASE } from "@/lib/constants";
import type { BBox } from "@/types";

interface Props {
  videoFile: File;
  jobId: string;
  conf: number;
  iou: number;
}

export function VideoValidator({ videoFile, jobId, conf, iou }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<BBox[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fps, setFps] = useState(0);
  const detectingRef = useRef(false);
  const lastDetectTime = useRef(0);

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const detectFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || detectingRef.current) return;
    detectingRef.current = true;

    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.7));

    const form = new FormData();
    form.append("file", blob, "frame.jpg");
    form.append("conf", String(conf));
    form.append("iou", String(iou));

    try {
      const resp = await fetch(`${API_BASE}/train/jobs/${jobId}/predict`, { method: "POST", body: form });
      const json = await resp.json();
      if (resp.ok && json.data?.boxes) {
        setBoxes(json.data.boxes.map((b: Record<string, unknown>, i: number) => ({
          id: `v-${Date.now()}-${i}`,
          className: b.className as string,
          x1: b.x1 as number, y1: b.y1 as number,
          x2: b.x2 as number, y2: b.y2 as number,
          confidence: b.confidence as number,
        })));
        const now = Date.now();
        if (lastDetectTime.current > 0) {
          setFps(Math.round(1000 / (now - lastDetectTime.current)));
        }
        lastDetectTime.current = now;
      }
    } catch { /* ignore */ }
    detectingRef.current = false;
  }, [jobId, conf, iou]);

  // Continuous detection loop while playing
  useEffect(() => {
    if (!playing) return;
    let timer: ReturnType<typeof setInterval>;
    const start = () => {
      timer = setInterval(() => detectFrame(), 500);
    };
    start();
    return () => clearInterval(timer);
  }, [playing, detectFrame]);

  // Canvas overlay
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const redraw = () => {
      const w = video.clientWidth;
      const h = video.clientHeight;
      canvas.width = w;
      canvas.height = h;
      const sx = w / (video.videoWidth || 1);
      const sy = h / (video.videoHeight || 1);
      ctx.clearRect(0, 0, w, h);
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
    redraw();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [boxes]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
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
        {!playing && (
          <button onClick={detectFrame} className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700">
            检测当前帧
          </button>
        )}
        <span className="text-xs text-gray-400">{boxes.length} 个目标</span>
        {fps > 0 && <span className="text-xs text-gray-400">~{fps} FPS</span>}
        <span className="text-xs text-gray-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-gray-200 cursor-pointer" onClick={seek}>
        <div
          className="h-full rounded-full bg-primary-500 transition-all"
          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
