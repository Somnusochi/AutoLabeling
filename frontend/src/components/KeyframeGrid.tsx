interface Props {
  videoId: string;
  keyframes: KeyFrame[];
  loading: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function KeyframeGrid({ videoId, keyframes, loading }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-xs text-gray-400">
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {t("videoPanel.extracting")}
      </div>
    );
  }

  if (keyframes.length === 0) return null;

  const visible = expanded ? keyframes : keyframes.slice(0, 8);

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 gap-1">
        {visible.map((kf) => (
          <div
            key={kf.id}
            className="relative rounded overflow-hidden border border-gray-200"
          >
            <img
              src={keyframeImageUrl(videoId, kf.id)}
              alt={`#${kf.frameNumber}`}
              className="w-full h-14 object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1 flex justify-between">
              <span>#{kf.frameNumber}</span>
              <span>{formatTime(kf.timestampSeconds)}</span>
            </div>
          </div>
        ))}
      </div>
      {keyframes.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-[10px] text-gray-400 hover:text-gray-600"
        >
          {expanded ? t("common.collapse") : t("videoPanel.expandAll", { count: keyframes.length })}
        </button>
      )}
    </div>
  );
}
