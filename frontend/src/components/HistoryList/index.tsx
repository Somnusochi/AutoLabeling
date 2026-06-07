interface Props {
  data: { total: number; items: Detection[] } | undefined;
  onSelect: (det: Detection) => void;
}

export function HistoryList({ data, onSelect }: Props) {
  const { t } = useTranslation();
  const deleteMut = useDeleteDetectionMutation();
  const list = useMemo(() => data?.items ?? [], [data?.items]);

  const allCategories = useMemo(() => {
    const count = new Map<string, number>();
    list.forEach((d) => {
      parseCategories(d.categories).forEach((c) => count.set(c, (count.get(c) ?? 0) + 1));
    });
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, { wait: 200 });
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (cat: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filteredCategories = allCategories.filter(
    ([name]) => !debouncedSearch || name.toLowerCase().includes(debouncedSearch.toLowerCase()),
  );

  const filtered = useMemo(() => {
    if (selected.size === 0) return list;
    return list.filter((d) => {
      return parseCategories(d.categories).some((c) => selected.has(c));
    });
  }, [list, selected]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 10,
  });

  if (list.length === 0) {
    return (
      <p className="py-4 text-xs text-gray-400 text-center">{t("historyList.emptyHistory")}</p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Tag filter */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:border-gray-300 transition-colors"
        >
          <span>
            {selected.size > 0
              ? t("historyList.selectedTags", { count: selected.size })
              : t("historyList.filterByTag")}
          </span>
          <svg
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("historyList.filterPlaceholder")}
              className="w-full border-b border-gray-100 px-2 py-1.5 text-xs outline-none"
              autoFocus
            />
            <div className="max-h-36 overflow-y-auto p-1">
              {filteredCategories.map(([name, count]) => (
                <label
                  key={name}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(name)}
                    onChange={() => toggle(name)}
                    className="h-3 w-3 rounded"
                  />
                  <span className="flex-1 text-gray-600">{name}</span>
                  <span className="text-gray-300">{count}</span>
                </label>
              ))}
              {filteredCategories.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">{t("historyList.noMatch")}</p>
              )}
            </div>
            {selected.size > 0 && (
              <button
                onClick={() => {
                  setSelected(new Set());
                  setOpen(false);
                }}
                className="w-full border-t border-gray-100 px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
              >
                {t("historyList.clearFilter")}
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        {selected.size > 0
          ? t("historyList.matchCount", {
              current: filtered.length,
              total: data?.total ?? 0,
            })
          : t("historyList.totalCount", { count: data?.total ?? 0 })}
      </p>

      {filtered.length === 0 ? (
        <p className="py-4 text-xs text-gray-400 text-center">{t("historyList.noMatchRecords")}</p>
      ) : (
        <div ref={parentRef} className="max-h-64 overflow-y-auto pr-1">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const det = filtered[virtualRow.index];
              return (
                <HistoryListItem
                  key={virtualRow.key}
                  det={det}
                  virtualRow={virtualRow}
                  measureElement={rowVirtualizer.measureElement}
                  selectedSet={selected}
                  onSelect={onSelect}
                  onDelete={(id) => deleteMut.mutate(id)}
                  isDeleting={deleteMut.isPending}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
