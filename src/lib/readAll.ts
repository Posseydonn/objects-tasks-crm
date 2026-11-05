// Advance by the actual returned size: the server may cap a requested range.
export async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + 499);
    if (error) throw error;
    if (!data) throw new Error('Empty API response');
    if (!data.length) return rows;
    rows.push(...data);
  }
}
