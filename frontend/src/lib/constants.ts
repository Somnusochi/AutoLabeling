export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
export const MAX_UPLOAD_SIZE_MB = 20;

// Canvas display limits
export const CANVAS_MAX_W = 700;
export const CANVAS_MAX_H = 500;
export const CANVAS_MIN_BOX_SIZE = 5;

// Shared color palette for bounding boxes
export const BOX_COLORS = [
  "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
] as const;

// Training defaults
export const DEFAULT_CONF = 0.25;
export const DEFAULT_IOU = 0.45;
export const DEFAULT_EPOCHS = 100;
export const DEFAULT_IMGSZ = 640;
export const DEFAULT_BATCH = 16;

export const uploadCache = new WeakMap<File, Promise<string>>();
export const tokenCache = new WeakMap<File, string>();

