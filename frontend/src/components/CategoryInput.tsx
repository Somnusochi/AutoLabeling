import { useState, type KeyboardEvent } from "react";

interface Props {
  categories: string[];
  onChange: (categories: string[]) => void;
  disabled?: boolean;
  recentCategories?: string[];
}

export function CategoryInput({ categories, onChange, disabled, recentCategories = [] }: Props) {
  const [input, setInput] = useState("");

  const add = (cat?: string) => {
    const trimmed = (cat ?? input).trim();
    if (trimmed && !categories.includes(trimmed)) {
      onChange([...categories, trimmed]);
      setInput("");
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
    if (e.key === "Backspace" && !input && categories.length > 0) {
      onChange(categories.slice(0, -1));
    }
  };

  const remove = (cat: string) => {
    onChange(categories.filter((c) => c !== cat));
  };

  // Filter recent tags that aren't already selected
  const suggested = recentCategories.filter((c) => !categories.includes(c));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {categories.map((cat) => (
          <span
            key={cat}
            className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700"
          >
            {cat}
            <button
              type="button"
              disabled={disabled}
              onClick={() => remove(cat)}
              className="text-primary-500 hover:text-primary-700"
            >
              &times;
            </button>
          </span>
        ))}
        {categories.length === 0 && (
          <span className="text-xs text-gray-400 self-center">输入目标类别，回车添加</span>
        )}
      </div>

      {/* Recent tags */}
      {suggested.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {suggested.slice(0, 8).map((cat) => (
            <button
              key={cat}
              type="button"
              disabled={disabled}
              onClick={() => add(cat)}
              className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors"
            >
              + {cat}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="输入类别名，如 person, car..."
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled || !input.trim()}
          onClick={() => add()}
          className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          添加
        </button>
      </div>
    </div>
  );
}
