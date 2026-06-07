/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { HoverPreview } from "./index";

describe("HoverPreview", () => {
  it("renders without crashing", () => {
    const { container } = render(<HoverPreview {...({} as any)} hoveredRect={{ top: 0, right: 0, bottom: 0, left: 0 }} />);
    expect(container).toBeTruthy();
  });
});
