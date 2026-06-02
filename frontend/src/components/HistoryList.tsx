import { useMemo, useRef, useState, useEffect } from "react";
import { useDeleteDetectionMutation } from "@/hooks/useDetection";
import { exportSingleUrl } from "@/services/api";
import type { Detection } from "@/types";

interface Props {
  data: { total: number; items: Detection[] } | undefined;
  onSelect: (det: Detection) => void;
}

export function HistoryList({ data, onSelect }: Props) {
  const deleteMut = useDeleteDetectionMutation();
  const list = data?.items ?? [];

  const allCategories = useMemo(() => {
    const count = new Map<string, number>();
    list.forEach((d) => {
      try {
        (JSON.parse(d.categories) as string[]).forEach((c) => count.set(c, (count.get(c) ?? 0) + 1));
      } catch {}
    });
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
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
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const filteredCategories = allCategories.filter(
    ([name]) => !search || name.toLowerCase().includes(search.toLowerCase())
  );

  const filtered = useMemo(() => {
    if (selected.size === 0) return list;
    return list.filter((d) => {
      try {
        return (JSON.parse(d.categories) as string[]).some((c) => selected.has(c));
      } catch { return false; }
    });
  }, [list, selected]);

  if (list.length === 0) {
    return <p className="py-4 text-xs text-gray-400 text-center">暂无历史记录</p>;
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
              ? `已选 ${selected.size} 个标签`
              : "按标签筛选"}
          </span>
          <svg className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标签..."
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
                <p className="text-xs text-gray-400 text-center py-2">无匹配</p>
              )}
            </div>
            {selected.size > 0 && (
              <button
                onClick={() => { setSelected(new Set()); setOpen(false); }}
                className="w-full border-t border-gray-100 px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
              >
                清除筛选
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        {selected.size > 0 ? `${filtered.length} / ${data?.total ?? 0} 条` : `共 ${data?.total ?? 0} 条`}
      </p>

      {filtered.length === 0 ? (
        <p className="py-4 text-xs text-gray-400 text-center">无匹配记录</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((det) => (
            <div
              key={det.id}
              onClick={() => onSelect(det)}
              className="rounded border border-gray-100 p-2 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <p className="text-xs font-medium text-gray-700 truncate">{det.image_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(det.created_at).toLocaleString("zh-CN")}
              </p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {(() => {
                  try {
                    return (JSON.parse(det.categories) as string[]).map((c) => (
                      <span key={c} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        selected.has(c) ? "bg-primary-500 text-white" : "bg-primary-100 text-primary-700"
                      }`}>{c}</span>
                    ));
                  } catch { return null; }
                })()}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{det.boxes.length} 个目标</p>
              <div className="flex gap-2 mt-1.5">
                <a href={exportSingleUrl(det.id)} download onClick={(e) => e.stopPropagation()} className="text-xs text-primary-600 hover:underline">
                  导出
                </a>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMut.mutate(det.id); }}
                  disabled={deleteMut.isPending}
                  className="text-xs text-red-500 hover:underline disabled:opacity-50"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
