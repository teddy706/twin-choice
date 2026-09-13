import { describe, expect, it } from "vitest";
import { tileClassFor } from "./tilePalette";

describe("tileClassFor", () => {
  it("assigns tile-0 for index 0", () => {
    expect(tileClassFor(0)).toBe("tile-0");
  });

  it("cycles through 5 colors", () => {
    expect(tileClassFor(4)).toBe("tile-4");
    expect(tileClassFor(5)).toBe("tile-0");
    expect(tileClassFor(6)).toBe("tile-1");
  });

  it("works for large indexes (many custom categories/items)", () => {
    expect(tileClassFor(23)).toBe("tile-3");
  });
});
