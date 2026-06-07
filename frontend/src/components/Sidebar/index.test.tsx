import { render } from "@/utils/test-utils";
import {describe, it, expect, vi} from "vitest";
import { Sidebar } from "./index";

describe("Sidebar", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    const mockProps = {
      recentCategories: [],
      handleFiles: vi.fn(),
      handleDetect: vi.fn(),
      handleSelectHistory: vi.fn(),
      handleSelectKeyframe: vi.fn(),
      loading: false,
      batchProgress: { current: 0, total: 0 },
      batchResults: [],
      setBatchResults: vi.fn(),
      cancel: vi.fn(),
      historyData: undefined,
      result: null,
      setResult: vi.fn(),
    };
    const { container } = render(<Sidebar {...mockProps} />);
    expect(container).toBeTruthy();
  });
});
