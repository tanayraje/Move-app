import React, { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
  Plus, Coffee, Car, Home, Camera, ShoppingBag, CreditCard,
  Trash2, Target, ArrowLeftRight, Download, Users, User, Split,
  ChevronDown, ChevronUp, Check
} from "lucide-react";
import { useExpenses, useSaveExpense, useDeleteExpense, useUpdateTrip } from "@/hooks/use-store";
import { Trip, Expense, ExpenseCategory, TripBudget, TripMember } from "@/lib/types";
import { generateId, cn, safeFormatDate, getTripStatus } from "@/lib/utils";
import { Button, Input, Label, Select, BottomSheet, FAB } from "@/components/ui";
import { formatCurrency, convertFromINR } from "@/lib/countries";

const EXPENSE_ICONS: Record<ExpenseCategory, React.ElementType> = {
  food: Coffee,
  transport: Car,
  accommodation: Home,
  activities: Camera,
  misc: ShoppingBag,
};

const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  food: 'Food & Drinks',
  transport: 'Transport',
  accommodation: 'Accommodation',
  activities: 'Activities',
  misc: 'Misc',
};

const BUDGET_KEYS: ExpenseCategory[] = ['transport', 'food', 'accommodation', 'activities', 'misc'];
const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d'];

export default function ExpensesTab({ trip }: { trip: Trip }) {
  const { data: expenses = [] } = useExpenses(trip.id);
  const { mutate: updateTrip } = useUpdateTrip();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [showInDest, setShowInDest] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  const members = trip.members || [{ id: 'self', name: 'Me', color: '#2563eb' }];
  const isSolo = members.length <= 1;
  const destCurrency = trip.destinationCurrency || 'INR';
  const showToggle = destCurrency !== 'INR';
  const activeCurrency = showInDest ? destCurrency : 'INR';

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const displayTotal = showInDest ? convertFromINR(total, destCurrency) : total;

  const budget = trip.budget;
  const budgetTotal = budget?.total ?? 0;
  const remaining = budgetTotal > 0 ? budgetTotal - total : null;

  // By category
  const byCategory = BUDGET_KEYS.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {} as Record<ExpenseCategory, number>);

  // Per-member totals
  const memberTotals = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach(m => map[m.id] = 0);
    expenses.forEach(e => {
      const payerId = e.payerId || 'self';
      if (map[payerId] !== undefined) map[payerId] += e.amount;
      else map['self'] = (map['self'] || 0) + e.amount;
    });
    return map;
  }, [expenses, members]);

  // Participants (who owes whom)
  const balance = useMemo(() => {
    if (isSolo || expenses.length === 0) return null;
    const paid: Record<string, number> = {};
    const owed: Record<string, number> = {};
    members.forEach(m => { paid[m.id] = 0; owed[m.id] = 0; });
    expenses.forEach(e => {
      const payerId = e.payerId || 'self';
      const amount = e.amount;
      const split = e.split;
      if (split && split.length > 0) {
        split.forEach(s => {
          const mid = s.memberId;
          if (paid[mid] !== undefined) paid[mid] = (paid[mid] || 0);
          if (owed[mid] !== undefined) owed[mid] = (owed[mid] || 0) + s.amount;
        });
        paid[payerId] = (paid[payerId] || 0) + amount;
      } else {
        // Equal split among all members by default
        const perPerson = amount / members.length;
        members.forEach(m => {
          owed[m.id] = (owed[m.id] || 0) + perPerson;
        });
        paid[payerId] = (paid[payerId] || 0) + amount;
      }
    });
    // Net: positive = should receive, negative = owes
    const net: Record<string, number> = {};
    members.forEach(m => {
      net[m.id] = (paid[m.id] || 0) - (owed[m.id] || 0);
    });
    return { paid, owed, net };
  }, [expenses, members, isSolo]);

  // Grouped by date — handle old ISO, new YYYY-MM-DD, and invalid dates
  const grouped = [...expenses]
    .filter(e => e.date && typeof e.date === 'string')
    .sort((a, b) => a.date.localeCompare(b.date))
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

  const saveBudget = (b: TripBudget) => updateTrip({ ...trip, budget: b });

  const exportCSV = () => {
    const rows = [
      ['Date', 'Title', 'Category', 'Amount (INR)', 'Payer', 'Notes', 'Split'],
      ...expenses.map(e => {
        const payer = members.find(m => m.id === e.payerId)?.name || 'Me';
        const split = e.split?.map(s => `${members.find(m => m.id === s.memberId)?.name || s.memberId}: ₹${s.amount}`).join('; ') || '';
        return [
          e.date,
          e.title,
          EXPENSE_LABELS[e.category],
          String(Math.round(e.amount)),
          payer,
          e.notes || '',
          split,
        ];
      })
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.name}-expenses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 h-full relative pb-32">

      {/* Total card */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-5 text-primary-foreground shadow-xl shadow-primary/20 mb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-primary-foreground/80 font-medium text-sm">Total Spent</p>
          {showToggle && (
            <button
              onClick={() => setShowInDest(v => !v)}
              className="flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm"
            >
              <ArrowLeftRight className="w-3 h-3" />
              {showInDest ? destCurrency : 'INR'} ↔ {showInDest ? 'INR' : destCurrency}
            </button>
          )}
        </div>
        <h2 className="text-4xl font-display font-extrabold tracking-tight">
          {formatCurrency(displayTotal, activeCurrency)}
        </h2>
        {budgetTotal > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs font-medium mb-1.5 opacity-80">
              <span>Budget: {formatCurrency(showInDest ? convertFromINR(budgetTotal, destCurrency) : budgetTotal, activeCurrency)}</span>
              <span>{remaining !== null && remaining >= 0 ? formatCurrency(showInDest ? convertFromINR(remaining, destCurrency) : remaining, activeCurrency) + ' left' : 'Over budget'}</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", total > budgetTotal ? "bg-red-400" : "bg-white/80")}
                style={{ width: `${Math.min((total / budgetTotal) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions row */}
      <div className="flex gap-2 mb-5">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setIsBudgetOpen(true)}>
          <Target className="w-4 h-4" />
          {budget ? 'Edit Budget' : 'Set Budget'}
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Participants (shown when multi-member) */}
      {!isSolo && balance && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5">
          <button
            onClick={() => setShowBalance(v => !v)}
            className="flex items-center justify-between w-full px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <p className="font-bold text-sm text-foreground">Participants</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showBalance && "rotate-180")} />
          </button>
          {showBalance && (
           <div className="px-4 pb-4 border-t border-border/50">
  <div className="overflow-x-auto mt-3">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/50">
          <th className="text-left py-2 font-semibold text-muted-foreground">
            Participant
          </th>
          <th className="text-right py-2 font-semibold text-muted-foreground">
            Paid
          </th>
          <th className="text-right py-2 font-semibold text-muted-foreground">
            Balance
          </th>
        </tr>
      </thead>

      <tbody>
        {members.map(m => {
          const net = balance.net[m.id] || 0;
          const paid = memberTotals[m.id] || 0;

          return (
            <tr key={m.id} className="border-b border-border/30 last:border-0">
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: m.color || '#2563eb' }}
                  >
                    {m.name.charAt(0)}
                  </div>
                  <span className="font-medium text-foreground">
                    {m.name}
                  </span>
                </div>
              </td>

              <td className="py-3 text-right font-medium text-foreground">
                {formatCurrency(
                  showInDest
                    ? convertFromINR(paid, destCurrency)
                    : paid,
                  activeCurrency
                )}
              </td>

              <td
                className={cn(
                  "py-3 text-right font-bold",
                  net > 0
                    ? "text-green-600"
                    : net < 0
                    ? "text-red-500"
                    : "text-muted-foreground"
                )}
              >
                {net > 0
                  ? `+${formatCurrency(
                      showInDest
                        ? convertFromINR(net, destCurrency)
                        : net,
                      activeCurrency
                    )}`
                  : net < 0
                  ? `-${formatCurrency(
                      showInDest
                        ? convertFromINR(Math.abs(net), destCurrency)
                        : Math.abs(net),
                      activeCurrency
                    )}`
                  : formatCurrency(0, activeCurrency)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>

  <p className="text-xs text-muted-foreground mt-3">
    Positive = should receive · Negative = owes
  </p>
</div>
          )}
        </div>
      )}

      {/* Category breakdown */}
      {budget && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-bold text-sm text-foreground">Category Breakdown</p>
          </div>
          {BUDGET_KEYS.map(cat => {
            const spent = byCategory[cat] ?? 0;
            const budgeted = (budget as any)[cat] ?? 0;
            const pct = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
            const Icon = EXPENSE_ICONS[cat];
            return (
              <div key={cat} className="px-4 py-3 border-b border-border/50 last:border-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{EXPENSE_LABELS[cat]}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-foreground">{formatCurrency(showInDest ? convertFromINR(spent, destCurrency) : spent, activeCurrency)}</span>
                    {budgeted > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">/ {formatCurrency(showInDest ? convertFromINR(budgeted, destCurrency) : budgeted, activeCurrency)}</span>
                    )}
                  </div>
                </div>
                {budgeted > 0 && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-red-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expense list */}
      <div className="space-y-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <p>No expenses tracked yet.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-1">{date}</h3>
              <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden divide-y divide-border/50">
                {items.map(exp => (
                  <ExpenseRow
                    key={exp.id}
                    expense={exp}
                    members={members}
                    activeCurrency={activeCurrency}
                    destCurrency={destCurrency}
                    showInDest={showInDest}
                    onEdit={() => setEditExpense(exp)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {getTripStatus(trip) !== 'archived' && <FAB icon={Plus} onClick={() => setIsAddOpen(true)} />}
      <AddExpenseSheet
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        trip={trip}
        activeCurrency={activeCurrency}
        showInDest={showInDest}
        destCurrency={destCurrency}
      />
      {editExpense && (
        <AddExpenseSheet
          isOpen={!!editExpense}
          onClose={() => setEditExpense(null)}
          trip={trip}
          activeCurrency={activeCurrency}
          showInDest={showInDest}
          destCurrency={destCurrency}
          existingExpense={editExpense}
        />
      )}
      <BudgetSheet isOpen={isBudgetOpen} onClose={() => setIsBudgetOpen(false)} current={budget} onSave={saveBudget} activeCurrency={activeCurrency} />
    </div>
  );
}

// ── Expense Row ───────────────────────────────────────────────────
function ExpenseRow({
  expense, members, activeCurrency, destCurrency, showInDest, onEdit
}: {
  expense: Expense; members: TripMember[]; activeCurrency: string; destCurrency: string; showInDest: boolean; onEdit: () => void;
}) {
  const { mutate: deleteExp } = useDeleteExpense();
  const Icon = EXPENSE_ICONS[expense.category] || CreditCard;
  const displayAmount = showInDest ? convertFromINR(expense.amount, destCurrency) : expense.amount;
  const payer = members.find(m => m.id === expense.payerId) || members[0] || { name: 'Me', color: '#2563eb' };
  const isSplit = !!expense.split;

  return (
    <div className="flex items-center justify-between p-4 group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground/70 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-foreground text-sm truncate">{expense.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="uppercase tracking-wider">{EXPENSE_LABELS[expense.category]}</span>
            {expense.notes && (
              <span className="truncate max-w-[100px] opacity-70">{expense.notes}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                style={{ backgroundColor: payer.color || '#2563eb' }}>
                {payer.name.charAt(0)}
              </div>
              <span className="text-xs text-muted-foreground">{payer.name}</span>
            </div>
            {isSplit && (
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                Split
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-display font-bold text-foreground">{formatCurrency(displayAmount, activeCurrency)}</span>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="text-muted-foreground hover:text-primary transition-colors p-1">
            <Users className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { if (confirm('Delete?')) deleteExp({ id: expense.id, tripId: expense.tripId }); }} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add/Edit Expense Sheet ────────────────────────────────────────────────
function AddExpenseSheet({
  isOpen, onClose, trip, activeCurrency, showInDest, destCurrency, existingExpense
}: {
  isOpen: boolean; onClose: () => void; trip: Trip;
  activeCurrency: string; showInDest: boolean; destCurrency: string;
  existingExpense?: Expense;
}) {
  const { mutateAsync: saveExp, isPending } = useSaveExpense();
  const members = trip.members || [{ id: 'self', name: 'Me', color: '#2563eb' }];
  const isSolo = members.length <= 1;
  const isEditing = !!existingExpense;

  const [amountInput, setAmountInput] = useState(
    existingExpense ? String(Math.round(existingExpense.amount)) : ''
  );
  const [dateInput, setDateInput] = useState(
    existingExpense ? existingExpense.date : format(new Date(), 'yyyy-MM-dd')
  );
  const [payerId, setPayerId] = useState(existingExpense?.payerId || 'self');
  const [notesInput, setNotesInput] = useState(existingExpense?.notes || '');
  const [showSplit, setShowSplit] = useState(false);
  const [splitMode, setSplitMode] = useState<'equal' | 'unequal'>('equal');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    existingExpense?.split?.map(s => s.memberId) || members.map(m => m.id)
  );
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>(
    existingExpense?.split?.reduce((acc, s) => ({ ...acc, [s.memberId]: String(s.amount) }), {}) || {}
  );
    useEffect(() => {
  if (existingExpense) {
    setAmountInput(String(Math.round(existingExpense.amount)));
    setDateInput(existingExpense.date);
    setPayerId(existingExpense.payerId || 'self');
    setNotesInput(existingExpense.notes || '');
    setSelectedMemberIds(
      existingExpense.split?.map(s => s.memberId) || members.map(m => m.id)
    );
    setSplitAmounts(
      existingExpense.split?.reduce(
        (acc, s) => ({ ...acc, [s.memberId]: String(s.amount) }),
        {}
      ) || {}
    );
  } else {
    setAmountInput('');
    setDateInput(format(new Date(), 'yyyy-MM-dd'));
    setPayerId('self');
    setNotesInput('');
    setShowSplit(false);
    setSplitMode('equal');
    setSelectedMemberIds(members.map(m => m.id));
    setSplitAmounts({});
  }
}, [existingExpense, isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let amount = parseFloat(amountInput);
    if (showInDest && destCurrency !== 'INR') {
      const { RATES_PER_INR } = await import('@/lib/countries');
      const rate = RATES_PER_INR[destCurrency] || 1;
      amount = amount / rate;
    }
    if (!amount || amount <= 0) { alert('Enter a valid amount'); return; }

    const date = dateInput;
    const title = fd.get('title') as string;
    const category = fd.get('category') as ExpenseCategory;

    // Build split
    let split: { memberId: string; amount: number }[] | undefined;
    if (!isSolo && showSplit) {
      const involved = selectedMemberIds;
      if (involved.length === 0) { alert('Select at least one member'); return; }
      if (splitMode === 'equal') {
        const per = Math.round(amount / involved.length);
        const first = per + (amount - per * involved.length); // handle rounding
        split = involved.map((mid, i) => ({ memberId: mid, amount: i === 0 ? first : per }));
      } else {
        const parts = involved.map(mid => {
          const val = parseFloat(splitAmounts[mid] || '0');
          return { memberId: mid, amount: isNaN(val) ? 0 : val };
        });
        const total = parts.reduce((s, p) => s + p.amount, 0);
        if (Math.abs(total - amount) > 1) { alert(`Split total (₹${total}) must equal expense (₹${amount})`); return; }
        split = parts;
      }
    }

    await saveExp({
      id: existingExpense?.id || generateId(),
      tripId: trip.id,
      title,
      amount,
      category,
      date,
      payerId: payerId || 'self',
      notes: notesInput || undefined,
      split: split,
      createdAt: existingExpense?.createdAt || Date.now(),
    });
    onClose();
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit Expense" : "Add Expense"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="amount">Amount ({activeCurrency})</Label>
          <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required
            value={amountInput} onChange={e => setAmountInput(e.target.value)}
            className="text-3xl font-display font-bold h-16" />
        </div>
        <div>
          <Label htmlFor="title">Description</Label>
          <Input id="title" name="title" placeholder="Dinner at Luigi's" defaultValue={existingExpense?.title} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select id="category" name="category" required defaultValue={existingExpense?.category || 'food'}>
              <option value="food">Food & Drinks</option>
              <option value="transport">Transport</option>
              <option value="accommodation">Accommodation</option>
              <option value="activities">Activities</option>
              <option value="misc">Misc</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} required />
          </div>
        </div>

        {/* Payer */}
        <div>
          <Label htmlFor="payer">Paid By</Label>
          <Select id="payer" name="payer" value={payerId} onChange={e => setPayerId(e.target.value)}>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" name="notes" placeholder="Receipt #, details…" value={notesInput} onChange={e => setNotesInput(e.target.value)} />
        </div>

        {/* Split controls — only when multi-member */}
        {!isSolo && (
          <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSplit(v => !v)}
              className="flex items-center justify-between w-full px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Split className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm text-foreground">{showSplit ? 'Split On' : 'Split Expense'}</span>
              </div>
              <div className={cn("w-10 h-6 rounded-full transition-all relative", showSplit ? "bg-primary" : "bg-muted")}>
                <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-all", showSplit ? "left-5" : "left-1")} />
              </div>
            </button>

            {showSplit && (
              <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-4">
                {/* Split mode */}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSplitMode('equal')}
                    className={cn("flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all",
                      splitMode === 'equal' ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    )}>
                    Equal Split
                  </button>
                  <button type="button" onClick={() => setSplitMode('unequal')}
                    className={cn("flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all",
                      splitMode === 'unequal' ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    )}>
                    Unequal
                  </button>
                </div>

                {/* Member selection */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Split With</p>
                  <div className="space-y-1.5">
                    {members.map(m => {
                      const isSelected = selectedMemberIds.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleMember(m.id)}
                          className={cn("flex items-center gap-3 w-full px-3 py-2 rounded-xl border transition-all",
                            isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                          )}>
                          <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                            isSelected ? "bg-primary border-primary" : "border-border"
                          )}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: m.color || '#2563eb' }}>
                            {m.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-foreground">{m.name}</span>
                          {splitMode === 'unequal' && isSelected && (
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Amount"
                              value={splitAmounts[m.id] || ''}
                              onChange={e => {
                                e.stopPropagation();
                                setSplitAmounts(prev => ({ ...prev, [m.id]: e.target.value }));
                              }}
                              className="w-20 h-8 text-xs ml-auto"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <Button type="submit" size="lg" className="mt-2" isLoading={isPending}>
          {isEditing ? 'Save Changes' : 'Save Expense'}
        </Button>
      </form>
    </BottomSheet>
  );
}

// ── Budget Sheet ───────────────────────────────────────────────────────────────
function BudgetSheet({ isOpen, onClose, current, onSave, activeCurrency }: {
  isOpen: boolean; onClose: () => void; current?: TripBudget; onSave: (b: TripBudget) => void; activeCurrency: string;
}) {
  const [vals, setVals] = useState<TripBudget>(current || { total: 0, transport: 0, food: 0, accommodation: 0, activities: 0, misc: 0 });

  const handleSave = () => { onSave(vals); onClose(); };

  const field = (key: keyof TripBudget, label: string) => (
    <div key={key}>
      <Label>{label} ({activeCurrency})</Label>
      <Input type="number" step="1" value={vals[key] || ''}
        onChange={e => setVals(v => ({ ...v, [key]: parseFloat(e.target.value) || 0 }))}
        placeholder="0" />
    </div>
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Trip Budget">
      <div className="flex flex-col gap-4">
        {field('total', 'Overall Budget')}
        <div className="border-t border-border pt-4">
          <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">By Category</p>
          {field('transport', 'Travel & Transport')}
          {field('food', 'Food & Drinks')}
          {field('accommodation', 'Accommodation')}
          {field('activities', 'Activities')}
          {field('misc', 'Miscellaneous')}
        </div>
        <Button size="lg" className="mt-4" onClick={handleSave}>Save Budget</Button>
      </div>
    </BottomSheet>
  );
}
    
