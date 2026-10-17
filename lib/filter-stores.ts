/** Case-insensitive substring filter on name or address; order preserved. */
export function filterStores<T extends { name: string; address: string | null }>(stores: T[], q: string): T[] {
  const needle = q.trim().toLocaleLowerCase("uk");
  if (needle === "") return stores;
  return stores.filter(
    (s) =>
      s.name.toLocaleLowerCase("uk").includes(needle) ||
      (s.address ?? "").toLocaleLowerCase("uk").includes(needle),
  );
}
