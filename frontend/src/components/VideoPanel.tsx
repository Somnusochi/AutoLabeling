import { useCallback, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "antd";
import toast from "react-hot-toast";
import { uploadVideo, listVideos, extractKeyframes, deleteVideo, keyframeImageUrl } from "@/services/api";
import type { VideoInfo } from "@/types";

interface Props {
  onLoadKeyframes: (files: File[], videoName: string) => void;
  disabled?: boolean;
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

export function VideoPanel({ onLoadKeyframes, disabled }: Props) {
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  const [method, setMethod] = useState<"scene" | "motion" | "interval">("scene");
  const [threshold, setThreshold] = useState(30);
  const [intervalSec, setIntervalSec] = useState(2);
  const [maxFrames, setMaxFrames] = useState(100);
  const [ssimThreshold, setSsimThreshold] = useState(0.95);
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set());

  const { data: videoList } = useQuery({
    queryKey: ["videos"],
    queryFn: () => listVideos(),
  });

  const uploadMut = useMutation({
    mutationFn: uploadVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("视频上传成功");
    },
    onError: () => toast.error("上传失败"),
  });

  const extractMut = useMutation({
    mutationFn: ({ id, params }: { id: string; params: Record<string, unknown> }) =>
      extractKeyframes(id, params as { method: string; threshold?: number; intervalSeconds?: number; maxFrames: number; ssimThreshold: number }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setExtracting(false);
      toast.success(`提取 ${data.keyframes.length} 个关键帧`);
    },
    onError: () => {
      setExtracting(false);
      toast.error("关键帧提取失败");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      if (selectedVideoId) setSelectedVideoId(null);
      toast.success("已删除");
    },
    onError: () => toast.error("删除失败"),
  });

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("video/"));
      for (const f of files) await uploadMut.mutateAsync(f);
    },
    [uploadMut],
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      for (const f of Array.from(e.target.files ?? [])) await uploadMut.mutateAsync(f);
      e.target.value = "";
    },
    [uploadMut],
  );

  const handleExtract = useCallback(
    (videoId: string) => {
      setExtracting(true);
      setSelectedFrameIds(new Set());
      extractMut.mutate({
        id: videoId,
        params: { method, threshold, intervalSeconds: intervalSec, maxFrames, ssimThreshold },
      });
    },
    [extractMut, method, threshold, intervalSec, maxFrames, ssimThreshold],
  );

  const toggleFrame = useCallback((id: string) => {
    setSelectedFrameIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllFrames = useCallback((video: VideoInfo) => {
    setSelectedFrameIds(new Set(video.keyframes.map((k) => k.id)));
  }, []);

  const deselectAllFrames = useCallback(() => {
    setSelectedFrameIds(new Set());
  }, []);

  const handleLoadSelected = useCallback(
    async (video: VideoInfo) => {
      const selected = video.keyframes.filter((k) => selectedFrameIds.has(k.id));
      if (selected.length === 0) { toast.error("请先选择关键帧"); return; }
      setLoadingAll(true);
      try {
        const files: File[] = [];
        for (const kf of selected) {
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
    },
    [selectedFrameIds, onLoadKeyframes],
  );

  const selectedVideo = videoList?.items.find((v) => v.id === selectedVideoId);

  return (
    <div className="space-y-2">
      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("video-input")?.click()}
        className={`rounded-lg border-2 border-dashed p-2.5 text-center cursor-pointer transition-colors text-xs ${
          disabled ? "pointer-events-none opacity-50" : ""
        } ${dragOver ? "border-primary-500 bg-primary-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"}`}
      >
        <p className="text-gray-500">拖拽视频或点击上传</p>
        <p className="text-gray-400 text-[10px] mt-0.5">MP4 / MOV / AVI / MKV / WebM</p>
        <input id="video-input" type="file" accept="video/*" className="hidden" disabled={disabled} onChange={handleFileInput} />
      </div>

      {uploadMut.isPending && <p className="text-xs text-gray-400 text-center">上传中...</p>}

      {/* Video list */}
      {videoList && videoList.items.length > 0 && (
        <div className="space-y-0.5 max-h-36 overflow-y-auto">
          {videoList.items.map((v) => (
            <div key={v.id}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedVideoId(v.id === selectedVideoId ? null : v.id)}
                  className={`flex-1 text-left rounded px-2 py-1 text-xs truncate transition-colors ${
                    selectedVideoId === v.id
                      ? "bg-primary-100 text-primary-700 font-medium"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="truncate block">{v.fileName}</span>
                  <span className="text-[10px] text-gray-400">
                    {v.duration != null ? formatTime(v.duration) : "?"}
                    {v.keyframes.length > 0 ? ` · ${v.keyframes.length}帧` : ""}
                  </span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMut.mutate(v.id); }}
                  className="text-[10px] text-red-400 hover:text-red-600 flex-shrink-0 px-0.5"
                >删</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Extraction panel */}
      {selectedVideoId && selectedVideo && (
        <div className="rounded border border-gray-200 p-2.5 space-y-3">
          {/* Method toggle */}
          <div className="flex gap-0.5 rounded bg-gray-100 p-0.5">
            {(["scene", "motion", "interval"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                  method === m ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Settings — one per row */}
          <div className="space-y-2 text-[11px]">
            {/* Method-specific param */}
            {method === "scene" && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-gray-500">画面变化灵敏度</span>
                  <span className="text-gray-700 font-medium">{threshold}</span>
                </div>
                <input type="range" min={1} max={100} value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full h-1 accent-primary-500" />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>更敏感（更多帧）</span>
                  <span>更迟钝（更少帧）</span>
                </div>
              </div>
            )}

            {method === "motion" && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-gray-500">累计位移阈值</span>
                  <span className="text-gray-700 font-medium">{threshold}px</span>
                </div>
                <input type="range" min={1} max={50} step={0.5} value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full h-1 accent-primary-500" />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>小动就截（更多帧）</span>
                  <span>大动才截（更少帧）</span>
                </div>
              </div>
            )}

            {method === "interval" && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">时间间隔</span>
                <input type="number" min={0.5} max={60} step={0.5} value={intervalSec}
                  onChange={(e) => setIntervalSec(Number(e.target.value))}
                  className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs" />
                <span className="text-gray-400">秒</span>
              </div>
            )}

            {/* Max frames */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500">最多提取</span>
              <input type="number" min={1} max={1000} value={maxFrames}
                onChange={(e) => setMaxFrames(Number(e.target.value))}
                className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs" />
              <span className="text-gray-400">帧</span>
            </div>

            {/* SSIM dedup */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-gray-500">SSIM 去重</span>
                <span className="text-gray-700 font-medium">
                  {ssimThreshold >= 1 ? "关闭" : ssimThreshold.toFixed(2)}
                </span>
              </div>
              <input type="range" min={0.5} max={1} step={0.01} value={ssimThreshold}
                onChange={(e) => setSsimThreshold(Number(e.target.value))}
                className="w-full h-1 accent-primary-500" />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>严格（相似即去重）</span>
                <span>宽松（保留更多）</span>
              </div>
            </div>
          </div>

          <div className="flex gap-1">
            {selectedVideo.keyframes.length === 0 ? (
              <button
                onClick={() => handleExtract(selectedVideoId)}
                disabled={extracting}
                className="flex-1 rounded bg-primary-600 py-1.5 text-[11px] font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {extracting ? "提取中..." : "提取关键帧"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleLoadSelected(selectedVideo)}
                  disabled={loadingAll || selectedFrameIds.size === 0}
                  className="flex-1 rounded bg-green-600 py-1.5 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loadingAll ? "加载中..." : `加载选中 ${selectedFrameIds.size} 帧`}
                </button>
                <button
                  onClick={() => handleExtract(selectedVideoId)}
                  disabled={extracting}
                  className="rounded border border-gray-200 px-2 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >重提</button>
              </>
            )}
          </div>

          {/* Timeline keyframe strip */}
          {extracting && (
            <div className="flex items-center gap-2 py-3 justify-center text-[11px] text-gray-400">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              提取关键帧中...
            </div>
          )}

          {!extracting && selectedVideo.keyframes.length > 0 && (
            <>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">
                  已选 {selectedFrameIds.size}/{selectedVideo.keyframes.length}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => selectAllFrames(selectedVideo)} className="text-gray-500 hover:text-primary-600">全选</button>
                  <button onClick={deselectAllFrames} className="text-gray-500 hover:text-primary-600">取消</button>
                </div>
              </div>
              <Image.PreviewGroup>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {selectedVideo.keyframes.map((kf) => {
                    const sel = selectedFrameIds.has(kf.id);
                    return (
                      <div
                        key={kf.id}
                        onClick={() => toggleFrame(kf.id)}
                        className={`flex-shrink-0 w-24 rounded overflow-hidden border-2 transition-all cursor-pointer ${
                          sel
                            ? "border-primary-500 ring-1 ring-primary-200"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="relative">
                          <Image
                            src={keyframeImageUrl(selectedVideo.id, kf.id)}
                            alt={`#${kf.frameNumber}`}
                            className="w-full h-14 object-cover"
                            preview={{ mask: "点击查看" }}
                            style={{ display: "block" }}
                          />
                          {sel && (
                            <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="bg-gray-50 text-[10px] text-gray-500 px-1 py-0.5 text-center">
                          {formatTime(kf.timestampSeconds)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Image.PreviewGroup>
            </>
          )}
        </div>
      )}
    </div>
  );
}
