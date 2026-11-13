// Tests the time maths used by the notify-next edge function
// (supabase/functions/notify-next/time.ts). That file has no Deno imports,
// so it runs here unchanged.
import { describe, expect, it } from "vitest";
import {
  cleanPlaceName,
  fireInstant,
  leadFor,
  localToInstant,
  zoneCandidates,
} from "../../../../supabase/functions/notify-next/time";

const iso = (d: Date | null) => d?.toISOString();

describe("localToInstant", () => {
  it("reads a clock time in the place's own zone", () => {
    expect(iso(localToInstant("2026-11-20", "09:00", "Asia/Singapore"))).toBe("2026-11-20T01:00:00.000Z");
    expect(iso(localToInstant("2026-11-20", "09:00", "Asia/Kolkata"))).toBe("2026-11-20T03:30:00.000Z");
    expect(iso(localToInstant("2026-11-20", "09:00", "America/Los_Angeles"))).toBe("2026-11-20T17:00:00.000Z");
  });

  it("the same clock time in two zones is two different moments", () => {
    const sg = localToInstant("2026-11-20", "09:00", "Asia/Singapore")!;
    const india = localToInstant("2026-11-20", "09:00", "Asia/Kolkata")!;
    expect(india.getTime() - sg.getTime()).toBe(2.5 * 60 * 60 * 1000);
  });

  it("handles a time just after midnight that is still the day before in UTC", () => {
    expect(iso(localToInstant("2026-11-21", "00:30", "Asia/Tokyo"))).toBe("2026-11-20T15:30:00.000Z");
  });

  it("accepts times stored with seconds", () => {
    expect(iso(localToInstant("2026-11-20", "09:00:00", "Asia/Singapore"))).toBe("2026-11-20T01:00:00.000Z");
  });

  it("is correct on both sides of a daylight-saving change (London, clocks go forward 29 Mar 2026)", () => {
    expect(iso(localToInstant("2026-03-28", "09:00", "Europe/London"))).toBe("2026-03-28T09:00:00.000Z");
    expect(iso(localToInstant("2026-03-29", "00:30", "Europe/London"))).toBe("2026-03-29T00:30:00.000Z");
    expect(iso(localToInstant("2026-03-29", "09:00", "Europe/London"))).toBe("2026-03-29T08:00:00.000Z");
  });

  it("is correct on both sides of clocks going back (New York, 1 Nov 2026)", () => {
    expect(iso(localToInstant("2026-10-31", "09:00", "America/New_York"))).toBe("2026-10-31T13:00:00.000Z");
    expect(iso(localToInstant("2026-11-01", "09:00", "America/New_York"))).toBe("2026-11-01T14:00:00.000Z");
  });

  it("returns null when there is no usable date or time", () => {
    expect(localToInstant("2026-11-20", "", "Asia/Kolkata")).toBeNull();
    expect(localToInstant("2026-11-20", null, "Asia/Kolkata")).toBeNull();
    expect(localToInstant("", "09:00", "Asia/Kolkata")).toBeNull();
    expect(localToInstant("Day 2", "09:00", "Asia/Kolkata")).toBeNull();
  });
});

describe("reminder timing", () => {
  const flight = { element_type: "travel", travel_type: "flight", date: "2026-11-20", start_time: "09:00" };

  it("keeps the lead times: 2 hours for flights and trains, 15 minutes for the rest", () => {
    expect(leadFor(flight)).toBe(120);
    expect(leadFor({ ...flight, travel_type: "train" })).toBe(120);
    expect(leadFor({ ...flight, travel_type: "bus" })).toBe(15);
    expect(leadFor({ ...flight, travel_type: "car" })).toBe(15);
    expect(leadFor({ element_type: "meal", date: "2026-11-20" })).toBe(15);
    expect(leadFor({ element_type: "activity", date: "2026-11-20" })).toBe(15);
    expect(leadFor({ element_type: "accommodation", date: "2026-11-20" })).toBe(15);
  });

  it("a 9:00 AM flight out of Singapore fires at 7:00 AM Singapore time", () => {
    expect(iso(fireInstant(flight, "Asia/Singapore"))).toBe("2026-11-19T23:00:00.000Z");
  });

  it("a reminder can fall on the day before when the item is just after midnight", () => {
    const redEye = { ...flight, start_time: "01:15" };
    // 1:15 AM on the 20th in Singapore, minus 2 hours = 11:15 PM on the 19th there.
    expect(iso(fireInstant(redEye, "Asia/Singapore"))).toBe("2026-11-19T15:15:00.000Z");
  });

  it("two items at the same clock time in different zones fire at different moments", () => {
    const dinner = { element_type: "meal", date: "2026-11-20", start_time: "20:00" };
    expect(iso(fireInstant(dinner, "Asia/Kolkata"))).toBe("2026-11-20T14:15:00.000Z");
    expect(iso(fireInstant(dinner, "Asia/Singapore"))).toBe("2026-11-20T11:45:00.000Z");
  });

  it("an item with no time never fires", () => {
    expect(fireInstant({ ...flight, start_time: "" }, "Asia/Singapore")).toBeNull();
  });
});

describe("which place decides the zone", () => {
  const trip = {
    day_cities: { "2026-11-19": "Singapore", "2026-11-20": "Bali", "2026-11-21": "Bali" },
    state: "",
    destination: "Indonesia",
  };

  it("strips airport codes in brackets", () => {
    expect(cleanPlaceName("Delhi (DEL)")).toBe("Delhi");
    expect(cleanPlaceName("  Ho Chi Minh City  (SGN) ")).toBe("Ho Chi Minh City");
    expect(cleanPlaceName("DEL")).toBe("DEL");
    expect(cleanPlaceName(null)).toBe("");
  });

  it("travel uses where it leaves from, then where you woke up, then the day's city", () => {
    const flight = { element_type: "travel", travel_type: "flight", date: "2026-11-20", from_location: "Singapore (SIN)" };
    expect(zoneCandidates(flight, trip)).toEqual(["Singapore", "Bali", "Indonesia"]);

    const noFrom = { ...flight, from_location: "" };
    expect(zoneCandidates(noFrom, trip)).toEqual(["Singapore", "Bali", "Indonesia"]);
  });

  it("everything else uses the day's city", () => {
    const dinner = { element_type: "meal", date: "2026-11-20", from_location: "ignored" };
    expect(zoneCandidates(dinner, trip)).toEqual(["Bali", "Indonesia"]);
  });

  it("falls back to the trip's state and destination when the day has no city", () => {
    const activity = { element_type: "activity", date: "2026-11-25" };
    expect(zoneCandidates(activity, { day_cities: {}, state: "Goa", destination: "India" })).toEqual(["Goa", "India"]);
    expect(zoneCandidates(activity, {})).toEqual([]);
  });
});
