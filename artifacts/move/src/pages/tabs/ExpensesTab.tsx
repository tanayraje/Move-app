import React, { useState } from "react";
import { Plus, Coffee, Car, Home, Camera, ShoppingBag, CreditCard, Trash2, Target, ArrowLeftRight, ChevronDown, ChevronUp } from "lucide-react";
import { useExpenses, useSaveExpense, useDeleteExpense, useUpdateTrip } from "@/hooks/use-store";
import { Trip, Expense, ExpenseCategory, TripBudget } from "@/lib/types";
import { generateId, cn } from "@/lib/utils";
import { Button, Input, Label, Select, BottomSheet, FAB } from "@/components/ui";
import { format } from "date-fns";
import { formatCurrency, convertFromINR } from "@/lib/countries";

const EXPENSE_ICONS: Record<ExpenseCategory, React.ElementType> = {
  food: Coffee,
  transport: Car,
  accommodation: Home,
  activities: Camera,
  misc: CreditCard,
};

const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  food: 'Food & Drinks',
  transport: 'Transport',
  accommodation: 'Accommodation',
  activities: 'Activities',
  misc: 'Misc',
};

const BUDGET_CATEGORY_KEYS: ExpenseCategory[] = ['transport', 'food', 'accommodation', 'activities', 'misc'];

export default function ExpensesTab({ trip }: { trip: Trip }) {
  const { data: expenses = [] } = useExpenses(trip.id);
  const { mutate: updateTrip } = useUpdateTrip();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [showInDest, setShowInDest] = useState(false);

  const destCurrency = trip.destinationCurrency || 'INR';
  const showToggle = destCurrency !== 'INR';
  const activeCurrency = showInDest ? destCurrency : 'INR';

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const displayTotal = showInDest ? convertFromINR(total, destCurrency) : total;

  const budget = trip.budget;
  const budgetTotal = budget?.total ?? 0;
  const remaining = budgetTotal > 0 ? budgetTotal - total : null;

  // Expenses by category
  const byCategory = BUDGET_CATEGORY_KEYS.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {} as Record<ExpenseCategory, number>);

  const grouped = [...expenses]
    .sort((a, b) => b.createdAt - a.createdAt)
    .reduce((acc, exp) => {
      const d = format(new Date(exp.date), 'MMM d, yyyy');
      if (!acc[d]) acc[d] = [];
      acc[d].push(exp);
      return acc;
    }, {} as Record<string, Expense[]>);

  const saveBudget = (b: TripBudget) => {
    updateTrip({ ...trip, budget: b });
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
              <div
                className={cn("h-full rounded-full transition-all", total > budgetTotal ? "bg-red-400" : "bg-white/80")}
                style={{ width: `${Math.min((total / budgetTotal) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Budget + currency actions */}
      <div className="flex gap-2 mb-5">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setIsBudgetOpen(true)}>
          <Target className="w-4 h-4" />
          {budget ? 'Edit Budget' : 'Set Budget'}
        </Button>
      </div>

      {/* Category breakdown */}
      {budget && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-bold text-sm text-foreground">Category Breakdown</p>
          </div>
          {BUDGET_CATEGORY_KEYS.map(cat => {
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
                    <div
                      className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-red-500" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
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
                  <ExpenseRow key={exp.id} expense={exp} activeCurrency={activeCurrency} destCurrency={destCurrency} showInDest={showInDest} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <FAB icon={Plus} onClick={() => setIsAddOpen(true)} />
      <AddExpenseSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} tripId={trip.id} activeCurrency={activeCurrency} showInDest={showInDest} destCurrency={destCurrency} />
      <BudgetSheet isOpen={isBudgetOpen} onClose={() => setIsBudgetOpen(false)} current={budget} onSave={saveBudget} activeCurrency={activeCurrency} />
    </div>
  );
}

function ExpenseRow({ expense, activeCurrency, destCurrency, showInDest }: { expense: Expense; activeCurrency: string; destCurrency: string; showInDest: boolean }) {
  const { mutate: deleteExp } = useDeleteExpense();
  const Icon = EXPENSE_ICONS[expense.category] || CreditCard;
  const displayAmount = showInDest ? convertFromINR(expense.amount, destCurrency) : expense.amount;

  return (
    <div className="flex items-center justify-between p-4 group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground/70 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-foreground text-sm">{expense.title}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{EXPENSE_LABELS[expense.category]}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display font-bold text-foreground">{formatCurrency(displayAmount, activeCurrency)}</span>
        <button onClick={() => { if (confirm('Delete?')) deleteExp({ id: expense.id, tripId: expense.tripId }); }} className="text-muted-foreground hover:text-red-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AddExpenseSheet({ isOpen, onClose, tripId, activeCurrency, showInDest, destCurrency }: {
  isOpen: boolean; onClose: () => void; tripId: string; activeCurrency: string; showInDest: boolean; destCurrency: string;
}) {
  const { mutateAsync: addExp, isPending } = useSaveExpense();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    let amount = parseFloat(fd.get('amount') as string);
    // If user entered in dest currency, convert back to INR for storage
    if (showInDest && destCurrency !== 'INR') {
      const { RATES_PER_INR } = await import('@/lib/countries');
      const rate = RATES_PER_INR[destCurrency] || 1;
      amount = amount / rate;
    }
    await addExp({
      id: generateId(),
      tripId,
      title: fd.get('title') as string,
      amount,
      category: fd.get('category') as ExpenseCategory,
      date: new Date().toISOString(),
      createdAt: Date.now()
    });
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Expense">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="amount">Amount ({activeCurrency})</Label>
          <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required className="text-3xl font-display font-bold h-16" />
        </div>
        <div>
          <Label htmlFor="title">Description</Label>
          <Input id="title" name="title" placeholder="Dinner at Luigi's" required />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" required defaultValue="food">
            <option value="food">Food & Drinks</option>
            <option value="transport">Transport</option>
            <option value="accommodation">Accommodation</option>
            <option value="activities">Activities</option>
            <option value="misc">Misc</option>
          </Select>
        </div>
        <Button type="submit" size="lg" className="mt-4" isLoading={isPending}>Save Expense</Button>
      </form>
    </BottomSheet>
  );
}

function BudgetSheet({ isOpen, onClose, current, onSave, activeCurrency }: {
  isOpen: boolean; onClose: () => void; current?: TripBudget; onSave: (b: TripBudget) => void; activeCurrency: string;
}) {
  const [vals, setVals] = useState<TripBudget>(current || { total: 0, travel: 0, food: 0, accommodation: 0, activities: 0, misc: 0 });

  const handleSave = () => {
    onSave(vals);
    onClose();
  };

  const field = (key: keyof TripBudget, label: string) => (
    <div key={key}>
      <Label>{label} ({activeCurrency})</Label>
      <Input
        type="number"
        step="1"
        value={vals[key] || ''}
        onChange={e => setVals(v => ({ ...v, [key]: parseFloat(e.target.value) || 0 }))}
        placeholder="0"
      />
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
