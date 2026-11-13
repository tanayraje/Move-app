import { describe, expect, it } from "vitest";
import { buildExpenseLedger, splitEqually } from "./expense-ledger";
import { convertFromINR, RATES_PER_INR } from "./countries";
import type { Expense, TripMember } from "./types";

const members: TripMember[] = [
  { id: "a", name: "Asha" },
  { id: "b", name: "Bela" },
  { id: "c", name: "Chirag" },
];

let n = 0;
function expense(partial: Partial<Expense>): Expense {
  n += 1;
  return {
    id: `e${n}`,
    tripId: "t",
    title: "Expense",
    amount: 0,
    category: "food",
    date: "2026-11-01",
    createdAt: n,
    ...partial,
  };
}

function shared(amount: number, payerId: string, ids: string[], date = "2026-11-01"): Expense {
  return expense({ amount, payerId, date, split: splitEqually(amount, ids) });
}

const sum = (values: number[]) => Math.round(values.reduce((s, v) => s + v, 0) * 100) / 100;

describe("splitEqually", () => {
  it("shares always add up to exactly the amount", () => {
    for (const amount of [100, 0.01, 99.99, 1000, 2499.5, 1, 7]) {
      for (const people of [1, 2, 3, 4, 7]) {
        const ids = Array.from({ length: people }, (_, i) => `m${i}`);
        expect(sum(splitEqually(amount, ids).map(s => s.amount))).toBe(amount);
      }
    }
  });

  it("gives the leftover paise to the first people, one each", () => {
    expect(splitEqually(100, ["a", "b", "c"]).map(s => s.amount)).toEqual([33.34, 33.33, 33.33]);
    expect(splitEqually(0.05, ["a", "b", "c"]).map(s => s.amount)).toEqual([0.02, 0.02, 0.01]);
  });

  it("returns nothing when nobody is selected", () => {
    expect(splitEqually(100, [])).toEqual([]);
  });
});

describe("buildExpenseLedger", () => {
  it("balances an even split and recommends who pays whom", () => {
    const ledger = buildExpenseLedger([shared(300, "a", ["a", "b", "c"])], members);
    expect(ledger.net).toEqual({ a: 200, b: -100, c: -100 });
    expect(ledger.paid.a).toBe(300);
    expect(ledger.settlements).toEqual([
      { fromId: "b", from: "Bela", toId: "a", to: "Asha", amount: 100 },
      { fromId: "c", from: "Chirag", toId: "a", to: "Asha", amount: 100 },
    ]);
  });

  it("handles uneven splits", () => {
    const ledger = buildExpenseLedger(
      [
        expense({
          amount: 1000,
          payerId: "b",
          split: [
            { memberId: "a", amount: 700 },
            { memberId: "b", amount: 250 },
            { memberId: "c", amount: 50 },
          ],
        }),
      ],
      members,
    );
    expect(ledger.net).toEqual({ a: -700, b: 750, c: -50 });
    expect(sum(Object.values(ledger.net))).toBe(0);
  });

  it("balances sum to zero when amounts do not divide evenly", () => {
    const ledger = buildExpenseLedger(
      [
        shared(100, "a", ["a", "b", "c"]),
        shared(99.99, "b", ["a", "b", "c"]),
        shared(0.05, "c", ["a", "b", "c"]),
        shared(2499.5, "a", ["a", "c"]),
      ],
      members,
    );
    expect(sum(Object.values(ledger.net))).toBe(0);
    // Everything the settlements move equals everything that is owed.
    const owedTotal = sum(Object.values(ledger.net).filter(v => v < 0).map(v => -v));
    expect(sum(ledger.settlements.map(s => s.amount))).toBe(owedTotal);
  });

  it("counts a personal expense as paid but not as owed by anyone", () => {
    const ledger = buildExpenseLedger([expense({ amount: 500, payerId: "a" })], members);
    expect(ledger.paid.a).toBe(500);
    expect(ledger.net).toEqual({ a: 0, b: 0, c: 0 });
    expect(ledger.settlements).toEqual([]);
  });

  it("a settlement moves both people towards zero", () => {
    const spend = shared(300, "a", ["a", "b", "c"]);
    const settle = expense({
      amount: 100,
      payerId: "b",
      category: "settlement",
      date: "2026-11-02",
      split: [{ memberId: "a", amount: 100 }],
    });
    const ledger = buildExpenseLedger([spend, settle], members);
    expect(ledger.net).toEqual({ a: 100, b: 0, c: -100 });
    expect(ledger.settlements).toEqual([{ fromId: "c", from: "Chirag", toId: "a", to: "Asha", amount: 100 }]);
  });

  it("once everyone has settled, every balance is zero and nothing is recommended", () => {
    const spends = [shared(100, "a", ["a", "b", "c"]), shared(250, "b", ["a", "b"]), shared(60.1, "c", ["b", "c"])];
    const first = buildExpenseLedger(spends, members);
    const settles = first.settlements.map(s =>
      expense({
        amount: s.amount,
        payerId: s.fromId,
        category: "settlement",
        date: "2026-11-03",
        split: [{ memberId: s.toId, amount: s.amount }],
      }),
    );
    const after = buildExpenseLedger([...spends, ...settles], members);
    expect(Object.values(after.net).every(v => Math.abs(v) < 0.005)).toBe(true);
    expect(after.settlements).toEqual([]);
  });

  it("settlements are not counted as spending", () => {
    const settle = expense({ amount: 100, payerId: "b", category: "settlement", split: [{ memberId: "a", amount: 100 }] });
    expect(buildExpenseLedger([settle], members).paid.b).toBe(0);
  });

  it("keeps people who left the trip, using the name saved on the expense", () => {
    const old = expense({
      amount: 200,
      payerId: "z",
      payerName: "Zoya",
      split: [
        { memberId: "z", memberName: "Zoya", amount: 100 },
        { memberId: "a", memberName: "Asha", amount: 100 },
      ],
    });
    const ledger = buildExpenseLedger([old], members);
    const zoya = ledger.members.find(m => m.id === "z");
    expect(zoya).toMatchObject({ name: "Zoya", historical: true });
    expect(ledger.net.z).toBe(100);
    expect(ledger.net.a).toBe(-100);
  });

  it("does not depend on the order expenses arrive in", () => {
    const list = [
      shared(120, "a", ["a", "b"], "2026-11-03"),
      shared(75.5, "b", ["a", "b", "c"], "2026-11-01"),
      shared(33.33, "c", ["a", "c"], "2026-11-02"),
    ];
    expect(buildExpenseLedger(list, members).net).toEqual(buildExpenseLedger([...list].reverse(), members).net);
  });
});

describe("currency conversion", () => {
  it("leaves rupees alone and unknown currencies unchanged", () => {
    expect(convertFromINR(1234.5, "INR")).toBe(1234.5);
    expect(convertFromINR(100, "NOT_A_CURRENCY")).toBe(100);
  });

  it("converting out and back returns the same amount for every currency", () => {
    for (const [code, rate] of Object.entries(RATES_PER_INR)) {
      expect(rate).toBeGreaterThan(0);
      expect(convertFromINR(1000, code) / rate).toBeCloseTo(1000, 6);
    }
  });
});
