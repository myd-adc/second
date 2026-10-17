import { describe, expect, it } from "vitest";
import { filterStores } from "./filter-stores";

const stores = [
  { name: "Секонд Центр", address: "вул. Шевченка, 1" },
  { name: "Ласка", address: null },
  { name: "Бук", address: "Проспект Перемоги" },
];

describe("filterStores", () => {
  it("empty or blank query returns all in order", () => {
    expect(filterStores(stores, "")).toEqual(stores);
    expect(filterStores(stores, "   ")).toEqual(stores);
  });
  it("matches name case-insensitively (Cyrillic)", () => {
    expect(filterStores(stores, "ЛАСК")).toEqual([stores[1]]);
  });
  it("matches address, handles null address", () => {
    expect(filterStores(stores, "перемоги")).toEqual([stores[2]]);
    expect(filterStores(stores, "null")).toEqual([]);
  });
  it("trims query and preserves order", () => {
    expect(filterStores(stores, " ц ")).toEqual([stores[0]]);
    expect(filterStores(stores, "к")).toEqual([stores[0], stores[1], stores[2]].filter((s) => (s.name + (s.address ?? "")).toLocaleLowerCase("uk").includes("к")));
  });
});
