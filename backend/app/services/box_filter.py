"""Apply filter mode to a list of box dicts."""


def _iou(a: dict, b: dict) -> float:
    x1 = max(a["x1"], b["x1"])
    y1 = max(a["y1"], b["y1"])
    x2 = min(a["x2"], b["x2"])
    y2 = min(a["y2"], b["y2"])
    if x2 <= x1 or y2 <= y1:
        return 0.0
    inter = (x2 - x1) * (y2 - y1)
    area_a = (a["x2"] - a["x1"]) * (a["y2"] - a["y1"])
    area_b = (b["x2"] - b["x1"]) * (b["y2"] - b["y1"])
    return inter / (area_a + area_b - inter)


def nms(boxes: list[dict], iou_threshold: float = 0.5) -> list[dict]:
    kept: list[dict] = []
    for box in boxes:
        if not any(_iou(k, box) >= iou_threshold for k in kept):
            kept.append(box)
    return kept


def best_per_class(boxes: list[dict]) -> list[dict]:
    seen: set[str] = set()
    result: list[dict] = []
    for box in boxes:
        name = box.get("class_name", "")
        if name not in seen:
            seen.add(name)
            result.append(box)
    return result


def apply_filter(
    boxes: list[dict],
    mode: str | None,
    nms_iou: float | None = None,
) -> list[dict]:
    if not boxes:
        return boxes
    if mode == "best":
        return best_per_class(boxes)
    if mode == "nms":
        return nms(boxes, nms_iou or 0.5)
    return boxes  # "all" or None → no filtering
