import { describe, expect, it } from "vitest";
import { fetchAllPages, type Page } from "./fetchAllPages";

// A fake table of `size` rows that answers like PostgREST: inclusive range, rows capped at `maxRows`.
function fakeTable(size: number, options: { maxRows?: number; reportTotal?: boolean } = {}) {
  const { maxRows = Infinity, reportTotal = true } = options;
  const requests: Array<[number, number]> = [];

  const fetchPage = async (from: number, to: number): Promise<Page<number>> => {
    requests.push([from, to]);
    const end = Math.min(to, from + maxRows - 1, size - 1);
    const rows = from > end ? [] : Array.from({ length: end - from + 1 }, (_, index) => from + index);
    return { rows, total: reportTotal ? size : null };
  };

  return { fetchPage, requests };
}

describe("fetchAllPages", () => {
  it("makes one request when everything fits in a page", async () => {
    const { fetchPage, requests } = fakeTable(123);

    const rows = await fetchAllPages(fetchPage, 1000);

    expect(rows).toHaveLength(123);
    expect(requests).toEqual([[0, 999]]);
  });

  it("keeps asking until every row has arrived, in order and without repeats", async () => {
    const { fetchPage, requests } = fakeTable(2500);

    const rows = await fetchAllPages(fetchPage, 1000);

    expect(rows).toEqual(Array.from({ length: 2500 }, (_, index) => index));
    expect(requests).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("reads to the end when the server caps a page below the page size", async () => {
    const { fetchPage } = fakeTable(250, { maxRows: 100 });

    const rows = await fetchAllPages(fetchPage, 1000);

    expect(rows).toHaveLength(250);
  });

  it("handles a table that is an exact multiple of the page size without an extra request", async () => {
    const { fetchPage, requests } = fakeTable(2000);

    const rows = await fetchAllPages(fetchPage, 1000);

    expect(rows).toHaveLength(2000);
    expect(requests).toHaveLength(2);
  });

  it("returns nothing for an empty table", async () => {
    const { fetchPage } = fakeTable(0);

    expect(await fetchAllPages(fetchPage, 1000)).toEqual([]);
  });

  describe("when the server reports no total", () => {
    it("stops at the first page that is shorter than asked for", async () => {
      const { fetchPage, requests } = fakeTable(1500, { reportTotal: false });

      const rows = await fetchAllPages(fetchPage, 1000);

      expect(rows).toHaveLength(1500);
      expect(requests).toHaveLength(2);
    });

    it("stops at an empty page", async () => {
      const { fetchPage } = fakeTable(2000, { reportTotal: false });

      expect(await fetchAllPages(fetchPage, 1000)).toHaveLength(2000);
    });
  });

  it("does not loop forever when the reported total is larger than the table", async () => {
    const fetchPage = async (from: number): Promise<Page<number>> => ({
      rows: from < 3 ? [from] : [],
      total: 50,
    });

    expect(await fetchAllPages(fetchPage, 1)).toEqual([0, 1, 2]);
  });

  it("passes a failed request on to the caller", async () => {
    const fetchPage = async (): Promise<Page<number>> => {
      throw new Error("boom");
    };

    await expect(fetchAllPages(fetchPage, 1000)).rejects.toThrow("boom");
  });
});
