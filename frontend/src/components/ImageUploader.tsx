import { useCallback, useRef, useState, type DragEvent } from "react";

const MAX_LONG_SIDE = 1280;
const JPEG_QUALITY = 0.75;

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  acceptVideos?: boolean;
}

function compressImage(file: File): Promise<File> {
  if (file.type.startsWith("video/")) return Promise.resolve(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const longest = Math.max(w, h);
      if (longest <= MAX_LONG_SIDE && file.type === "image/jpeg") {
        return resolve(file);
      }
      const scale = Math.min(1, MAX_LONG_SIDE / longest);
      const dw = Math.round(w * scale);
      const dh = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      canvas.getContext("2d")!.drawImage(img, 0, 0, dw, dh);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

async function processFiles(fileList: FileList | File[]): Promise<File[]> {
  const images = Array.from(fileList).filter((f) => acceptVideos ? (f.type.startsWith("image/") || f.type.startsWith("video/")) : f.type.startsWith("image/"));
  const results: File[] = [];
  for (const f of images) {
    try {
      results.push(await compressImage(f));
    } catch {
      results.push(f);
    }
  }
  return results;
}

export function ImageUploader({ onFiles, disabled, acceptVideos }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (files: FileList | File[]) => {
      setCompressing(true);
      const processed = await processFiles(files);
      setPreviews(processed.map((f) => URL.createObjectURL(f)));
      onFiles(processed);
      setCompressing(false);
    },
    [onFiles],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) handle(e.dataTransfer.files);
    },
    [handle],
  );

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors
          ${disabled ? "pointer-events-none opacity-50" : ""}
          ${dragOver
            ? "border-primary-500 bg-primary-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50"
          }
        `}
      >
        {compressing ? (
          <div className="text-gray-400 text-sm">压缩中...</div>
        ) : previews.length > 0 ? (
          previews.length === 1 ? (
            <div className="flex flex-col items-center gap-2">
              <img src={previews[0]} alt="" className="w-full max-h-44 rounded object-contain" />
              <p className="text-xs text-gray-400">点击更换图片</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 justify-center">
              {previews.slice(0, 8).map((url, i) => (
                <img key={i} src={url} alt="" className="h-20 w-20 rounded object-cover" />
              ))}
              {previews.length > 8 && (
                <span className="h-20 w-20 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                  +{previews.length - 8}
                </span>
              )}
              <p className="w-full text-xs text-gray-400 mt-1">{previews.length} 张图片</p>
            </div>
          )
        ) : (
          <div className="text-gray-500">
            <p className="text-sm">拖拽图片/文件夹到此处，或点击选择</p>
            <p className="mt-1 text-xs text-gray-400">
              支持多选 · 文件夹 · JPG/PNG/WebP · 自动压缩至 {MAX_LONG_SIDE}px
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={acceptVideos ? "image/*,video/*" : "image/*"}
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
