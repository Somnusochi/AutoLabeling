import { Dropdown, Popconfirm } from "antd";
import type { VirtualItem } from "@tanstack/react-virtual";

interface HistoryListItemProps {
  det: Detection;
  virtualRow: VirtualItem;
  measureElement: (node: Element | null) => void;
  selectedSet: Set<string>;
  onSelect: (det: Detection) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export const HistoryListItem = memo(
  ({
    det,
    virtualRow,
    measureElement,
    selectedSet,
    onSelect,
    onDelete,
    isDeleting,
  }: HistoryListItemProps) => {
    const { t, i18n } = useTranslation();

    return (
      <div
        data-index={virtualRow.index}
        ref={measureElement}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${virtualRow.start}px)`,
        }}
        className="pb-1"
      >
        <div
          onClick={() => onSelect(det)}
          className="rounded border border-gray-100 p-2 hover:bg-gray-50 cursor-pointer transition-colors h-full"
        >
          <div className="flex gap-2">
            <img
              src={`${API_BASE}/detections/${det.id}/image`}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-12 w-12 rounded object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{det.imageName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(det.createdAt).toLocaleString(
                  i18n.language.startsWith("zh") ? "zh-CN" : "en-US",
                )}
              </p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {parseCategories(det.categories).map((c) => (
                  <span
                    key={c}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      selectedSet.has(c)
                        ? "bg-primary-500 text-white"
                        : "bg-primary-100 text-primary-700"
                    }`}
                  >
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {det.modelType && (
                  <span
                    className={`inline-block rounded px-1 py-0.5 mr-1 text-[10px] font-medium ${
                      det.modelType === "sam3"
                        ? "bg-violet-100 text-violet-700"
                        : det.modelType === "vlm+sam2"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {det.modelType === "sam3"
                      ? "SAM3"
                      : det.modelType === "vlm+sam2"
                        ? "VLM+SAM2"
                        : "VLM"}
                  </span>
                )}
                {t("trainingPanel.targetsCount", { count: det.boxes.length })}
              </p>
              <div className="flex gap-2 mt-1.5">
                <Dropdown
                  menu={{
                    items: [
                      { key: "yolo", label: "YOLO (.txt)" },
                      { key: "yolo-seg", label: "YOLO Segmentation" },
                      { key: "coco", label: "COCO (.json)" },
                      { key: "voc", label: "Pascal VOC (.xml)" },
                      { key: "createml", label: "CreateML (.json)" },
                    ],
                    onClick: async ({ key }) => {
                      const labels: Record<string, string> = {
                        yolo: "YOLO",
                        "yolo-seg": "YOLO_Seg",
                        coco: "COCO",
                        voc: "VOC",
                        createml: "CreateML",
                      };
                      try {
                        const blob = await exportBatch([det.id], key);
                        downloadBlob(blob, `${labels[key] ?? key}_dataset.zip`);
                      } catch {
                        /* ignore */
                      }
                    },
                  }}
                  trigger={["click"]}
                >
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    {t("common.export")}
                  </button>
                </Dropdown>
                <Popconfirm
                  title={t("historyList.deleteConfirm")}
                  onConfirm={() => onDelete(det.id)}
                  okText={t("common.delete")}
                  cancelText={t("common.cancel")}
                  okButtonProps={{ danger: true }}
                >
                  <button
                    onClick={(e) => e.stopPropagation()}
                    disabled={isDeleting}
                    className="text-xs text-red-500 hover:underline disabled:opacity-50"
                  >
                    {t("common.delete")}
                  </button>
                </Popconfirm>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
