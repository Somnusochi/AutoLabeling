import { Image } from "antd";

interface Props {
  method: "scene" | "motion" | "interval";
  threshold: number;
  intervalSec: number;
  maxFrames: number;
  ssimThreshold: number;
  extracting: boolean;
  loadingAll: boolean;
  selectedFrameIds: Set<string>;
  selectedVideo: VideoInfo;
  isValidation?: boolean;
  onMethodChange: (m: "scene" | "motion" | "interval") => void;
  onThresholdChange: (v: number) => void;
  onIntervalChange: (v: number) => void;
  onMaxFramesChange: (v: number) => void;
  onSsimChange: (v: number) => void;
  onExtract: (videoId: string) => void;
  onValidateVideo?: (videoId: string) => void;
  onLoadSelected: (video: VideoInfo) => void;
  onSelectAllFrames: (video: VideoInfo) => void;
  onDeselectAllFrames: () => void;
  onToggleFrame: (id: string) => void;
}

export function ExtractionPanel({
  method,
  threshold,
  intervalSec,
  maxFrames,
  ssimThreshold,
  extracting,
  loadingAll,
  selectedFrameIds,
  selectedVideo,
  isValidation,
  onMethodChange,
  onThresholdChange,
  onIntervalChange,
  onMaxFramesChange,
  onSsimChange,
  onExtract,
  onValidateVideo,
  onLoadSelected,
  onSelectAllFrames,
  onDeselectAllFrames,
  onToggleFrame,
}: Props) {
  const { t } = useTranslation();
  const methodLabels: Record<string, string> = {
    scene: t("videoPanel.modeScene"),
    motion: t("videoPanel.modeMotion"),
    interval: t("videoPanel.modeInterval"),
  };

  if (isValidation) {
    return (
      <div className="rounded border border-gray-200 p-2.5">
        <button
          onClick={() => onValidateVideo!(selectedVideo.id)}
          className="w-full rounded bg-green-600 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
        >
          {t("videoPanel.validateVideoRealtime")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-200 p-2.5 space-y-3">
      {/* Method toggle */}
      <div className="flex gap-0.5 rounded bg-gray-100 p-0.5">
        {(["scene", "motion", "interval"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onMethodChange(m)}
            className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
              method === m
                ? "bg-white text-primary-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {methodLabels[m]}
          </button>
        ))}
      </div>

      {/* Settings */}
      <div className="space-y-2 text-[11px]">
        {method === "scene" && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-gray-500">{t("videoPanel.sceneThreshold")}</span>
              <span className="text-gray-700 font-medium">{threshold}</span>
            </div>
            <input
              type="range" min={1} max={100}
              value={threshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
              className="w-full h-1 accent-primary-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{t("videoPanel.moreFrames")}</span>
              <span>{t("videoPanel.fewerFrames")}</span>
            </div>
          </div>
        )}
        {method === "motion" && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-gray-500">{t("videoPanel.motionThreshold")}</span>
              <span className="text-gray-700 font-medium">{threshold}px</span>
            </div>
            <input
              type="range" min={1} max={50} step={0.5}
              value={threshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
              className="w-full h-1 accent-primary-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{t("videoPanel.motionMore")}</span>
              <span>{t("videoPanel.motionFewer")}</span>
            </div>
          </div>
        )}
        {method === "interval" && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{t("videoPanel.timeInterval")}</span>
            <input
              type="number" min={0.5} max={60} step={0.5}
              value={intervalSec}
              onChange={(e) => onIntervalChange(Number(e.target.value))}
              className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
            />
            <span className="text-gray-400">{t("videoPanel.unitSeconds")}</span>
          </div>
        )}

        {/* Max frames */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{t("videoPanel.maxFrames")}</span>
          <input
            type="number" min={1} max={1000}
            value={maxFrames}
            onChange={(e) => onMaxFramesChange(Number(e.target.value))}
            className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
          />
          <span className="text-gray-400">{t("videoPanel.unitFrames")}</span>
        </div>

        {/* SSIM */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-gray-500">{t("videoPanel.ssimThreshold")}</span>
            <span className="text-gray-700 font-medium">
              {ssimThreshold >= 1 ? t("videoPanel.ssimClose") : ssimThreshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range" min={0.5} max={1} step={0.01}
            value={ssimThreshold}
            onChange={(e) => onSsimChange(Number(e.target.value))}
            className="w-full h-1 accent-primary-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>{t("videoPanel.ssimStrict")}</span>
            <span>{t("videoPanel.ssimLoose")}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        {selectedVideo.keyframes.length === 0 ? (
          <button
            onClick={() => onExtract(selectedVideo.id)}
            disabled={extracting}
            className="flex-1 rounded bg-primary-600 py-1.5 text-[11px] font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {extracting ? t("videoPanel.extracting") : t("videoPanel.startExtract")}
          </button>
        ) : (
          <>
            <button
              onClick={() => onLoadSelected(selectedVideo)}
              disabled={loadingAll || selectedFrameIds.size === 0}
              className="flex-1 rounded bg-green-600 py-1.5 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loadingAll
                ? t("common.loading")
                : t("videoPanel.loadSelected", { count: selectedFrameIds.size })}
            </button>
            <button
              onClick={() => onExtract(selectedVideo.id)}
              disabled={extracting}
              className="rounded border border-gray-200 px-2 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("videoPanel.reExtract")}
            </button>
          </>
        )}
      </div>

      {/* Keyframe strip */}
      {extracting && (
        <div className="flex items-center gap-2 py-3 justify-center text-[11px] text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {t("videoPanel.extracting")}
        </div>
      )}

      {!extracting && selectedVideo.keyframes.length > 0 && (
        <KeyframeStrip
          selectedVideo={selectedVideo}
          selectedFrameIds={selectedFrameIds}
          onToggleFrame={onToggleFrame}
          onSelectAll={onSelectAllFrames}
          onDeselectAll={onDeselectAllFrames}
        />
      )}
    </div>
  );
}

function KeyframeStrip({
  selectedVideo,
  selectedFrameIds,
  onToggleFrame,
  onSelectAll,
  onDeselectAll,
}: {
  selectedVideo: VideoInfo;
  selectedFrameIds: Set<string>;
  onToggleFrame: (id: string) => void;
  onSelectAll: (video: VideoInfo) => void;
  onDeselectAll: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-gray-400">
          {t("videoPanel.selectedCount", {
            current: selectedFrameIds.size,
            total: selectedVideo.keyframes.length,
          })}
        </span>
        <div className="flex gap-1">
          <button onClick={() => onSelectAll(selectedVideo)} className="text-gray-500 hover:text-primary-600">
            {t("videoPanel.selectAll")}
          </button>
          <button onClick={onDeselectAll} className="text-gray-500 hover:text-primary-600">
            {t("videoPanel.deselectAll")}
          </button>
        </div>
      </div>
      <Image.PreviewGroup>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {selectedVideo.keyframes.map((kf) => {
            const sel = selectedFrameIds.has(kf.id);
            return (
              <div
                key={kf.id}
                onClick={() => onToggleFrame(kf.id)}
                className={`flex-shrink-0 w-24 rounded overflow-hidden border-2 transition-all cursor-pointer ${
                  sel ? "border-primary-500 ring-1 ring-primary-200" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="relative">
                  <Image
                    src={keyframeImageUrl(selectedVideo.id, kf.id)}
                    alt={`#${kf.frameNumber}`}
                    className="w-full h-14 object-cover"
                    preview={{ mask: t("videoPanel.clickToView") }}
                    style={{ display: "block" }}
                  />
                  {sel && (
                    <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 text-[10px] text-gray-500 px-1 py-0.5 text-center">
                  {formatTime(kf.timestampSeconds)}
                </div>
              </div>
            );
          })}
        </div>
      </Image.PreviewGroup>
    </>
  );
}
