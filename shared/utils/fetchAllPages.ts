/*
 * Reads a whole table through a paged API.
 *
 * Supabase (PostgREST) answers at most `max_rows` rows per request (1000 by default) and does so silently, so a
 * single query would cut a long list off without any error. This asks page by page until every row has arrived.
 * The total comes with each page (PostgREST's exact count), so a server that caps pages below `pageSize` is
 * still read to the end instead of being mistaken for "the last page".
 */

export interface Page<T> {
  rows: T[];
  // The number of rows in the whole table, or null when the server did not say.
  total: number | null;
}

// `from` and `to` are inclusive row positions, as in Supabase's .range(from, to). A failed request must throw.
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<Page<T>>,
  pageSize: number,
): Promise<T[]> {
  const rows: T[] = [];

  for (;;) {
    const page = await fetchPage(rows.length, rows.length + pageSize - 1);
    rows.push(...page.rows);

    // An empty page ends the loop whatever the total says, so a wrong count cannot loop forever.
    if (page.rows.length === 0 || (page.total !== null && rows.length >= page.total)) {
      return rows;
    }
    // Without a total, a page shorter than asked for is the last one.
    if (page.total === null && page.rows.length < pageSize) {
      return rows;
    }
  }
}
