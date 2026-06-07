/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { BatchProgress } from "./index";

describe("BatchProgress", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<BatchProgress {...({} as any)} progress={{ current: 1, total: 10 }} cancelBatch={() => {}} />);
    expect(container).toBeTruthy();
  });
});
