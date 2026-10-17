import { describe, expect, it } from "vitest";
import { formatCoordinates, parseCoordinates } from "./coordinates";

describe("parseCoordinates", () => {
  it("empty or blank text means no coordinates", () => {
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates("   ")).toBeNull();
  });
  it("a pasted Google Maps pair", () => {
    expect(parseCoordinates("50.4501, 30.5234")).toEqual({ lat: 50.4501, lng: 30.5234 });
  });
  it("tolerates extra spaces, no space and whitespace-only separator", () => {
    expect(parseCoordinates("  50.4501 ,   30.5234  ")).toEqual({ lat: 50.4501, lng: 30.5234 });
    expect(parseCoordinates("50.4501,30.5234")).toEqual({ lat: 50.4501, lng: 30.5234 });
    expect(parseCoordinates("50.4501 30.5234")).toEqual({ lat: 50.4501, lng: 30.5234 });
  });
  it("negative values and integers", () => {
    expect(parseCoordinates("-33.8688, 151.2093")).toEqual({ lat: -33.8688, lng: 151.2093 });
    expect(parseCoordinates("-12, -77")).toEqual({ lat: -12, lng: -77 });
  });
  it("boundaries are valid, out of range is invalid", () => {
    expect(parseCoordinates("90, 180")).toEqual({ lat: 90, lng: 180 });
    expect(parseCoordinates("-90, -180")).toEqual({ lat: -90, lng: -180 });
    expect(parseCoordinates("90.1, 30")).toBe("invalid");
    expect(parseCoordinates("50, 180.5")).toBe("invalid");
    expect(parseCoordinates("-91, 30")).toBe("invalid");
  });
  it("one number, three numbers, garbage and comma decimals are invalid", () => {
    expect(parseCoordinates("50.4501")).toBe("invalid");
    expect(parseCoordinates("50.4501, 30.5234, 12")).toBe("invalid");
    expect(parseCoordinates("abc, def")).toBe("invalid");
    expect(parseCoordinates("50,4501, 30,5234")).toBe("invalid");
    expect(parseCoordinates("50.4501,, 30.5234")).toBe("invalid");
  });
});

describe("formatCoordinates", () => {
  it("round-trips through parseCoordinates; null pair is empty text", () => {
    expect(formatCoordinates(50.4501, 30.5234)).toBe("50.4501, 30.5234");
    expect(parseCoordinates(formatCoordinates(-0.5, 12))).toEqual({ lat: -0.5, lng: 12 });
    expect(formatCoordinates(null, null)).toBe("");
  });
});
