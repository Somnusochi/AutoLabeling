/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { ResultTable } from "./index";

describe("ResultTable", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<ResultTable {...({} as any)} boxes={[]} hiddenIndices={new Set()} />);
    expect(container).toBeTruthy();
  });
});
