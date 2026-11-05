// The page is ordered by immutable, unique id; deleting older rows cannot shift it.
export async function readAll<T extends { id: string }>(page: (after?: string) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  for (;;) {
    const { data, error } = await page(after);
    if (error) throw error;
    if (!data) throw new Error('Empty API response');
    if (!data.length) return rows;
    const next = data[data.length - 1].id;
    if (after !== undefined && next <= after) throw new Error('Pagination cursor did not advance');
    rows.push(...data);
    after = next;
  }
}
