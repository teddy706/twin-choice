import { beforeAll, describe, expect, it } from "vitest";
import { deriveChildAuthPassword, isPinLocked, isValidPin, PIN_MAX_ATTEMPTS } from "./childAuth";

beforeAll(() => {
  process.env.CHILD_AUTH_SECRET = "test-secret-for-vitest-only";
});

describe("isValidPin", () => {
  it("accepts exactly 4 digits", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("0000")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12ab")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });
});

describe("deriveChildAuthPassword", () => {
  it("is deterministic for the same profileId + pin", () => {
    const a = deriveChildAuthPassword("profile-1", "1234");
    const b = deriveChildAuthPassword("profile-1", "1234");
    expect(a).toBe(b);
  });

  it("differs across profiles and pins", () => {
    const base = deriveChildAuthPassword("profile-1", "1234");
    expect(deriveChildAuthPassword("profile-2", "1234")).not.toBe(base);
    expect(deriveChildAuthPassword("profile-1", "4321")).not.toBe(base);
  });

  it("throws if CHILD_AUTH_SECRET is missing", () => {
    const original = process.env.CHILD_AUTH_SECRET;
    delete process.env.CHILD_AUTH_SECRET;
    expect(() => deriveChildAuthPassword("profile-1", "1234")).toThrow();
    process.env.CHILD_AUTH_SECRET = original;
  });
});

describe("isPinLocked", () => {
  it("is not locked when there is no lock timestamp", () => {
    expect(isPinLocked(null)).toBe(false);
  });

  it("is locked when the timestamp is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isPinLocked(future)).toBe(true);
  });

  it("is not locked once the timestamp has passed", () => {
    const past = new Date(Date.now() - 1_000).toISOString();
    expect(isPinLocked(past)).toBe(false);
  });
});

describe("PIN_MAX_ATTEMPTS", () => {
  it("is a small positive number (brute-force protection, not a real gate)", () => {
    expect(PIN_MAX_ATTEMPTS).toBeGreaterThan(0);
    expect(PIN_MAX_ATTEMPTS).toBeLessThanOrEqual(10);
  });
});
