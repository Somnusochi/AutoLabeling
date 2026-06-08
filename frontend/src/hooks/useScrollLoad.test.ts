import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@/utils/test-utils";
import { useRef } from "react";
import { useScrollLoad } from "./useScrollLoad";

describe("useScrollLoad", () => {
  it("does not fire when not scrolled near bottom", () => {
    const fetchNextPage = vi.fn();
    const { result: refResult } = renderHook(() => useRef<HTMLDivElement>(null));

    renderHook(() =>
      useScrollLoad(refResult.current, true, false, fetchNextPage, 100),
    );

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("fires fetchNextPage when scrolled near bottom", () => {
    const fetchNextPage = vi.fn();
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollTop", { value: 200, writable: true });
    Object.defineProperty(el, "scrollHeight", { value: 350, writable: true });
    Object.defineProperty(el, "clientHeight", { value: 100, writable: true });
    // 350 - 200 - 100 = 50 < threshold 100 → should fire

    const ref = { current: el };

    renderHook(() =>
      useScrollLoad(ref, true, false, fetchNextPage, 100),
    );

    el.dispatchEvent(new Event("scroll"));

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("does not fire when hasNextPage is false", () => {
    const fetchNextPage = vi.fn();
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollTop", { value: 200, writable: true });
    Object.defineProperty(el, "scrollHeight", { value: 350, writable: true });
    Object.defineProperty(el, "clientHeight", { value: 100, writable: true });

    const ref = { current: el };

    renderHook(() =>
      useScrollLoad(ref, false, false, fetchNextPage, 100),
    );

    el.dispatchEvent(new Event("scroll"));

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("does not fire when already fetching", () => {
    const fetchNextPage = vi.fn();
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollTop", { value: 200, writable: true });
    Object.defineProperty(el, "scrollHeight", { value: 350, writable: true });
    Object.defineProperty(el, "clientHeight", { value: 100, writable: true });

    const ref = { current: el };

    renderHook(() =>
      useScrollLoad(ref, true, true, fetchNextPage, 100),
    );

    el.dispatchEvent(new Event("scroll"));

    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
