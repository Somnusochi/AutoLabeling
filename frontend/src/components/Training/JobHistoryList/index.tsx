import type { VirtualItem } from "@tanstack/react-virtual";

const TrainingJobVirtualItem = memo(
  ({
    job,
    virtualRow,
    measureElement,
  }: {
    job: TrainingJob;
    virtualRow: VirtualItem;
    measureElement: (node: Element | null) => void;
  }) => (
    <div
      data-index={virtualRow.index}
      ref={measureElement}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualRow.start}px)`,
      }}
      className="pb-1"
    >
      <TrainingJobItem job={job} />
    </div>
  ),
);

export function JobHistoryList({
  jobs,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  jobs: TrainingJob[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 20,
  });

  useScrollLoad(parentRef, hasNextPage, isFetchingNextPage, fetchNextPage);

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{t("trainingPanel.trainJobs")}</p>
      <div ref={parentRef} className="max-h-64 overflow-y-auto pr-1">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const job = jobs[virtualRow.index];
            return (
              <TrainingJobVirtualItem
                key={virtualRow.key}
                job={job}
                virtualRow={virtualRow}
                measureElement={rowVirtualizer.measureElement}
              />
            );
          })}
        </div>
      </div>
        {isFetchingNextPage ? (
          <p className="text-xs text-center text-gray-400 py-1">{t("common.loading")}</p>
        ) : hasNextPage ? null : jobs.length > 0 ? (
          <p className="text-xs text-center text-gray-300 py-1">{t("trainingPanel.allJobsLoaded")}</p>
        ) : null}
    </div>
  );
}
