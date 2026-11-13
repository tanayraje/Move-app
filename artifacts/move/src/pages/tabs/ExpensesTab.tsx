import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Plus,
  CreditCard,
  Target,
  ArrowLeftRight,
  Download,
  Check,
  Pencil,
  Search,
  X,
  ArrowRight,
} from "lucide-react";
import { useExpenses, useSaveExpense, useUpdateTrip } from "@/hooks/use-store";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Trip, Expense, ExpenseCategory, TripBudget, ExpenseSplit } from "@/lib/types";
import { generateId, cn, safeFormatDate, getTripStatus } from "@/lib/utils";
import { Button, BottomSheet, FAB } from "@/components/ui";
import { formatCurrency, convertFromINR, RATES_PER_INR } from "@/lib/countries";
import { useSupabaseAuth } from "@/contexts/AuthContext";
import { buildExpenseLedger } from "@/lib/expense-ledger";
import { getAvatarUrl } from "@/lib/avatar";
import {
  EXPENSE_ICONS,
  EXPENSE_LABELS,
  BUDGET_KEYS,
  COLORS,
  ExpTab,
  TONES,
  LIST_CARD,
  BudgetRing,
  FILTER_LABELS,
} from "./expenses/shared";
import { ExpenseRow } from "./expenses/ExpenseRow";
import { AddExpenseSheet } from "./expenses/AddExpenseSheet";
import { BudgetSheet } from "./expenses/BudgetSheet";

