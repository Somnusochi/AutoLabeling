import { render } from "@/utils/test-utils";
import {describe, it, expect, vi} from "vitest";
import { TrainingPanel } from "./index";

vi.mock("@/store/useAppStore", () => ({
  useAppStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { isTraining: false, setIsTraining: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

describe("TrainingPanel", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(
      <TrainingPanel
        detections={[]}
        total={0}
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={() => {}}
      />,
    );
    expect(container).toBeTruthy();
  });
});
