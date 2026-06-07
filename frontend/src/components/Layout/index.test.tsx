/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { Layout } from "./index";

describe("Layout", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<Layout {...({} as any)} children={<div></div>} />);
    expect(container).toBeTruthy();
  });
});
