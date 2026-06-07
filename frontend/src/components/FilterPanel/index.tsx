interface Props {
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
  nmsIou: number;
  onNmsIouChange: (iou: number) => void;
  setHiddenIndices: (indices: Set<string>) => void;
}

export function FilterPanel({
  filterMode,
  onFilterModeChange,
  nmsIou,
  onNmsIouChange,
  setHiddenIndices,
}: Props) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-sm font-medium text-gray-600 mb-2">{t("filter.filterMode")}</p>
      <div className="flex gap-1 rounded bg-gray-100 p-1 text-xs">
        {(["best", "nms", "all"] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              onFilterModeChange(mode);
              setHiddenIndices(new Set());
            }}
            className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${
              filterMode === mode
                ? "bg-white text-primary-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {{ best: t("filter.best"), nms: t("filter.nms"), all: t("filter.all") }[mode]}
          </button>
        ))}
      </div>
      {filterMode === "nms" && (
        <>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-400">{t("filter.nmsIou")}</span>
            <div className="relative flex-1">
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={nmsIou}
                onChange={(e) => onNmsIouChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500
                  [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
              />
            </div>
            <span className="text-xs font-medium text-gray-600 w-7 text-right">
              {nmsIou.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
            <span>{t("filter.fewerBoxes")}</span>
            <span>{t("filter.moreBoxes")}</span>
          </div>
        </>
      )}
    </div>
  );
}
