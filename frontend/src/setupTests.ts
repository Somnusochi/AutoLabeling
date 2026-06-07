import "@testing-library/jest-dom";
import { vi } from "vitest";

globalThis.EventSource = class EventSource {
  constructor() {}
  close() {}
} as unknown as typeof EventSource;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" ? false : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh" },
  }),
}));

vi.mock("axios", () => {
  return {
    default: {
      get: vi.fn(() => Promise.resolve({ data: {} })),
      post: vi.fn(() => Promise.resolve({ data: {} })),
      put: vi.fn(() => Promise.resolve({ data: {} })),
      delete: vi.fn(() => Promise.resolve({ data: {} })),
      create: vi.fn(function (this: Record<string, unknown>) { return this; }),
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
    },
  };
});

vi.mock("@/store/useAppStore", () => ({
  useAppStore: <T>(selector?: (state: Record<string, unknown>) => T): T | Record<string, unknown> => {
    const state = {
      appMode: "annotate",
      validateConf: 0.5,
      files: [],
      recentCategories: [],
      categories: [],
      canvasMode: "view",
      hiddenIndices: new Set(),
    };
    return selector ? selector(state) : state;
  },
}));
