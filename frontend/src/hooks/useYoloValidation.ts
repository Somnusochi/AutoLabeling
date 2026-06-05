interface ValidateMode {
  jobId: string;
  modelVariant: string;
}

export function useYoloValidation() {
  const { t } = useTranslation();
  const [validateMode, setValidateMode] = useState<ValidateMode | null>(null);
  const [validateConf, setValidateConf] = useState(DEFAULT_CONF);
  const [validateIou, setValidateIou] = useState(DEFAULT_IOU);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setValidateMode({ jobId: detail.jobId, modelVariant: detail.modelVariant });
      toast.success(t("validationSettings.switchedToValidationMode", { model: detail.modelVariant }));
    };
    window.addEventListener("yolo-validate", handler);
    return () => window.removeEventListener("yolo-validate", handler);
  }, [t]);

  const exitValidation = useCallback(() => {
    setValidateMode(null);
    setValidating(false);
  }, []);

  const runValidation = useCallback(
    async (file: File, jobId?: string, token?: string, modelVariant?: string): Promise<Detection | null> => {
      const activeJobId = jobId || validateMode?.jobId;
      const activeVariant = modelVariant || validateMode?.modelVariant;
      if (!activeJobId && !token) {
        toast.error(t("validationSettings.selectOrUploadModelRequired"));
        return null;
      }
      setValidating(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("conf", String(validateConf));
        form.append("iou", String(validateIou));
        
        const url = token
          ? `${API_BASE}/train/validate-image/${token}`
          : `${API_BASE}/train/jobs/${activeJobId}/predict`;

        const res = await fetch(url, { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error?.message ?? t("validationSettings.validationFailed"));
          return null;
        }
        const data = json.data;
        return {
          id: `validate-${Date.now()}`,
          imageName: file.name,
          categories: [],
          modelName: token ? t("validationSettings.uploadedModelLabel") : (activeVariant || "YOLO"),
          modelType: null,
          imageWidth: data.imageWidth,
          imageHeight: data.imageHeight,
          status: "completed",
          elapsedMs: null,
          filterMode: null,
          filterNmsIou: null,
          createdAt: new Date().toISOString(),
          boxes: data.boxes.map((b: Record<string, unknown>, i: number) => ({
            id: `vb-${i}`,
            className: b.className as string,
            x1: b.x1 as number,
            y1: b.y1 as number,
            x2: b.x2 as number,
            y2: b.y2 as number,
            confidence: b.confidence as number,
          })),
        };
      } catch {
        toast.error(t("validationSettings.validationFailed"));
        return null;
      } finally {
        setValidating(false);
      }
    },
    [validateMode, validateConf, validateIou, t],
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
