export function useBatchDetection() {
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const batchRef = useRef(false);

  const runBatch = useCallback(
    async (
      files: File[],
      categories: string[],
      useSam2: boolean,
      sam2ScoreThreshold: number,
      useSam3: boolean,
      sam3Text: string,
      useSam3Seg: boolean,
      sam3Threshold: number,
      sam3MaskThreshold: number,
      onEach: (result: Detection, file: File, index: number, elapsed: number) => void,
      signal?: AbortSignal,
    ) => {
      const results: Detection[] = [];
      setBatchProgress({ current: 0, total: files.length });
      batchRef.current = true;
      const t0 = performance.now();
      let elapsed = 0;

      try {
        for (let i = 0; i < files.length; i++) {
          if (!batchRef.current || signal?.aborted) break;
          const data = await detectImage(
            files[i],
            categories,
            useSam2,
            sam2ScoreThreshold,
            useSam3,
            sam3Text,
            useSam3Seg,
            sam3Threshold,
            sam3MaskThreshold,
            signal,
          );
          results.push(data);
          if (i === files.length - 1) {
            setBatchProgress({ current: 0, total: 0 });
          } else {
            setBatchProgress({ current: i + 1, total: files.length });
          }
          elapsed = Math.round(performance.now() - t0);
          onEach(data, files[i], i, elapsed);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          // silently handle abort
        }
        setBatchProgress({ current: 0, total: 0 });
      }
      return { results, elapsed };
    },
    [],
  );

  const cancelBatch = useCallback(() => {
    batchRef.current = false;
    setBatchProgress({ current: 0, total: 0 });
  }, []);

  return { batchProgress, runBatch, cancelBatch, setBatchProgress };
}
