/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { VideoValidator } from "./index";

describe("VideoValidator", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<VideoValidator {...({} as any)} videoId="1" conf={0.5} iou={0.5} />);
    expect(container).toBeTruthy();
  });
});
