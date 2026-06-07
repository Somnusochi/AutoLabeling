/** File upload, preview, and category state. */
export function useUploadState() {
  const [inputMode, setInputMode] = useState<"image" | "video">("image");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const setPreview = useCallback((url: string | null) => {
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  return {
    inputMode, setInputMode,
    files, setFiles,
    previewUrl, setPreviewUrl: setPreview,
    categories, setCategories,
  };
}
