import { type DragEvent } from "react";

import { Image, Popconfirm } from "antd";

// ── Virtualized video list ──────────────────────────

function VideoList({
  items,
  selectedVideoId,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onSelect,
  onDelete,
  onDeleteAll,
}: {
  items: VideoInfo[];
  selectedVideoId: string | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 10,
  });

  useInfiniteScroll(parentRef, hasNextPage, isFetchingNextPage, fetchNextPage);

  return (
    <>
      <div ref={parentRef} className="max-h-48 overflow-y-auto">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const v = items[virtualRow.index];
            return (
              <div
                key={v.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex items-center gap-1 pb-0.5"
              >
                <button
                  onClick={() => onSelect(v.id)}
                  className={`flex-1 text-left rounded px-2 py-1 text-xs truncate transition-colors ${
                    selectedVideoId === v.id
                      ? "bg-primary-100 text-primary-700 font-medium"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="truncate block">{v.fileName}</span>
                  <span className="text-[10px] text-gray-400">
                    {v.duration != null ? formatTime(v.duration) : "?"}
                    {v.keyframes.length > 0
                      ? ` · ${v.keyframes.length} ${t("videoPanel.unitFrames")}`
                      : ""}
                  </span>
                </button>
                <Popconfirm
                  title={t("videoPanel.deleteConfirm")}
                  onConfirm={() => onDelete(v.id)}
                  okText={t("common.delete")}
                  cancelText={t("common.cancel")}
                  okButtonProps={{ danger: true }}
                >
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-red-400 hover:text-red-600 flex-shrink-0 px-0.5"
                  >
                    {t("common.delete")}
                  </button>
                </Popconfirm>
              </div>
            );
          })}
        </div>
      </div>
      <Popconfirm
        title={t("videoPanel.deleteAllConfirm", { count: items.length })}
        onConfirm={onDeleteAll}
        okText={t("common.delete")}
        cancelText={t("common.cancel")}
        okButtonProps={{ danger: true }}
      >
        <button
          type="button"
          className="w-full rounded border border-red-200 bg-red-50 py-1 text-[10px] text-red-500 hover:bg-red-100 transition-colors"
        >
          {t("videoPanel.clearAllVideos")} ({items.length})
        </button>
      </Popconfirm>
    </>
  );
}

interface Props {
  onLoadKeyframes: (files: File[], videoName: string) => void;
  onValidateVideo?: (videoId: string) => void;
  disabled?: boolean;
}

export function VideoPanel({ onLoadKeyframes, onValidateVideo, disabled }: Props) {
  const { t } = useTranslation();
  const methodLabels: Record<string, string> = {
    scene: t("videoPanel.modeScene"),
    motion: t("videoPanel.modeMotion"),
    interval: t("videoPanel.modeInterval"),
  };
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
      extractKeyframes(
        id,
        params as {
          method: string;
          threshold?: number;
          intervalSeconds?: number;
          maxFrames: number;
          ssimThreshold: number;
        },
      ),
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

  const handleClearAllVideos = useCallback(() => {
    const allIds = (allVideos ?? []).map((v) => v.id);
    for (const id of allIds) deleteMut.mutate(id);
    setSelectedVideoId(null);
  }, [allVideos, deleteMut]);

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
      {/* Upload */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
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
          id="video-input"
          type="file"
          accept="video/*"
          className="hidden"
          disabled={disabled}
          onChange={handleFileInput}
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
      {selectedVideoId &&
        selectedVideo &&
        (isValidation ? (
          <div className="rounded border border-gray-200 p-2.5">
            <button
              onClick={() => onValidateVideo!(selectedVideo.id)}
              className="w-full rounded bg-green-600 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
            >
              {t("videoPanel.validateVideoRealtime")}
            </button>
          </div>
        ) : (
          <div className="rounded border border-gray-200 p-2.5 space-y-3">
            {/* Method toggle */}
            <div className="flex gap-0.5 rounded bg-gray-100 p-0.5">
              {(["scene", "motion", "interval"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                    method === m
                      ? "bg-white text-primary-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {methodLabels[m]}
                </button>
              ))}
            </div>

            {/* Settings — one per row */}
            <div className="space-y-2 text-[11px]">
              {/* Method-specific param */}
              {method === "scene" && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-gray-500">{t("videoPanel.sceneThreshold")}</span>
                    <span className="text-gray-700 font-medium">{threshold}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full h-1 accent-primary-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{t("videoPanel.moreFrames")}</span>
                    <span>{t("videoPanel.fewerFrames")}</span>
                  </div>
                </div>
              )}

              {method === "motion" && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-gray-500">{t("videoPanel.motionThreshold")}</span>
                    <span className="text-gray-700 font-medium">{threshold}px</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    step={0.5}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full h-1 accent-primary-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{t("videoPanel.motionMore")}</span>
                    <span>{t("videoPanel.motionFewer")}</span>
                  </div>
                </div>
              )}

              {method === "interval" && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{t("videoPanel.timeInterval")}</span>
                  <input
                    type="number"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Number(e.target.value))}
                    className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                  />
                  <span className="text-gray-400">{t("videoPanel.unitSeconds")}</span>
                </div>
              )}

              {/* Max frames */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{t("videoPanel.maxFrames")}</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxFrames}
                  onChange={(e) => setMaxFrames(Number(e.target.value))}
                  className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                />
                <span className="text-gray-400">{t("videoPanel.unitFrames")}</span>
              </div>

              {/* SSIM dedup */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-gray-500">{t("videoPanel.ssimThreshold")}</span>
                  <span className="text-gray-700 font-medium">
                    {ssimThreshold >= 1 ? t("videoPanel.ssimClose") : ssimThreshold.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={ssimThreshold}
                  onChange={(e) => setSsimThreshold(Number(e.target.value))}
                  className="w-full h-1 accent-primary-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>{t("videoPanel.ssimStrict")}</span>
                  <span>{t("videoPanel.ssimLoose")}</span>
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
                  {extracting ? t("videoPanel.extracting") : t("videoPanel.startExtract")}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleLoadSelected(selectedVideo)}
                    disabled={loadingAll || selectedFrameIds.size === 0}
                    className="flex-1 rounded bg-green-600 py-1.5 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {loadingAll
                      ? t("common.loading")
                      : t("videoPanel.loadSelected", { count: selectedFrameIds.size })}
                  </button>
                  <button
                    onClick={() => handleExtract(selectedVideoId)}
                    disabled={extracting}
                    className="rounded border border-gray-200 px-2 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t("videoPanel.reExtract")}
                  </button>
                </>
              )}
            </div>

            {/* Timeline keyframe strip */}
            {extracting && (
              <div className="flex items-center gap-2 py-3 justify-center text-[11px] text-gray-400">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {t("videoPanel.extracting")}
              </div>
            )}

            {!extracting && selectedVideo.keyframes.length > 0 && (
              <>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400">
                    {t("videoPanel.selectedCount", {
                      current: selectedFrameIds.size,
                      total: selectedVideo.keyframes.length,
                    })}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => selectAllFrames(selectedVideo)}
                      className="text-gray-500 hover:text-primary-600"
                    >
                      {t("videoPanel.selectAll")}
                    </button>
                    <button
                      onClick={deselectAllFrames}
                      className="text-gray-500 hover:text-primary-600"
                    >
                      {t("videoPanel.deselectAll")}
                    </button>
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
                              preview={{ mask: t("videoPanel.clickToView") }}
                              style={{ display: "block" }}
                            />
                            {sel && (
                              <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                                <svg
                                  className="w-2.5 h-2.5 text-white"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                >
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
        ))}
    </div>
  );
}
