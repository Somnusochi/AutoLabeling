import type { BBox } from "@/types";

interface Props {
  boxes: BBox[];
  onDelete?: (boxIndex: number) => void;
}

export function ResultTable({ boxes, onDelete }: Props) {
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
              {onDelete && (
                <td className="px-2 py-2">
                  <button
                    onClick={() => onDelete(i)}
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