export default function ExpensesTab({ trip }: { trip: Trip }) {
  const { data: expenses = [] } = useExpenses(trip.id);
  const { mutate: updateTrip } = useUpdateTrip();
  const { user } = useSupabaseAuth();
  const { mutateAsync: saveExp } = useSaveExpense();
  const { data: joinedMembers = [] } = useQuery({
  queryKey: ['trip-members', trip.id],
  queryFn: async () => {
    const { data, error } = await supabase.rpc(
  'get_trip_members_all',
  { p_trip_id: trip.id }
);

    if (error) throw error;

    return data || [];
  },
});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [showInDest, setShowInDest] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
const [showBudgetBreakdown, setShowBudgetBreakdown] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [selectedSettlements, setSelectedSettlements] = useState<number[]>([]);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [tab, setTab] = useState<ExpTab>("expenses");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<ExpenseCategory | "all">("all");

  const members = [
  ...joinedMembers
    .sort((a: any, b: any) =>
      a.user_id === user?.id
        ? -1
        : b.user_id === user?.id
        ? 1
        : 0
    )
    .map((m: any, index: number) => ({
  id: m.user_id,
  name:
    m.name?.trim() ||
    m.username?.trim() ||
    m.email?.split("@")[0] ||
    "Unknown User",
  username: m.username || "",
    status: m.status,
    avatar: m.avatar || "avatar-1",
    color:
    m.status === "removed"
      ? "#9ca3af"
      : COLORS[index % COLORS.length],
})),
];

const activeMembers = members.filter(
  (m: any) => m.status !== "removed"
);

const isSolo = activeMembers.length <= 1;
  const destCurrency = trip.destinationCurrency || 'INR';
  const showToggle = destCurrency !== 'INR';
  const activeCurrency = showInDest ? destCurrency : 'INR';

  const total = expenses
  .filter(e => e.category !== 'settlement')
  .reduce((sum, e) => sum + e.amount, 0);
  const displayTotal = showInDest ? convertFromINR(total, destCurrency) : total;

  const budget = trip.budget;
  const budgetTotal = budget?.total ?? 0;
  const remaining = budgetTotal > 0 ? budgetTotal - total : null;

  // By category
  const byCategory = BUDGET_KEYS.reduce((acc, cat) => {
    acc[cat] = expenses.filter(
  e =>
    e.category === cat &&
    e.category !== 'settlement'
).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {} as Record<ExpenseCategory, number>);

  // Per-member totals
  const ledger = useMemo(
  () => buildExpenseLedger(expenses, members),
  [expenses, members]
);

  const q = query.trim().toLowerCase();
  const filteredExpenses = expenses.filter(e => {
    if (cat !== "all" && e.category !== cat) return false;
    if (!q) return true;
    return [e.title, e.notes, e.payerName].some(v => (v || "").toLowerCase().includes(q));
  });
  const catCounts = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Grouped by date — handle old ISO, new YYYY-MM-DD, and invalid dates
  const grouped = [...filteredExpenses]
  .filter(e => e.date && typeof e.date === "string")
  .sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);

    if (dateDiff !== 0) return dateDiff;

    return (b.createdAt || 0) - (a.createdAt || 0);
  })
  .reduce((acc, exp) => {
      const raw = exp.date;
      // Extract YYYY-MM-DD from ISO or plain string
      const datePart = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
      if (!datePart) return acc;
      const d = safeFormatDate(datePart, x => format(x, 'MMM d, yyyy'), datePart);
      if (!acc[d]) acc[d] = [];
      acc[d].push(exp);
      return acc;
    }, {} as Record<string, Expense[]>);

  // Budgets are stored in INR. When the page shows the destination currency, convert on the way in and out
  // (the sheet used to show INR numbers labelled with the destination currency).
  const rate = RATES_PER_INR[destCurrency] ?? 1;
  const scaleBudget = (b: TripBudget | undefined, factor: number) =>
    b ? (Object.fromEntries(Object.entries(b).map(([k, v]) => [k, typeof v === "number" ? Math.round(v * factor) : v])) as unknown as TripBudget) : b;
  const saveBudget = (b: TripBudget) => updateTrip({ ...trip, budget: showInDest ? scaleBudget(b, 1 / rate)! : b });
  const handleSettleSelected = async () => {
  const selected = ledger.settlements.filter((_, i) =>
    selectedSettlements.includes(i)
  );

  for (const s of selected) {
  const payer = ledger.members.find(m => m.id === s.fromId);
const receiver = ledger.members.find(m => m.id === s.toId);

  if (!payer || !receiver) continue;

  await saveExp({
    id: generateId(),
    tripId: trip.id,
    title: `Settlement: ${s.from} → ${s.to}`,
    amount: s.amount,
    category: "settlement",
    date: format(new Date(), "yyyy-MM-dd"),
    payerId: payer.id,
    payerName: payer.name,
    notes: undefined,
    split: [
  {
    memberId: receiver.id,
    memberName: receiver.name,
    amount: s.amount,
  },
],
    createdAt: Date.now(),
  });
}

setSelectedSettlements([]);
setShowSettlement(false);
};

  const exportCSV = () => {
    const rows = [
      ['Date', 'Title', 'Category', 'Amount (INR)', 'Payer', 'Notes', 'Split'],
      ...expenses.map(e => {
        const payer = members.find(m => m.id === e.payerId)?.name || 'Me';
        const split =
  e.split
    ?.map((s: ExpenseSplit) => {
      const member =
        members.find(m => m.id === s.memberId);

      return `${member?.name || s.memberName || "Unknown User"}: ₹${s.amount}`;
    })
    .join("; ") || "";
        return [
          e.date,
          e.title,
          EXPENSE_LABELS[e.category as ExpenseCategory],
          String(Math.round(e.amount)),
          payer,
          e.notes || '',
          split,
        ];
      })
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.name}-expenses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const money = (n: number) => formatCurrency(showInDest ? convertFromINR(n, destCurrency) : n, activeCurrency);
  const multi = ledger.members.length > 1;
  const myNet = user ? ledger?.net?.[user.id] ?? 0 : 0;
  const over = budgetTotal > 0 && total > budgetTotal;
  const pct = budgetTotal > 0 ? Math.min((total / budgetTotal) * 100, 100) : 0;
  const readOnly = getTripStatus(trip) === 'archived';
  const tabs: { id: ExpTab; label: string }[] = [
    { id: "expenses", label: "Expenses" },
    ...(multi ? [{ id: "balances" as ExpTab, label: "Balances" }] : []),
    { id: "insights", label: "Insights" },
  ];
  const chipRow: (ExpenseCategory | "all")[] = [
    "all",
    ...(Object.keys(FILTER_LABELS) as ExpenseCategory[]).filter(c => catCounts[c]),
  ];
  const settlementsDone = expenses.filter(e => e.category === "settlement");

  // Spend per day (settlements excluded) for the Insights chart
  const dayTotals = Object.entries(
    expenses
      .filter(e => e.category !== "settlement" && /^\d{4}-\d{2}-\d{2}/.test(e.date || ""))
      .reduce((acc, e) => {
        const d = e.date.slice(0, 10);
        acc[d] = (acc[d] || 0) + e.amount;
        return acc;
      }, {} as Record<string, number>)
  )
    .sort(([x], [y]) => x.localeCompare(y))
    .slice(-14);
  const maxDay = Math.max(1, ...dayTotals.map(([, v]) => v));

  const openSettle = (i: number) => {
    setSelectedSettlements([i]);
    setShowSettlement(true);
  };

  const Avatar = ({ m, size = 44 }: { m: any; size?: number }) => (
    <img
      src={getAvatarUrl(m?.avatar || "avatar-1", 64)}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-muted object-cover"
    />
  );

  return (
    <div className="relative px-4 pb-40 pt-2">
      {/* Status card: where the money stands, and what you owe or are owed */}
      <div className="mb-4 rounded-[28px] bg-gradient-to-br from-primary to-[#4C82F0] dark:from-primary/85 dark:to-[#4C82F0]/70 p-5 text-primary-foreground shadow-[0_18px_36px_-14px_hsl(var(--primary)/0.6)]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-primary-foreground/80">Total spent</p>
          {showToggle && (
            <button
              onClick={() => setShowInDest(v => !v)}
              className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
            >
              <ArrowLeftRight className="h-3 w-3" />
              {showInDest ? destCurrency : 'INR'} to {showInDest ? 'INR' : destCurrency}
            </button>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words font-display text-[38px] font-extrabold leading-[1.05] tracking-tight">
              {formatCurrency(displayTotal, activeCurrency)}
            </h2>
            {budgetTotal > 0 ? (
              <button
                onClick={() => setIsBudgetOpen(true)}
                className="mt-2 flex items-center gap-1.5 text-left text-[13px] text-primary-foreground/90"
              >
                {over ? `Over budget by ${money(total - budgetTotal)}` : `${money(budgetTotal - total)} left of ${money(budgetTotal)}`}
                <Pencil className="h-3 w-3 opacity-70" />
              </button>
            ) : (
              <button
                onClick={() => setIsBudgetOpen(true)}
                className="glass mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              >
                <Target className="h-3.5 w-3.5" />
                Set a budget
              </button>
            )}
          </div>
          {budgetTotal > 0 && <BudgetRing pct={pct} over={over} />}
        </div>


        {multi && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/20 pt-4">
            <div className="min-w-0">
              <p className="text-[11px] text-primary-foreground/70">Your balance</p>
              <p className="flex items-center gap-1.5 truncate text-[16px] font-semibold">
                {Math.abs(myNet) < 1 ? (
                  <>
                    <Check className="h-4 w-4 shrink-0" />
                    All settled
                  </>
                ) : myNet > 0 ? (
                  `You are owed ${money(myNet)}`
                ) : (
                  `You owe ${money(Math.abs(myNet))}`
                )}
              </p>
            </div>
            {Math.abs(myNet) >= 1 && (
              <button
                onClick={() => setTab("balances")}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-primary"
              >
                Settle up
              </button>
            )}
          </div>
        )}
      </div>

      {/* Views */}
      <div className="mb-5 flex rounded-full bg-muted p-1 text-[13px] font-semibold">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-full py-2 outline-none transition-colors focus:outline-none",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ───── Expenses ───── */}
      {tab === "expenses" && (
        <>
          {expenses.length > 0 && (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search expenses"
                  className="h-12 w-full rounded-2xl bg-card pl-11 pr-10 text-[15px] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_16px_-6px_rgba(15,23,42,0.1)] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
                />
                {query && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="-mx-4 -mb-3 mt-3 overflow-x-auto px-4 pb-6 no-scrollbar">
                <div className="flex min-w-max gap-2">
                  {chipRow.map(c => {
                    const active = cat === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setCat(c)}
                        className={cn(
                          "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold outline-none transition-colors focus:outline-none",
                          active
                            ? "bg-primary text-primary-foreground shadow-[0_8px_16px_-6px_hsl(var(--primary)/0.55)] dark:shadow-none"
                            : "bg-card text-foreground/80 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_10px_-4px_rgba(15,23,42,0.1)]"
                        )}
                      >
                        {c === "all" ? "All" : FILTER_LABELS[c]}
                        <span className={cn("text-[12px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {c === "all" ? expenses.length : catCounts[c]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="mt-4 space-y-6">
            {expenses.length === 0 ? (
              <div className="mt-10 flex flex-col items-center px-8 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10 text-primary">
                  <CreditCard className="h-9 w-9" />
                </div>
                <h3 className="font-display text-xl font-bold">No expenses yet</h3>
                <p className="mt-1.5 max-w-[250px] text-[15px] text-muted-foreground">Tap + to add the first one.</p>
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="mt-10 text-center text-muted-foreground">
                <p className="font-medium text-foreground">No matches</p>
                <p className="mt-1 text-sm">Try a different word or clear the filter.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([date, items]) => {
                const dayTotal = items.filter(e => e.category !== 'settlement').reduce((sum, e) => sum + e.amount, 0);
                return (
                  <section key={date}>
                    <h3 className="mb-2 flex items-center justify-between px-1 text-[13px] font-semibold text-muted-foreground">
                      <span>{date}</span>
                      {dayTotal > 0 && <span className="text-foreground">{money(dayTotal)}</span>}
                    </h3>
                    <div className={LIST_CARD}>
                      {items.map(exp => (
                        <ExpenseRow key={exp.id} expense={exp} members={ledger.members} money={money} myId={user?.id} onEdit={() => setEditExpense(exp)} />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ───── Balances ───── */}
      {tab === "balances" && multi && (
        <div className="space-y-7">
          <section>
            <h3 className="mb-3 px-1 text-[13px] font-semibold text-muted-foreground">Who pays whom</h3>
            {ledger.settlements.length === 0 ? (
              <div className="flex items-center gap-3 rounded-[22px] bg-emerald-50 p-4 ring-1 ring-emerald-100">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-emerald-950">Everyone is settled</p>
                  <p className="text-[13px] text-emerald-900/70">No payments needed between members.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {ledger.settlements.map((sItem, i) => {
                  const from = ledger.members.find(m => m.id === sItem.fromId);
                  const to = ledger.members.find(m => m.id === sItem.toId);
                  return (
                    <div key={i} className="rounded-[22px] bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_26px_-10px_rgba(15,23,42,0.18)] ring-1 ring-border">
                      <div className="flex items-center gap-3">
                        <Avatar m={from} />
                        <div className="flex flex-1 items-center">
                          <div className="flex-1 border-t-[1.5px] border-dashed border-emerald-300" />
                          <ArrowRight className="mx-1.5 h-4 w-4 text-emerald-600" />
                          <div className="flex-1 border-t-[1.5px] border-dashed border-emerald-300" />
                        </div>
                        <Avatar m={to} />
                      </div>
                      <p className="mt-3 text-[14px]">
                        <b className="font-semibold">{sItem.from}</b> pays <b className="font-semibold">{sItem.to}</b>
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-display text-[24px] font-bold">{money(sItem.amount)}</span>
                        {!readOnly && (
                          <button onClick={() => openSettle(i)} className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
                            Settle
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">Members</h3>
            <div className={LIST_CARD}>
              {Object.keys(ledger?.net ?? {}).map(id => {
                const m: any = ledger.members.find(x => x.id === id) || { id, name: "Unknown User", avatar: "avatar-1" };
                const net = ledger.net?.[id] ?? 0;
                const paid = ledger.paid?.[id] ?? 0;
                const owed = ledger.owed?.[id] ?? 0;
                const state = net > 0.5 ? "up" : net < -0.5 ? "down" : "even";
                return (
                  <div key={id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar m={m} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">
                        {m.name}
                        {id === user?.id && <span className="ml-1.5 text-xs font-medium text-muted-foreground">You</span>}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        Paid {money(paid)}, share {money(owed)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-display text-[15.5px] font-bold", state === "up" ? "text-emerald-700" : state === "down" ? "text-rose-700" : "text-muted-foreground")}>
                        {state === "even" ? "Settled" : money(Math.abs(net))}
                      </p>
                      {state !== "even" && (
                        <p className={cn("text-[11px]", state === "up" ? "text-emerald-700/80" : "text-rose-700/80")}>
                          {state === "up" ? "gets back" : "owes"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {settlementsDone.length > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">Settled so far</h3>
              <div className={LIST_CARD}>
                {settlementsDone.map(exp => (
                  <ExpenseRow key={exp.id} expense={exp} members={ledger.members} money={money} myId={user?.id} onEdit={() => setEditExpense(exp)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ───── Insights ───── */}
      {tab === "insights" && (
        <div className="space-y-7">
          <section>
            <h3 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">By category</h3>
            <div className={LIST_CARD}>
              {BUDGET_KEYS.map(c => {
                const spent = byCategory[c] ?? 0;
                const budgeted = (budget as any)?.[c] ?? 0;
                const tone = TONES[c];
                const Icon = EXPENSE_ICONS[c];
                const share = total > 0 ? (spent / total) * 100 : 0;
                const barPct = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : share;
                const catOver = budgeted > 0 && spent > budgeted;
                return (
                  <div key={c} className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", tone.tile)}>
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold">{EXPENSE_LABELS[c]}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {budgeted > 0 ? `of ${money(budgeted)} budget` : `${Math.round(share)}% of spend`}
                        </p>
                      </div>
                      <p className={cn("font-display text-[15.5px] font-bold", catOver && "text-red-600")}>{money(spent)}</p>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full transition-[width]", catOver ? "bg-red-500" : tone.bar)} style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {dayTotals.length > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">Spend per day</h3>
              <div className="rounded-[22px] bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(15,23,42,0.14)]">
                <div className="flex h-32 items-end gap-1.5">
                  {dayTotals.map(([d, v]) => (
                    <div key={d} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                      <div title={`${d}: ${money(v)}`} className="w-full rounded-t-md bg-primary/80" style={{ height: `${Math.max((v / maxDay) * 100, 4)}%` }} />
                      <span className="text-[10px] text-muted-foreground">{d.slice(8, 10)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {multi && total > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">Who paid</h3>
              <div className="rounded-[22px] bg-card p-4 ring-1 ring-border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(15,23,42,0.14)]">
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {Object.keys(ledger.paid ?? {}).map(id => {
                    const m: any = ledger.members.find(x => x.id === id);
                    const v = ledger.paid?.[id] ?? 0;
                    const all = Object.values(ledger.paid ?? {}).reduce((a: number, b: any) => a + b, 0);
                    return v > 0 ? <div key={id} style={{ width: `${(v / Math.max(1, all)) * 100}%`, background: m?.color || "#9ca3af" }} /> : null;
                  })}
                </div>
                <div className="mt-3 space-y-2">
                  {Object.keys(ledger.paid ?? {}).map(id => {
                    const m: any = ledger.members.find(x => x.id === id);
                    const v = ledger.paid?.[id] ?? 0;
                    return v > 0 ? (
                      <div key={id} className="flex items-center justify-between text-[13px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m?.color || "#9ca3af" }} />
                          <span className="truncate">{m?.name || "Unknown User"}</span>
                        </span>
                        <span className="font-semibold">{money(v)}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </section>
          )}

          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setIsBudgetOpen(true)}>
              <Target className="h-4 w-4" />
              {budget ? 'Edit budget' : 'Set budget'}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={exportCSV}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      )}

      {!readOnly && <FAB icon={Plus} label="Add expense" onClick={() => setIsAddOpen(true)} />}
      <AddExpenseSheet
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        trip={trip}
        members={members}
        activeCurrency={activeCurrency}
        showInDest={showInDest}
        destCurrency={destCurrency}
      />
      {editExpense && (
        <AddExpenseSheet
          isOpen={!!editExpense}
          onClose={() => setEditExpense(null)}
          trip={trip}
          members={ledger.members}
          activeCurrency={activeCurrency}
          showInDest={showInDest}
          destCurrency={destCurrency}
          existingExpense={editExpense}
        />
      )}
      <BottomSheet isOpen={showSettlement} onClose={() => setShowSettlement(false)} title="Settle Up">
        <div className="flex flex-col gap-3">
          {ledger.settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone is settled.</p>
          ) : (
            ledger.settlements.map((sItem, i) => (
              <label key={i} className="flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-3">
                <input
                  type="checkbox"
                  checked={selectedSettlements.includes(i)}
                  onChange={e => {
                    if (e.target.checked) setSelectedSettlements(prev => [...prev, i]);
                    else setSelectedSettlements(prev => prev.filter(x => x !== i));
                  }}
                />
                <div className="flex-1">
                  <p className="font-medium">{sItem.from} pays {sItem.to}</p>
                  <p className="mt-1 font-bold text-primary">{money(sItem.amount)}</p>
                </div>
              </label>
            ))
          )}
          <Button className="mt-2 w-full" disabled={selectedSettlements.length === 0} onClick={handleSettleSelected}>
            Mark as paid
          </Button>
        </div>
      </BottomSheet>
      <BudgetSheet
        isOpen={isBudgetOpen}
        onClose={() => setIsBudgetOpen(false)}
        current={showInDest ? scaleBudget(budget, rate) : budget}
        onSave={saveBudget}
        activeCurrency={activeCurrency}
      />
    </div>
  );
}
