import { describe, expect, it } from "vitest";
import { computeConcessionStats, type ResolutionRow } from "./concessionStats";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function resolution(overrides: Partial<ResolutionRow>): ResolutionRow {
  return {
    id: "r1",
    type: "roulette",
    conceded_profile_id: null,
    resolved_at: daysAgo(0),
    ...overrides,
  };
}

describe("computeConcessionStats", () => {
  it("returns zeroed stats with 8 empty weekly buckets for no data", () => {
    const stats = computeConcessionStats([]);
    expect(stats.totalResolvedRounds).toBe(0);
    expect(stats.totalConcededRounds).toBe(0);
    expect(stats.concedeCountByChild).toEqual({});
    expect(stats.weekly).toHaveLength(8);
    for (const bucket of stats.weekly) {
      expect(bucket.countByChild).toEqual({});
    }
  });

  it("counts every row toward totalResolvedRounds, only conceded ones toward totalConcededRounds", () => {
    const rows = [
      resolution({ id: "1", type: "match", conceded_profile_id: null }),
      resolution({ id: "2", type: "manual", conceded_profile_id: "child-a" }),
      resolution({ id: "3", type: "turn", conceded_profile_id: "child-b" }),
    ];
    const stats = computeConcessionStats(rows);
    expect(stats.totalResolvedRounds).toBe(3);
    expect(stats.totalConcededRounds).toBe(2);
    expect(stats.concedeCountByChild).toEqual({ "child-a": 1, "child-b": 1 });
  });

  it("buckets concessions into the current week", () => {
    const rows = [
      resolution({ id: "1", conceded_profile_id: "child-a", resolved_at: daysAgo(0) }),
      resolution({ id: "2", conceded_profile_id: "child-a", resolved_at: daysAgo(1) }),
    ];
    const stats = computeConcessionStats(rows);
    const currentWeek = stats.weekly[stats.weekly.length - 1];
    expect(currentWeek.countByChild["child-a"]).toBe(2);
  });

  it("excludes concessions older than the requested window from weekly buckets but keeps them in totals", () => {
    const rows = [resolution({ id: "1", conceded_profile_id: "child-a", resolved_at: daysAgo(100) })];
    const stats = computeConcessionStats(rows, 8);
    expect(stats.totalConcededRounds).toBe(1);
    expect(stats.concedeCountByChild).toEqual({ "child-a": 1 });
    const totalBucketed = stats.weekly.reduce(
      (sum, bucket) => sum + Object.values(bucket.countByChild).reduce((a, b) => a + b, 0),
      0,
    );
    expect(totalBucketed).toBe(0);
  });

  it("respects a custom weeks window", () => {
    const stats = computeConcessionStats([], 4);
    expect(stats.weekly).toHaveLength(4);
  });
});
