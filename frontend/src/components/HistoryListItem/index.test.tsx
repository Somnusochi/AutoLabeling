/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { HistoryListItem } from "./index";

describe("HistoryListItem", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<HistoryListItem {...({} as any)} virtualRow={{ index: 0, size: 40, start: 0 }} det={{ boxes: [], id: "1", imageId: "1", imageName: "", categories: [], useSam2: false, useSam3: false, useSam3Seg: false, createdAt: "" }} />);
    expect(container).toBeTruthy();
  });
});
