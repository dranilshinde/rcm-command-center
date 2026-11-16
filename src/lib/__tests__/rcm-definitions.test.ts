import { describe, expect, it } from "vitest";
import { ageingBucket, ageingLabel, outstandingAmount } from "../rcm-definitions";
import { computeReadiness, readinessBand } from "../claims-domain";

describe("outstanding amount", () => {
  it("is approved minus settled minus TDS", () => {
    expect(outstandingAmount({ approved_amount: 100000, settled_amount: 60000, tds_amount: 10000 })).toBe(30000);
  });
  it("never goes below zero", () => {
    expect(outstandingAmount({ approved_amount: 50000, settled_amount: 50000, tds_amount: 5000 })).toBe(0);
  });
});

describe("ageing buckets", () => {
  it("uses 0-30, 31-60, 61-90, 91-180, 180+", () => {
    expect([0, 30, 31, 60, 61, 90, 91, 180, 181, 900].map(ageingBucket)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(ageingLabel(4)).toBe("180+");
  });
});

describe("readiness", () => {
  const full = { policy_number: "P1", member_id: "M1", ip_number: "IP1", discharge_date: "2026-11-01", diagnosis: "D", treatment: "T", has_payer: true, claimed_amount: 1000 };
  it("reaches 100 before submission when every field is filled", () => {
    expect(computeReadiness(full).score).toBe(100);
  });
  it("bands 90+ READY, 75-89 REVIEW, under 75 NOT READY", () => {
    expect(readinessBand(90).label).toBe("READY");
    expect(readinessBand(75).label).toBe("REVIEW");
    expect(readinessBand(74).label).toBe("NOT READY");
  });
});
