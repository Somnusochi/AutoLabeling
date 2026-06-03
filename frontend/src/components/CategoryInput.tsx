import {type KeyboardEvent} from "react";

interface Props {
  categories: string[];
  onChange: (categories: string[]) => void;
  disabled?: boolean;
  recentCategories?: string[];
}

export function CategoryInput({ categories, onChange, disabled, recentCategories = [] }: Props) {
  const { t } = useTranslation();
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
      <div className="flex flex-wrap gap-1 mb-2">
        {categories.map((cat) => (
          <span key={cat} className="flex items-center bg-green-600 text-xs text-white rounded-sm px-1.5 leading-5 h-5">
            {cat}
            <button
              type="button"
              disabled={disabled}
              onClick={() => remove(cat)}
              className="ml-1 text-white/70 hover:text-white flex-shrink-0 cursor-pointer"
            >
              &times;
            </button>
          </span>
        ))}
        {categories.length === 0 && (
          <span className="text-xs text-gray-400 self-center">{t("categoryInput.enterToConfirm")}</span>
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
              className="rounded-sm border border-gray-200 px-1.5 text-xs text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors cursor-pointer inline-flex items-center leading-5 h-5"
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
          placeholder={t("categoryInput.enterCategory")}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled || !input.trim()}
          onClick={() => add()}
          className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {t("common.add")}
        </button>
      </div>
    </div>
  );
}
