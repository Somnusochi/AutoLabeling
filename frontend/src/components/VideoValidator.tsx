import { PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";

interface Props {
  videoId: string;
  jobId?: string;
  modelFile?: File;
  conf: number;
  iou: number;
}

export function VideoValidator({ videoId, jobId, modelFile, conf, iou }: Props) {
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mjpegUrl, setMjpegUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFrozenFrame, setHasFrozenFrame] = useState(false);
  const [uploadedToken, setUploadedToken] = useState<string | null>(() => {
    return modelFile ? tokenCache.get(modelFile) || null : null;
  });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [prevVideoId, setPrevVideoId] = useState(videoId);
  const [prevJobId, setPrevJobId] = useState(jobId);
  const [prevModelFile, setPrevModelFile] = useState(modelFile);
  const [prevConf, setPrevConf] = useState(conf);
  const [prevIou, setPrevIou] = useState(iou);
  const [prevReloadKey, setPrevReloadKey] = useState(reloadKey);

  // If videoId, jobId, or modelFile changes (fresh layout, clear frozen frame)
  if (videoId !== prevVideoId || jobId !== prevJobId || modelFile !== prevModelFile) {
    setPrevVideoId(videoId);
    setPrevJobId(jobId);
    setPrevModelFile(modelFile);
    setPaused(false);
    setEnded(false);
    setLoading(true);
    setHasFrozenFrame(false);
    if (modelFile !== prevModelFile) {
      if (modelFile) {
        tokenCache.delete(modelFile);
        uploadCache.delete(modelFile);
      }
      setUploadedToken(null);
    }
  }

  // If conf, iou, or reloadKey changes (keep frozen frame to prevent flash)
  if (conf !== prevConf || iou !== prevIou || reloadKey !== prevReloadKey) {
    setPrevConf(conf);
    setPrevIou(iou);
    setPrevReloadKey(reloadKey);
    setPaused(false);
    setEnded(false);
    setLoading(true);
  }

  // Copy current image frame to canvas when paused or ended to freeze it visually
  useEffect(() => {
    if ((paused || ended) && imgRef.current && canvasRef.current) {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth || img.clientWidth || 640;
      canvas.height = img.naturalHeight || img.clientHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasFrozenFrame(true);
      }
    }
  }, [paused, ended]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (modelFile) {
        let token = uploadedToken;
        if (!token) {
          let promise = uploadCache.get(modelFile);
          if (!promise) {
            const form = new FormData();
            form.append("file", modelFile);
            promise = (async () => {
              const resp = await fetch(`${API_BASE}/train/upload-model`, {
                method: "POST",
                body: form,
              });
              const json = await resp.json();
              if (json.data?.token) {
                tokenCache.set(modelFile, json.data.token);
                return json.data.token;
              }
              throw new Error("No token returned from server");
            })();
            uploadCache.set(modelFile, promise);
          }

          try {
            token = await promise;
            if (!cancelled) {
              setUploadedToken(token);
            }
          } catch (e) {
            console.error("Failed to upload model:", e);
            tokenCache.delete(modelFile);
            uploadCache.delete(modelFile); // Evict from cache on failure so it can retry
            if (!cancelled) setLoading(false);
          }
        }
        if (!cancelled && token) {
          setMjpegUrl(
            `${API_BASE}/train/validate-mjpeg/${token}/${videoId}?conf=${conf}&iou=${iou}&r=${reloadKey}`,
          );
        }
      } else if (jobId) {
        setMjpegUrl(
          `${API_BASE}/train/jobs/${jobId}/validate-mjpeg/${videoId}?conf=${conf}&iou=${iou}&r=${reloadKey}`,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoId, jobId, modelFile, uploadedToken, conf, iou, reloadKey]);

  const handleContainerClick = () => {
    if (loading && !ended) return;
    if (!mjpegUrl) return;
    if (ended) {
      setReloadKey((prev) => prev + 1);
    } else {
      setPaused(!paused);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onClick={handleContainerClick}
        className={`bg-black rounded-lg overflow-hidden relative aspect-video w-full flex items-center justify-center ${(!loading || ended) && mjpegUrl ? "cursor-pointer select-none" : ""}`}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 z-10 bg-black/60 backdrop-blur-[0.5px]">
            <svg className="animate-spin h-5 w-5 mr-2 text-green-500" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {modelFile && !uploadedToken
              ? t("videoValidator.uploadingModel")
              : t("videoValidator.connecting")}
          </div>
        )}
        {mjpegUrl && (
          <>
            <img
              key={mjpegUrl}
              ref={imgRef}
              src={mjpegUrl}
              alt={t("videoValidator.realtimeInference")}
              onLoad={() => {
                setLoading(false);
                setHasFrozenFrame(false);
              }}
              onError={() => {
                if (!loading) {
                  setEnded(true);
                } else {
                  setLoading(false);
                }
              }}
              className={`max-w-full max-h-full object-contain ${paused || ended || loading ? "absolute pointer-events-none opacity-0" : "block"}`}
            />
            <canvas
              ref={canvasRef}
              className={`max-w-full max-h-full object-contain ${(paused || ended || loading) && hasFrozenFrame ? "block" : "hidden"}`}
            />
          </>
        )}
        {paused && !loading && !ended && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-gray-200 bg-black/40 gap-2 backdrop-blur-[1.5px] z-10">
            <PlayCircleOutlined className="text-white drop-shadow" style={{ fontSize: "40px" }} />
            <span className="text-white font-medium drop-shadow text-xs">
              {t("videoValidator.clickToResume")}
            </span>
          </div>
        )}
        {ended && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-gray-200 bg-black/50 gap-2 backdrop-blur-[1.5px] z-10">
            <ReloadOutlined
              className="text-white drop-shadow animate-pulse"
              style={{ fontSize: "40px" }}
            />
            <span className="text-white font-medium drop-shadow text-xs">
              {t("videoValidator.playerCompleted")}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{t("videoValidator.mjpegStreamTips")}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setReloadKey((prev) => prev + 1);
          }}
          className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1 transition-all px-2.5 py-1.5 rounded-md hover:bg-green-50/50 border border-green-200/60 cursor-pointer active:scale-95 bg-white shadow-sm"
        >
          <ReloadOutlined className="text-xs" />
          {t("videoValidator.rerunValidation")}
        </button>
      </div>
    </div>
  );
}
