/** Model selection and parameter state. */
export function useModelConfig() {
  const [appMode, setAppMode] = useState<"annotate" | "validate">("annotate");
  const [useSam2, setUseSam2] = useState(false);
  const [useSam3, setUseSam3] = useState(false);
  const [useSam3Seg, setUseSam3Seg] = useState(true);
  const [sam3Threshold, setSam3Threshold] = useState(0.5);
  const [sam3MaskThreshold, setSam3MaskThreshold] = useState(0.5);
  const [sam2ScoreThreshold, setSam2ScoreThreshold] = useState(0.0);
  const [sam3Text, setSam3Text] = useState("");

  return {
    appMode, setAppMode,
    useSam2, setUseSam2,
    useSam3, setUseSam3,
    useSam3Seg, setUseSam3Seg,
    sam3Threshold, setSam3Threshold,
    sam3MaskThreshold, setSam3MaskThreshold,
    sam2ScoreThreshold, setSam2ScoreThreshold,
    sam3Text, setSam3Text,
  };
}
