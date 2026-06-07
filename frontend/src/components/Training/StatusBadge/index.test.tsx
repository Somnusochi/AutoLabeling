/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { StatusBadge } from "./index";

describe("StatusBadge", () => {
  it("renders without crashing", () => {
    const { container } = render(<StatusBadge {...({} as any)} />);
    expect(container).toBeTruthy();
  });
});
