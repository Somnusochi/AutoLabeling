/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { VideoDetail } from "./index";

describe("VideoDetail", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<VideoDetail {...({} as any)} video={{ keyframes: [] }} />);
    expect(container).toBeTruthy();
  });
});
