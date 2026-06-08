import { Popconfirm } from "antd";

interface Props {
  items: VideoInfo[];
  selectedVideoId: string | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}

export function VideoList({
  items,
  selectedVideoId,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onSelect,
  onDelete,
  onDeleteAll,
}: Props) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 20,
  });

  useScrollLoad(parentRef, hasNextPage, isFetchingNextPage, fetchNextPage);

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
        {isFetchingNextPage ? (
          <p className="text-xs text-center text-gray-400 py-1">{t("common.loading")}</p>
        ) : hasNextPage ? null : items.length > 0 ? (
          <p className="text-xs text-center text-gray-300 py-1">{t("videoPanel.allVideosLoaded")}</p>
        ) : null}
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
