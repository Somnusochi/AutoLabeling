import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { extractKeyframes, keyframeImageUrl } from "@/services/api";
import type { VideoInfo } from "@/types";

interface Props {
  video: VideoInfo;
  onLoadKeyframes: (files: File[], videoName: string) => void;
  onVideoUpdated: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  scene: "场景切换",
  motion: "运动检测",
  interval: "固定间隔",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoDetail({ video, onLoadKeyframes, onVideoUpdated }: Props) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<"scene" | "motion" | "interval">("scene");
  const [threshold, setThreshold] = useState(30);
  const [intervalSec, setIntervalSec] = useState(2);
  const [maxFrames, setMaxFrames] = useState(100);
  const [ssimThreshold, setSsimThreshold] = useState(0.95);
  const [expanded, setExpanded] = useState(false);

  const extractMut = useMutation({
    mutationFn: (params: Record<string, unknown>) =>
      extractKeyframes(video.id, params as {
        method: string; threshold?: number; intervalSeconds?: number;
        maxFrames: number; ssimThreshold: number;
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      onVideoUpdated();
      toast.success(`提取 ${data.keyframes.length} 个关键帧 (SSIM 去重后)`);
    },
    onError: () => toast.error("关键帧提取失败"),
  });

  const handleExtract = useCallback(() => {
    extractMut.mutate({
      method,
      threshold,
      intervalSeconds: intervalSec,
      maxFrames,
      ssimThreshold,
    });
  }, [extractMut, method, threshold, intervalSec, maxFrames, ssimThreshold]);

  const [loadingAll, setLoadingAll] = useState(false);
  const handleLoadAll = useCallback(async () => {
    if (video.keyframes.length === 0) return;
    setLoadingAll(true);
    try {
      const files: File[] = [];
      for (const kf of video.keyframes) {
        const resp = await fetch(keyframeImageUrl(video.id, kf.id));
        const blob = await resp.blob();
        files.push(new File([blob], `kf_${kf.frameNumber}.jpg`, { type: "image/jpeg" }));
      }
      onLoadKeyframes(files, video.fileName);
      toast.success(`已加载 ${files.length} 个关键帧到标注队列`);
    } catch {
      toast.error("加载失败");
    } finally {
      setLoadingAll(false);
    }
  }, [video, onLoadKeyframes]);

  const keyframes = video.keyframes;
  const visible = expanded ? keyframes : keyframes.slice(0, 12);
  const extracting = extractMut.isPending;

  return (
    <div className="space-y-4">
      {/* Video info bar */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold text-gray-800 truncate">{video.fileName}</span>
        <span className="text-gray-400 text-xs">
          {video.width}x{video.height}
          {video.duration != null && ` · ${video.duration.toFixed(1)}s`}
          {video.totalFrames != null && ` · ${video.totalFrames} 帧`}
        </span>
        {keyframes.length > 0 && (
          <span className="text-primary-600 text-xs font-medium">{keyframes.length} 个关键帧</span>
        )}
      </div>

      {/* Extraction controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-0.5 rounded bg-gray-100 p-0.5">
          {(["scene", "motion", "interval"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                method === m ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {METHOD_LABELS[m]}
            </button>
          ))}
        </div>

        {method === "scene" && (
          <label className="flex items-center gap-1 text-xs text-gray-500">
            灵敏度
            <input type="range" min={1} max={100} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-20 h-1 accent-primary-500" />
            <span className="w-6 text-gray-700">{threshold}</span>
          </label>
        )}
        {method === "motion" && (
          <label className="flex items-center gap-1 text-xs text-gray-500">
            位移
            <input type="range" min={1} max={50} step={0.5} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-20 h-1 accent-primary-500" />
            <span className="w-10 text-gray-700">{threshold}px</span>
          </label>
        )}
        {method === "interval" && (
          <label className="flex items-center gap-1 text-xs text-gray-500">
            间隔
            <input type="number" min={0.5} max={60} step={0.5} value={intervalSec}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
              className="w-14 rounded border border-gray-200 px-1 py-0.5 text-xs" />
            秒
          </label>
        )}

        <label className="flex items-center gap-1 text-xs text-gray-500">
          最多
          <input type="number" min={1} max={1000} value={maxFrames}
            onChange={(e) => setMaxFrames(Number(e.target.value))}
            className="w-14 rounded border border-gray-200 px-1 py-0.5 text-xs" />
          帧
        </label>

        <label className="flex items-center gap-1 text-xs text-gray-500">
          去重
          <input type="range" min={0.5} max={1} step={0.01} value={ssimThreshold}
            onChange={(e) => setSsimThreshold(Number(e.target.value))}
            className="w-16 h-1 accent-primary-500" />
          <span className="w-12 text-gray-700">{ssimThreshold >= 1 ? "关闭" : `SSIM ${ssimThreshold.toFixed(2)}`}</span>
        </label>

        <button
          onClick={handleExtract}
          disabled={extracting}
          className="rounded bg-primary-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {extracting ? "提取中..." : keyframes.length > 0 ? "重新提取" : "提取关键帧"}
        </button>

        {keyframes.length > 0 && (
          <button
            onClick={handleLoadAll}
            disabled={loadingAll}
            className="rounded bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loadingAll ? "加载中..." : `加载全部 ${keyframes.length} 帧到标注队列`}
          </button>
        )}
      </div>

      {/* Keyframe grid */}
      {extracting && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          正在提取关键帧...
        </div>
      )}

      {!extracting && keyframes.length > 0 && (
        <>
          <div className="grid grid-cols-6 gap-2">
            {visible.map((kf) => (
              <div key={kf.id} className="relative rounded overflow-hidden border border-gray-200 bg-gray-100">
                <img
                  src={keyframeImageUrl(video.id, kf.id)}
                  alt={`#${kf.frameNumber}`}
                  className="w-full h-24 object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 flex justify-between">
                  <span>#{kf.frameNumber}</span>
                  <span>{formatTime(kf.timestampSeconds)}</span>
                </div>
              </div>
            ))}
          </div>

          {keyframes.length > 12 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {expanded ? "收起" : `展开全部 ${keyframes.length} 帧`}
            </button>
          )}
        </>
      )}

      {!extracting && keyframes.length === 0 && (
        <div className="text-sm text-gray-400 py-8 text-center">
          选择提取方式并点击"提取关键帧"
        </div>
      )}
    </div>
  );
}
