import { create } from "zustand";
import type { FilterMode } from "@/lib/filterBoxes";

interface AppState {
  // Model Config
  appMode: "annotate" | "validate";
  setAppMode: (mode: "annotate" | "validate") => void;
  useSam2: boolean;
  setUseSam2: (v: boolean) => void;
  useSam3: boolean;
  setUseSam3: (v: boolean) => void;
  useSam3Seg: boolean;
  setUseSam3Seg: (v: boolean) => void;
  sam3Threshold: number;
  setSam3Threshold: (v: number) => void;
  sam3MaskThreshold: number;
  setSam3MaskThreshold: (v: number) => void;
  sam2ScoreThreshold: number;
  setSam2ScoreThreshold: (v: number) => void;
  sam3Text: string;
  setSam3Text: (v: string) => void;

  // Upload State
  inputMode: "image" | "video";
  setInputMode: (mode: "image" | "video") => void;
  files: File[];
  setFiles: (files: File[]) => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  categories: string[];
  setCategories: (categories: string[]) => void;

  // Annotation State
  canvasMode: "view" | "draw";
  setCanvasMode: (mode: "view" | "draw") => void;
  drawCategory: string;
  setDrawCategory: (cat: string) => void;
  hiddenIndices: Set<string>;
  setHiddenIndices: (indices: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  nmsIou: number;
  setNmsIou: (iou: number) => void;

  // Yolo Validation State
  validateModelSource: "trained" | "upload";
  setValidateModelSource: (source: "trained" | "upload") => void;
  selectedTrainedJobId: string | null;
  setSelectedTrainedJobId: (id: string | null) => void;
  validateVideoId: string | null;
  setValidateVideoId: (id: string | null) => void;
  validateRunKey: number;
  setValidateRunKey: (key: number | ((prev: number) => number)) => void;
  externalModelFile: File | null;
  setExternalModelFile: (file: File | null) => void;
  validateConf: number;
  setValidateConf: (conf: number) => void;
  validateIou: number;
  setValidateIou: (iou: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Model Config
  appMode: "annotate",
  setAppMode: (mode) => set({ appMode: mode }),
  useSam2: false,
  setUseSam2: (useSam2) => set({ useSam2 }),
  useSam3: false,
  setUseSam3: (useSam3) => set({ useSam3 }),
  useSam3Seg: true,
  setUseSam3Seg: (useSam3Seg) => set({ useSam3Seg }),
  sam3Threshold: 0.5,
  setSam3Threshold: (sam3Threshold) => set({ sam3Threshold }),
  sam3MaskThreshold: 0.5,
  setSam3MaskThreshold: (sam3MaskThreshold) => set({ sam3MaskThreshold }),
  sam2ScoreThreshold: 0.0,
  setSam2ScoreThreshold: (sam2ScoreThreshold) => set({ sam2ScoreThreshold }),
  sam3Text: "",
  setSam3Text: (sam3Text) => set({ sam3Text }),

  // Upload State
  inputMode: "image",
  setInputMode: (inputMode) => set({ inputMode }),
  files: [],
  setFiles: (files) => set({ files }),
  previewUrl: null,
  setPreviewUrl: (url) => set((state) => {
    if (state.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(state.previewUrl);
    return { previewUrl: url };
  }),
  categories: [],
  setCategories: (categories) => set({ categories }),

  // Annotation State
  canvasMode: "view",
  setCanvasMode: (canvasMode) => set({ canvasMode }),
  drawCategory: "",
  setDrawCategory: (drawCategory) => set({ drawCategory }),
  hiddenIndices: new Set(),
  setHiddenIndices: (updater) => set((state) => ({
    hiddenIndices: typeof updater === "function" ? updater(state.hiddenIndices) : updater
  })),
  filterMode: "all",
  setFilterMode: (filterMode) => set({ filterMode }),
  nmsIou: 0.5,
  setNmsIou: (nmsIou) => set({ nmsIou }),

  // Yolo Validation State
  validateModelSource: "trained",
  setValidateModelSource: (validateModelSource) => set({ validateModelSource }),
  selectedTrainedJobId: null,
  setSelectedTrainedJobId: (selectedTrainedJobId) => set({ selectedTrainedJobId }),
  validateVideoId: null,
  setValidateVideoId: (validateVideoId) => set({ validateVideoId }),
  validateRunKey: 0,
  setValidateRunKey: (updater) => set((state) => ({
    validateRunKey: typeof updater === "function" ? updater(state.validateRunKey) : updater
  })),
  externalModelFile: null,
  setExternalModelFile: (externalModelFile) => set({ externalModelFile }),
  validateConf: 0.25,
  setValidateConf: (validateConf) => set({ validateConf }),
  validateIou: 0.7,
  setValidateIou: (validateIou) => set({ validateIou }),
}));
