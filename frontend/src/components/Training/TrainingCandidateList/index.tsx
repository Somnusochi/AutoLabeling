export const TrainingCandidateList = memo(
  ({
    filteredDetections,
    selected,
    toggleSelect,
    setHoveredDetId,
    setHoveredRect,
    enterTimerRef,
    leaveTimerRef,
  }: {
    filteredDetections: Detection[];
    selected: Set<string>;
    toggleSelect: (id: string) => void;
    setHoveredDetId: (id: string | null) => void;
    setHoveredRect: (rect: { right: number; top: number } | null) => void;
    enterTimerRef: { current: number | null };
    leaveTimerRef: { current: number | null };
  }) => {
    const candParentRef = useRef<HTMLDivElement>(null);

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
      </div>
    );
  },
);
