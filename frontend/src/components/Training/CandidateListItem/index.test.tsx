/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { CandidateListItem } from "./index";

describe("CandidateListItem", () => {
  it("renders without crashing", () => {
    const { container } = render(<CandidateListItem {...({} as any)} virtualRow={{ size: 40, start: 0 }} det={{ boxes: [], id: "1", imageId: "1", imageName: "", categories: [], useSam2: false, useSam3: false, useSam3Seg: false, createdAt: "" }} />);
    expect(container).toBeTruthy();
  });
});
