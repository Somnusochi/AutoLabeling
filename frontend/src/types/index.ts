export interface BBox {
  id: string;
  class_name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number | null;
}

export interface Detection {
  id: string;
  image_name: string;
  categories: string;
  model_name: string;
  image_width: number;
  image_height: number;
  elapsed_ms: number | null;
  status: string;
  created_at: string;
  boxes: BBox[];
}

export interface DetectionList {
  total: number;
  items: Detection[];
}

export type DetectResponse = Detection;

export interface TrainingJob {
  id: string;
  model_variant: string;
  epochs: number;
  imgsz: number;
  batch: number;
  detection_ids: string;
  status: "pending" | "running" | "completed" | "failed";
  metrics: string | null;
  model_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}
