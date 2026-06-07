/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { TrainingCandidateList } from "./index";

describe("TrainingCandidateList", () => {
  it("renders without crashing", () => {
    const { container } = render(<TrainingCandidateList {...({} as any)} filteredDetections={[]} selected={new Set()} />);
    expect(container).toBeTruthy();
  });
});
