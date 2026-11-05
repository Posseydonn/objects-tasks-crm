// Date.parse alone discards PostgreSQL's microseconds.
export function oldest(a: {created_at: string; id: string}, b: {created_at: string; id: string}) {
  const remainder = (value: string) => (value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(3, 6);
  return Date.parse(a.created_at) - Date.parse(b.created_at)
    || remainder(a.created_at).localeCompare(remainder(b.created_at))
    || a.id.localeCompare(b.id);
}
