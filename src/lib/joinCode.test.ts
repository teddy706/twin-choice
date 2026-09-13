import { describe, expect, it } from "vitest";
import { generateJoinCode } from "./joinCode";

describe("generateJoinCode", () => {
  it("generates a 6-character code by default", () => {
    expect(generateJoinCode()).toHaveLength(6);
  });

  it("respects a custom length", () => {
    expect(generateJoinCode(10)).toHaveLength(10);
  });

  it("only uses characters from the confusion-free alphabet (no 0/O/1/I/L)", () => {
    const code = generateJoinCode(200);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
  });

  it("is not deterministic (uses random bytes)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
