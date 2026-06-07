/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { DetectionResult } from "./index";

describe("DetectionResult", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<DetectionResult {...({} as any)} result={{ boxes: [], id: "1", imageId: "1", imageName: "", categories: [], useSam2: false, useSam3: false, useSam3Seg: false, createdAt: "" }} batchResults={[]} batchFiles={[]} categories={[]} hiddenIndices={new Set()} />);
    expect(container).toBeTruthy();
  });
});
