import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { API_BASE, DEFAULT_CONF, DEFAULT_IOU } from "@/lib/constants";
import type { Detection } from "@/types";

interface ValidateMode {
  jobId: string;
  modelVariant: string;
}

export function useYoloValidation() {
  const [validateMode, setValidateMode] = useState<ValidateMode | null>(null);
  const [validateConf, setValidateConf] = useState(DEFAULT_CONF);
  const [validateIou, setValidateIou] = useState(DEFAULT_IOU);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setValidateMode({ jobId: detail.jobId, modelVariant: detail.modelVariant });
      toast.success(`已切换至验证模式: ${detail.modelVariant}`);
    };
    window.addEventListener("yolo-validate", handler);
    return () => window.removeEventListener("yolo-validate", handler);
  }, []);

  const exitValidation = useCallback(() => {
    setValidateMode(null);
    setValidating(false);
  }, []);

  const runValidation = useCallback(
    async (file: File): Promise<Detection | null> => {
      if (!validateMode) return null;
      setValidating(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("conf", String(validateConf));
        form.append("iou", String(validateIou));
        const res = await fetch(
          `${API_BASE}/train/jobs/${validateMode.jobId}/predict`,
          { method: "POST", body: form },
        );
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.detail ?? "验证失败");
          return null;
        }
        const data = json.data;
        return {
          id: `validate-${Date.now()}`,
          image_name: file.name,
          categories: [],
          model_name: validateMode.modelVariant,
          image_width: data.image_width,
          image_height: data.image_height,
          status: "completed",
          elapsed_ms: null,
          filter_mode: null,
          filter_nms_iou: null,
          created_at: new Date().toISOString(),
          boxes: data.boxes.map((b: Record<string, unknown>, i: number) => ({
            id: `vb-${i}`,
            class_name: b.class_name as string,
            x1: b.x1 as number,
            y1: b.y1 as number,
            x2: b.x2 as number,
            y2: b.y2 as number,
            confidence: b.confidence as number,
          })),
        };
      } catch {
        toast.error("验证失败");
        return null;
      } finally {
        setValidating(false);
      }
    },
    [validateMode, validateConf, validateIou],
  );

  return {
    validateMode,
    validateConf,
    validateIou,
    validating,
    setValidateConf,
    setValidateIou,
    exitValidation,
    runValidation,
  };
}
