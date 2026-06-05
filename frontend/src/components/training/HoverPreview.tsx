interface HoverPreviewProps {
  detId: string;
  hoveredRect: { right: number; top: number };
  setHoveredDetId: (id: string | null) => void;
  setHoveredRect: (rect: { right: number; top: number } | null) => void;
  leaveTimerRef: { current: number | null };
}

export function HoverPreview({
  detId,
  hoveredRect,
  setHoveredDetId,
  setHoveredRect,
  leaveTimerRef,
}: HoverPreviewProps) {
  const [det, setDet] = useState<Detection | null>(null);

  useEffect(() => {
    let active = true;
    getDetection(detId).then((d) => {
      if (active) setDet(d);
    });
    return () => {
      active = false;
    };
  }, [detId]);

  return (
    <div
      className="fixed z-50"
      style={{
        left: `${hoveredRect.right + 8}px`,
        top: `${Math.max(60, hoveredRect.top - 40)}px`,
      }}
      onMouseEnter={() => {
        if (leaveTimerRef.current) {
          clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = null;
        }
      }}
      onMouseLeave={() => {
        leaveTimerRef.current = window.setTimeout(() => {
          setHoveredDetId(null);
          setHoveredRect(null);
        }, 150);
      }}
    >
      {det ? (
        <TrainingPreview detection={det} />
      ) : (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-64 h-48 flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
    </div>
  );
}
