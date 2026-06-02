interface Props {
  current: number;
  total: number;
  completed: number;
  onCancel: () => void;
}

export function BatchProgress({ current, total, completed, onCancel }: Props) {
  if (total <= 1) return null;

  return (
    <div className="space-y-2">
      <div className="rounded border border-gray-100 p-2">
        <p className="text-xs text-gray-500">批处理进度</p>
        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{completed} / {total} 完成</p>
      </div>
      {current < total && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded border border-red-200 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          取消批处理
        </button>
      )}
    </div>
  );
}
