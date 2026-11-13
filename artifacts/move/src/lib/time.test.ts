import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTime12, joinTime, splitTime } from "./time";
import { getDayNumber, getTripStatus, isDateBeforeToday, isDayLabel, safeFormatDate, safeParseDate } from "./utils";
import type { Trip } from "./types";

describe("12-hour time", () => {
  it("shows midnight and noon correctly", () => {
    expect(formatTime12("00:00")).toBe("12:00 AM");
    expect(formatTime12("00:05")).toBe("12:05 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
    expect(formatTime12("12:30")).toBe("12:30 PM");
  });

  it("shows ordinary times", () => {
    expect(formatTime12("09:00")).toBe("9:00 AM");
    expect(formatTime12("14:05")).toBe("2:05 PM");
    expect(formatTime12("23:59")).toBe("11:59 PM");
    expect(formatTime12("14:05:00")).toBe("2:05 PM");
  });

  it("uses the fallback for empty or impossible times", () => {
    expect(formatTime12("", "Any time")).toBe("Any time");
    expect(formatTime12(null)).toBe("");
    expect(formatTime12("25:00", "x")).toBe("x");
    expect(formatTime12("10:75", "x")).toBe("x");
    expect(splitTime("lunch")).toBeNull();
  });

  it("joinTime is the exact reverse of splitTime for every minute of the day", () => {
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 1, 30, 59]) {
        const stored = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const parts = splitTime(stored)!;
        expect(joinTime(parts.hour, parts.minute, parts.period)).toBe(stored);
      }
    }
  });

  it("stores 12 AM as 00 and 12 PM as 12", () => {
    expect(joinTime(12, 0, "AM")).toBe("00:00");
    expect(joinTime(12, 0, "PM")).toBe("12:00");
    expect(joinTime(1, 5, "PM")).toBe("13:05");
  });
});

describe("dates", () => {
  it("reads a plain date as that calendar day, whatever the time zone", () => {
    const d = safeParseDate("2026-11-04")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 4]);
  });

  it("reads the date part of a full timestamp", () => {
    const d = safeParseDate("2026-01-31T23:30:00Z")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 0, 31]);
  });

  it("returns null for anything that is not a date", () => {
    expect(safeParseDate("")).toBeNull();
    expect(safeParseDate(null)).toBeNull();
    expect(safeParseDate(undefined)).toBeNull();
    expect(safeParseDate("Day 2")).toBeNull();
  });

  it("safeFormatDate falls back instead of throwing", () => {
    expect(safeFormatDate("nonsense", () => "formatted", "none")).toBe("none");
    expect(safeFormatDate("2026-11-04", () => { throw new Error("x"); }, "none")).toBe("none");
    expect(safeFormatDate("2026-11-04", d => String(d.getDate()))).toBe("4");
  });

  it("recognises wishlist day labels", () => {
    expect(isDayLabel("Day 3")).toBe(true);
    expect(isDayLabel("day 12")).toBe(true);
    expect(isDayLabel("2026-11-04")).toBe(false);
    expect(getDayNumber("Day 12")).toBe(12);
    expect(getDayNumber("Friday")).toBeNull();
  });

  describe("isDateBeforeToday", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 13, 9, 0, 0));
    });
    afterEach(() => vi.useRealTimers());

    it("is true only for days before today", () => {
      expect(isDateBeforeToday("2026-11-12")).toBe(true);
      expect(isDateBeforeToday("2026-11-13")).toBe(false);
      expect(isDateBeforeToday("2026-11-14")).toBe(false);
    });

    it("handles month and year edges", () => {
      expect(isDateBeforeToday("2026-10-31")).toBe(true);
      expect(isDateBeforeToday("2025-12-31")).toBe(true);
      expect(isDateBeforeToday("2027-01-01")).toBe(false);
    });

    it("is false for a missing date", () => {
      expect(isDateBeforeToday("")).toBe(false);
      expect(isDateBeforeToday(undefined)).toBe(false);
    });
  });
});

describe("trip status", () => {
  const base: Trip = {
    id: "t",
    name: "Trip",
    destination: "Vietnam",
    destinationCurrency: "VND",
    startDate: "2026-12-01",
    endDate: "2026-12-10",
    createdAt: 0,
  };

  it("uses the saved status when there is one", () => {
    expect(getTripStatus({ ...base, status: "wishlist" })).toBe("wishlist");
    expect(getTripStatus({ ...base, status: "archived" })).toBe("archived");
    expect(getTripStatus({ ...base, status: "active", archived: true })).toBe("active");
  });

  it("falls back to the old archived flag", () => {
    expect(getTripStatus({ ...base, archived: true })).toBe("archived");
    expect(getTripStatus(base)).toBe("active");
  });
});
