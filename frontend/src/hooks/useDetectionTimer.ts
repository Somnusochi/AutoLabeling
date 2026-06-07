/** Elapsed time tracking for detection operations. */
export function useDetectionTimer() {
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setElapsedMs(0);
    timerRef.current = setInterval(() => setElapsedMs((prev) => prev + 100), 100);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { elapsedMs, startTimer: start, stopTimer: stop };
}
