export const TrainingCandidateList = memo(
  ({
    filteredDetections,
    selected,
    toggleSelect,
    setHoveredDetId,
    setHoveredRect,
    enterTimerRef,
    leaveTimerRef,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  }: {
    filteredDetections: Detection[];
    selected: Set<string>;
    toggleSelect: (id: string) => void;
    setHoveredDetId: (id: string | null) => void;
    setHoveredRect: (rect: { right: number; top: number } | null) => void;
    enterTimerRef: { current: number | null };
    leaveTimerRef: { current: number | null };
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
  }) => {
    const { t } = useTranslation();
    const candParentRef = useRef<HTMLDivElement>(null);

    useInfiniteScroll(candParentRef, hasNextPage, isFetchingNextPage, fetchNextPage);

    const candVirtualizer = useVirtualizer({
      count: filteredDetections.length,
      getScrollElement: () => candParentRef.current,
      estimateSize: () => 40,
      overscan: 10,
    });

    return (
      <div
        ref={candParentRef}
        className="max-h-44 overflow-y-auto rounded border border-gray-100 pr-1"
      >
        <div
          style={{
            height: `${candVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {candVirtualizer.getVirtualItems().map((virtualRow) => {
            const det = filteredDetections[virtualRow.index];
            return (
              <CandidateListItem
                key={virtualRow.key}
                det={det}
                virtualRow={virtualRow}
                isSelected={selected.has(det.id)}
                toggleSelect={toggleSelect}
                setHoveredDetId={setHoveredDetId}
                setHoveredRect={setHoveredRect}
                enterTimerRef={enterTimerRef}
                leaveTimerRef={leaveTimerRef}
              />
            );
          })}
        </div>
        {isFetchingNextPage ? (
          <p className="text-xs text-center text-gray-400 py-1">{t("common.loading")}</p>
        ) : hasNextPage ? null : filteredDetections.length > 0 ? (
          <p className="text-xs text-center text-gray-300 py-1">{t("trainingPanel.allItemsLoaded")}</p>
        ) : null}
      </div>
    );
  },
);
