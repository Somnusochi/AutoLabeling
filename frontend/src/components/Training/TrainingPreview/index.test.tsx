/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { TrainingPreview } from "./index";

describe("TrainingPreview", () => {
  it("renders without crashing", () => {
    const { container } = render(<TrainingPreview {...({} as any)} detection={{ boxes: [], id: "1", imageId: "1", imageName: "", categories: [], useSam2: false, useSam3: false, useSam3Seg: false, createdAt: "" }} />);
    expect(container).toBeTruthy();
  });
});
