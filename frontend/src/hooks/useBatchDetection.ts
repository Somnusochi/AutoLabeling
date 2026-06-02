import { useCallback, useRef, useState } from "react";
import { detectImage } from "@/services/api";
import type { Detection } from "@/types";

export function useBatchDetection() {
  const [batchResults, setBatchResults] = useState<Detection[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const batchRef = useRef(false);

  const runBatch = useCallback(
    async (
      files: File[],
      categories: string[],
      onEach: (result: Detection, file: File, index: number, elapsed: number) => void,
    ) => {
      const results: Detection[] = [];
      setBatchProgress({ current: 0, total: files.length });
      batchRef.current = true;
      const t0 = performance.now();
      let elapsed = 0;

      try {
        for (let i = 0; i < files.length; i++) {
          if (!batchRef.current) break;
          const data = await detectImage(files[i], categories);
          results.push(data);
          setBatchResults([...results]);
          if (i === files.length - 1) {
            setBatchProgress({ current: 0, total: 0 });
          } else {
            setBatchProgress({ current: i + 1, total: files.length });
          }
          elapsed = Math.round(performance.now() - t0);
          onEach(data, files[i], i, elapsed);
        }
      } catch {
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

  return { batchResults, batchProgress, runBatch, cancelBatch, setBatchResults };
}
