import { Expense, ExpenseSplit, TripMember } from "@/lib/types";

export interface LedgerMember extends TripMember {
  historical?: boolean;
}

export interface SettlementRecommendation {
  fromId: string;
  from: string;
  toId: string;
  to: string;
  amount: number;
}

export interface ExpenseLedger {
  members: LedgerMember[];
  paid: Record<string, number>;
  owed: Record<string, number>;
  net: Record<string, number>;
  settlements: SettlementRecommendation[];
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildExpenseLedger(
  expenses: Expense[],
  currentMembers: TripMember[]
): ExpenseLedger {
  const memberMap = new Map<string, LedgerMember>();

  // Current members
  currentMembers.forEach(member => {
    memberMap.set(member.id, {
      ...member,
      historical: false,
    });
  });

  // Recover historical members
  expenses.forEach(expense => {
    if (
      expense.payerId &&
      expense.payerName &&
      !memberMap.has(expense.payerId)
    ) {
      memberMap.set(expense.payerId, {
        id: expense.payerId,
        name: expense.payerName,
        color: "#9ca3af",
        historical: true,
      } as LedgerMember);
    }

    expense.split?.forEach((split: ExpenseSplit) => {
      if (
        split.memberId &&
        split.memberName &&
        !memberMap.has(split.memberId)
      ) {
        memberMap.set(split.memberId, {
          id: split.memberId,
          name: split.memberName,
          color: "#9ca3af",
          historical: true,
        } as LedgerMember);
      }
    });
  });

  const members = [...memberMap.values()];

  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};
  const net: Record<string, number> = {};

  members.forEach(member => {
    paid[member.id] = 0;
    owed[member.id] = 0;
    net[member.id] = 0;
  });

  const orderedExpenses = [...expenses].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();

    if (da !== db) return da - db;

    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  // -----------------------------------------------------------------------------
// Pass 1: replay only expense entries
// -----------------------------------------------------------------------------
orderedExpenses
  .filter(expense => expense.category !== "settlement")
  .forEach(expense => {
    const payerId = expense.payerId;

    if (!payerId) return;

    // Only shared expenses affect participant balances.
    if (!expense.split || expense.split.length < 2) {
      return;
    }

    paid[payerId] += expense.amount;

    expense.split.forEach(split => {
      owed[split.memberId] += split.amount;
    });
  });

// Initial balances
members.forEach(member => {
  net[member.id] = round2(
    paid[member.id] - owed[member.id]
  );
});

// -----------------------------------------------------------------------------
// Pass 2: replay settlements as transfers
// -----------------------------------------------------------------------------
orderedExpenses
  .filter(expense => expense.category === "settlement")
  .forEach(expense => {
    const payerId = expense.payerId;
    const receiver = expense.split?.[0];

    if (!payerId || !receiver) return;

    // Settlement transfers money from the debtor to the creditor.
// The debtor's balance increases towards zero.
// The creditor's balance decreases towards zero.

net[payerId] = round2(
  net[payerId] + expense.amount
);

net[receiver.memberId] = round2(
  net[receiver.memberId] - expense.amount
);
  });

  
  const creditors = members
    .filter(member => net[member.id] > 0.01)
    .map(member => ({
      id: member.id,
      name: member.name,
      amount: net[member.id],
    }));

  const debtors = members
    .filter(member => net[member.id] < -0.01)
    .map(member => ({
      id: member.id,
      name: member.name,
      amount: Math.abs(net[member.id]),
    }));

  const settlements: SettlementRecommendation[] = [];

  let c = 0;
  let d = 0;

  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(
      creditors[c].amount,
      debtors[d].amount
    );

    settlements.push({
      fromId: debtors[d].id,
      from: debtors[d].name,
      toId: creditors[c].id,
      to: creditors[c].name,
      amount: round2(amount),
    });

    creditors[c].amount = round2(
      creditors[c].amount - amount
    );

    debtors[d].amount = round2(
      debtors[d].amount - amount
    );

    if (Math.abs(creditors[c].amount) < 0.01) c++;
if (Math.abs(debtors[d].amount) < 0.01) d++;
  }

  return {
    members,
    paid,
    owed,
    net,
    settlements,
  };
}