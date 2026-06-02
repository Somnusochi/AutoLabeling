interface Props {
  selectedJobId: string | null;
  onSelectJob: (id: string | null) => void;
  modelSource: "trained" | "upload";
  onSourceChange: (source: "trained" | "upload") => void;
  externalFile: File | null;
  onExternalFile: (file: File | null) => void;
  validateConf: number;
  onConfChange: (conf: number) => void;
  validateIou: number;
  onIouChange: (iou: number) => void;
}

export function ValidationSettings({
  selectedJobId,
  onSelectJob,
  modelSource,
  onSourceChange,
  externalFile,
  onExternalFile,
  validateConf,
  onConfChange,
  validateIou,
  onIouChange,
}: Props) {
  return (
    <div className="rounded border border-green-200 p-2.5 text-xs space-y-3">
      <ModelSelector
        selectedJobId={selectedJobId}
        onSelectJob={onSelectJob}
        modelSource={modelSource}
        onSourceChange={onSourceChange}
        externalFile={externalFile}
        onExternalFile={onExternalFile}
      />
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-gray-500">Conf (置信度阈值)</span>
          <span className="text-gray-700 font-medium">{validateConf.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={validateConf}
          onChange={(e) => onConfChange(Number(e.target.value))}
          className="w-full h-1 accent-green-500"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-gray-500">IoU (重叠阈值)</span>
          <span className="text-gray-700 font-medium">{validateIou.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={validateIou}
          onChange={(e) => onIouChange(Number(e.target.value))}
          className="w-full h-1 accent-green-500"
        />
      </div>
    </div>
  );
}
