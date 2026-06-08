import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@/utils/test-utils";
import { useLoadAll } from "./useLoadAll";

describe("useLoadAll", () => {
  it("returns loading=false initially", () => {
    const { result } = renderHook(() => useLoadAll(vi.fn()));
    const [loading] = result.current;
    expect(loading).toBe(false);
  });

  it("calls fetchNextPage repeatedly until all items loaded", async () => {
    const fetchNextPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          pages: [
            { items: new Array(50), total: 120 },
            { items: new Array(50), total: 120 },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          pages: [
            { items: new Array(50), total: 120 },
            { items: new Array(50), total: 120 },
            { items: new Array(20), total: 120 }, // 50+50+20 = 120 = total
          ],
        },
      });

    const { result } = renderHook(() => useLoadAll(fetchNextPage));

    act(() => {
      result.current[1]();
    });

    await waitFor(() => expect(result.current[0]).toBe(false));
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it("sets loading=true while fetching", async () => {
    let resolve: (v: unknown) => void;
    const fetchNextPage = vi.fn().mockImplementation(
      () => new Promise((r) => { resolve = r; }),
    );

    const { result } = renderHook(() => useLoadAll(fetchNextPage));

    act(() => {
      result.current[1]();
    });

    expect(result.current[0]).toBe(true);

    // Clean up
    act(() => {
      resolve!({ data: { pages: [{ items: [], total: 0 }] } });
    });

    await waitFor(() => expect(result.current[0]).toBe(false));
  });

  it("handles empty pages gracefully", async () => {
    const fetchNextPage = vi.fn().mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useLoadAll(fetchNextPage));

    act(() => {
      result.current[1]();
    });

    await waitFor(() => expect(result.current[0]).toBe(false));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
