const PAGE_SIZE = 1000;

/**
 * Supabase returns at most 1,000 rows per request and cuts off silently, so any
 * query that could grow past that (all weigh-ins, all sets) is read page by page.
 * `fetchPage` must build a fresh, stably-ordered query for the given row range.
 */
export async function fetchAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows = 20000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}
