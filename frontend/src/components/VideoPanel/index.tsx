import { type DragEvent } from "react";
import { VideoList } from "./VideoList";
import { ExtractionPanel } from "./ExtractionPanel";

interface Props {
  onLoadKeyframes: (files: File[], videoName: string) => void;
  onValidateVideo?: (videoId: string) => void;
  disabled?: boolean;
}

export function VideoPanel({ onLoadKeyframes, onValidateVideo, disabled }: Props) {
  const { t } = useTranslation();
  const isValidation = !!onValidateVideo;
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  const [method, setMethod] = useState<"scene" | "motion" | "interval">("scene");
  const [threshold, setThreshold] = useState(15);
  const [intervalSec, setIntervalSec] = useState(2);
  const [maxFrames, setMaxFrames] = useState(100);
  const [ssimThreshold, setSsimThreshold] = useState(0.95);
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set());

  const videoQuery = useInfiniteQuery({
    queryKey: ["videos"],
    queryFn: ({ pageParam }) => listVideos(pageParam, 30),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 30_000,
  });
  const allVideos = useMemo(
    () => videoQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [videoQuery.data],
  );

  const uploadMut = useMutation({
    mutationFn: uploadVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success(t("videoPanel.uploadSuccess"));
    },
    onError: () => toast.error(t("videoPanel.uploadFailed")),
  });

  const extractMut = useMutation({
    mutationFn: ({ id, params }: { id: string; params: Record<string, unknown> }) =>
      extractKeyframes(id, params as {
        method: string; threshold?: number; intervalSeconds?: number;
        maxFrames: number; ssimThreshold: number;
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setExtracting(false);
      toast.success(t("videoPanel.extractSuccess", { count: data.keyframes.length }));
    },
    onError: () => {
      setExtracting(false);
      toast.error(t("videoPanel.extractFailed"));
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      if (selectedVideoId) setSelectedVideoId(null);
      toast.success(t("videoPanel.deleteSuccess"));
    },
    onError: () => toast.error(t("videoPanel.deleteFailed")),
  });

  const clearAllMut = useMutation({
    mutationFn: deleteAllVideos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setSelectedVideoId(null);
      toast.success(t("videoPanel.deleteSuccess"));
    },
    onError: () => toast.error(t("videoPanel.deleteFailed")),
  });

  const handleClearAllVideos = useCallback(() => {
    clearAllMut.mutate();
  }, [clearAllMut]);

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      if (selected.length === 0) {
        toast.error(t("videoPanel.selectFrameRequired"));
        return;
      }
      setLoadingAll(true);
      try {
        const files: File[] = [];
        for (const kf of selected) {
          const resp = await fetch(keyframeImageUrl(video.id, kf.id));
          const blob = await resp.blob();
          files.push(new File([blob], `kf_${kf.frameNumber}.jpg`, { type: "image/jpeg" }));
        }
        onLoadKeyframes(files, video.fileName);
        toast.success(t("videoPanel.loadSuccess", { count: files.length }));
      } catch {
        toast.error(t("videoPanel.loadFailed"));
      } finally {
        setLoadingAll(false);
      }
    },
    [selectedFrameIds, onLoadKeyframes, t],
  );

  const selectedVideo = allVideos.find((v) => v.id === selectedVideoId);

  return (
    <div className="space-y-2">
      {/* Upload drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("video-input")?.click()}
        className={`rounded-lg border-2 border-dashed p-2.5 text-center cursor-pointer transition-colors text-xs ${
          disabled ? "pointer-events-none opacity-50" : ""
        } ${dragOver ? "border-primary-500 bg-primary-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"}`}
      >
        <p className="text-gray-500">{t("videoPanel.dragToUpload")}</p>
        <p className="text-gray-400 text-[10px] mt-0.5">{t("videoPanel.uploadLimit")}</p>
        <input
          id="video-input" type="file" accept="video/*" className="hidden"
          disabled={disabled} onChange={handleFileInput}
        />
      </div>

      {uploadMut.isPending && (
        <p className="text-xs text-gray-400 text-center">{t("videoPanel.uploading")}</p>
      )}

      {/* Video list */}
      {allVideos.length > 0 && (
        <VideoList
          items={allVideos}
          selectedVideoId={selectedVideoId}
          hasNextPage={videoQuery.hasNextPage ?? false}
          isFetchingNextPage={videoQuery.isFetchingNextPage}
          fetchNextPage={() => videoQuery.fetchNextPage()}
          onSelect={(id) => setSelectedVideoId(id === selectedVideoId ? null : id)}
          onDelete={(id) => deleteMut.mutate(id)}
          onDeleteAll={handleClearAllVideos}
        />
      )}

      {/* Extraction panel */}
      {selectedVideoId && selectedVideo && (
        <ExtractionPanel
          method={method}
          threshold={threshold}
          intervalSec={intervalSec}
          maxFrames={maxFrames}
          ssimThreshold={ssimThreshold}
          extracting={extracting}
          loadingAll={loadingAll}
          selectedFrameIds={selectedFrameIds}
          selectedVideo={selectedVideo}
          isValidation={isValidation}
          onMethodChange={setMethod}
          onThresholdChange={setThreshold}
          onIntervalChange={setIntervalSec}
          onMaxFramesChange={setMaxFrames}
          onSsimChange={setSsimThreshold}
          onExtract={handleExtract}
          onValidateVideo={onValidateVideo}
          onLoadSelected={handleLoadSelected}
          onSelectAllFrames={selectAllFrames}
          onDeselectAllFrames={deselectAllFrames}
          onToggleFrame={toggleFrame}
        />
      )}
    </div>
  );
}
