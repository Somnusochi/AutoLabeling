/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { FilterPanel } from "./index";

describe("FilterPanel", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<FilterPanel {...({} as any)} categories={[]} filterMode="all" nmsIou={0.5} setFilterMode={() => {}} setNmsIou={() => {}} />);
    expect(container).toBeTruthy();
  });
});
