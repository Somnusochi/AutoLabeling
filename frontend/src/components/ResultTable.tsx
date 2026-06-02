import type { BBox } from "@/types";

interface Props {
  boxes: BBox[];
  hiddenIndices: Set<string>;
  onToggleVisibility: (boxId: string) => void;
  onDelete?: (boxId: string) => void;
}

export function ResultTable({ boxes, hiddenIndices, onToggleVisibility, onDelete }: Props) {
  if (boxes.length === 0) {
    return <p className="py-4 text-sm text-gray-400 text-center">未检测到目标</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-600">#</th>
            <th className="px-4 py-2 text-left font-medium text-gray-600">类别</th>
            <th className="px-4 py-2 text-left font-medium text-gray-600">x1</th>
            <th className="px-4 py-2 text-left font-medium text-gray-600">y1</th>
            <th className="px-4 py-2 text-left font-medium text-gray-600">x2</th>
            <th className="px-4 py-2 text-left font-medium text-gray-600">y2</th>
            <th className="px-4 py-2 text-left font-medium text-gray-600">置信度</th>
            <th className="px-4 py-2 w-10" />
            {onDelete && <th className="px-4 py-2 w-12" />}
          </tr>
        </thead>
        <tbody>
          {boxes.map((box, i) => (
            <tr key={box.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-400">{i + 1}</td>
              <td className="px-4 py-2 font-medium text-gray-800">{box.class_name}</td>
              <td className="px-4 py-2 text-gray-600">{box.x1}</td>
              <td className="px-4 py-2 text-gray-600">{box.y1}</td>
              <td className="px-4 py-2 text-gray-600">{box.x2}</td>
              <td className="px-4 py-2 text-gray-600">{box.y2}</td>
              <td className="px-4 py-2 text-gray-600">
                {box.confidence != null ? box.confidence.toFixed(3) : "-"}
              </td>
              <td className="px-2 py-2">
                <button
                  onClick={() => onToggleVisibility(box.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title={hiddenIndices.has(box.id) ? "显示标注框" : "隐藏标注框"}
                >
                  {hiddenIndices.has(box.id) ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </td>
              {onDelete && (
                <td className="px-2 py-2">
                  <button
                    onClick={() => onDelete(box.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    title="删除此检测框"
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
