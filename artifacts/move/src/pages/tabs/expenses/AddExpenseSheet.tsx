import { notify } from "@/lib/dialogs";
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ArrowLeftRight, Split, Check } from "lucide-react";
import { useSaveExpense } from "@/hooks/use-store";
import { Trip, Expense, ExpenseCategory } from "@/lib/types";
import { generateId, cn } from "@/lib/utils";
import { Button, Input, Label, Select, BottomSheet } from "@/components/ui";
import { RATES_PER_INR } from "@/lib/countries";
import { splitEqually } from "@/lib/expense-ledger";
import { getAvatarUrl } from "@/lib/avatar";
import { DeleteExpense } from "./ExpenseRow";

// ── Add/Edit Expense Sheet ────────────────────────────────────────────────
export function AddExpenseSheet({
  isOpen,
  onClose,
  trip,
  members,
  activeCurrency,
  showInDest,
  destCurrency,
  existingExpense
}: {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  members: any[];
  activeCurrency: string;
  showInDest: boolean;
  destCurrency: string;
  existingExpense?: Expense;
}) {
  const { mutateAsync: saveExp, isPending } = useSaveExpense();
  const isSolo = members.length <= 1;
  const isEditing = !!existingExpense;

  const [amountInput, setAmountInput] = useState(
  existingExpense ? String(existingExpense.amount) : ""
);

const [expenseCurrency, setExpenseCurrency] = useState("INR");
  const [dateInput, setDateInput] = useState(
    existingExpense ? existingExpense.date : format(new Date(), 'yyyy-MM-dd')
  );
  const [payerId, setPayerId] = useState(
  existingExpense?.payerId || members[0]?.id || '');
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
  setAmountInput(String(existingExpense.amount));
  setDateInput(existingExpense.date);
  setPayerId(existingExpense.payerId || members[0]?.id|| '');
  setNotesInput(existingExpense.notes || '');

  setSelectedMemberIds(
    existingExpense.split?.map(s => s.memberId) ||
      members.map(m => m.id)
  );

  setSplitAmounts(
    existingExpense.split?.reduce(
      (acc, s) => ({
        ...acc,
        [s.memberId]: String(s.amount),
      }),
      {}
    ) || {}
  );

  setShowSplit(
    !!existingExpense.split &&
      existingExpense.split.length > 0
  );

  const amounts =
  existingExpense.split?.map(s => s.amount) || [];

if (amounts.length > 0) {
  const total = amounts.reduce(
    (sum, value) => sum + value,
    0
  );

  const expected = total / amounts.length;

  const allEqual = amounts.every(
    value => Math.abs(value - expected) <= 0.01
  );

  setSplitMode(
    allEqual ? "equal" : "unequal"
  );
}
} else {
  setAmountInput('');
  setDateInput(format(new Date(), 'yyyy-MM-dd'));
  setPayerId(members[0]?.id || '');
  setNotesInput('');
  setShowSplit(false);
  setSplitMode('equal');
  setSelectedMemberIds(members.map(m => m.id));
  setSplitAmounts({});
}
}, [existingExpense, isOpen]);
 const updateSplitAmount = (
  memberId: string,
  value: string
) => {
  const total = parseFloat(amountInput) || 0;

  const next = {
    ...splitAmounts,
    [memberId]: value,
  };

  if (selectedMemberIds.length < 2) {
    setSplitAmounts(next);
    return;
  }

  const lastMember =
    selectedMemberIds[selectedMemberIds.length - 1];

  if (memberId === lastMember) {
    setSplitAmounts(next);
    return;
  }

  let used = 0;

  selectedMemberIds.forEach(id => {
    if (id !== lastMember) {
      used += parseFloat(next[id] || '0');
    }
  });

  next[lastMember] = String(
    Math.max(
      0,
      Math.round((total - used) * 100) / 100
    )
  );

  setSplitAmounts(next);
};
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
   let amount = parseFloat(amountInput);

if (expenseCurrency !== 'INR') {

      const rate = RATES_PER_INR[destCurrency] || 1;
      amount = amount / rate;
    }
    if (!amount || amount <= 0) { notify('Enter a valid amount', 'error'); return; }

    const date = dateInput;
    const title = fd.get('title') as string;
    const category = fd.get('category') as ExpenseCategory;

    // Build split
    let split:
  | {
      memberId: string;
      memberName: string;
      amount: number;
    }[]
  | undefined;
    if (!isSolo && showSplit) {
      const involved = selectedMemberIds;
      if (involved.length === 0) { notify('Select at least one member', 'error'); return; }
      if (splitMode === 'equal') {
        split = splitEqually(amount, involved).map(share => ({
          ...share,
          memberName: members.find(m => m.id === share.memberId)?.name || "",
        }));
      } else {
        const rate =
  expenseCurrency !== 'INR'
    ? RATES_PER_INR[
        destCurrency
      ] || 1
    : 1;

const parts = involved.map(mid => {
  let val = parseFloat(splitAmounts[mid] || '0');

  if (expenseCurrency !== 'INR') {
    val = val / rate;
  }

  return {
  memberId: mid,
  memberName:
    members.find(m => m.id === mid)?.name || "",
  amount: isNaN(val) ? 0 : val,
};
});
        const total = parts.reduce((s, p) => s + p.amount, 0);
        if (Math.abs(total - amount) > 1) { notify(`Split total (₹${total}) must equal expense (₹${amount})`, 'error'); return; }
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
      payerName:
  members.find(m => m.id === payerId)?.name || "",
      notes: notesInput || undefined,
      split: showSplit ? split : undefined,
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
          <Label htmlFor="amount">
  Amount ({expenseCurrency})
</Label>
          {destCurrency !== 'INR' && (
  <button
    type="button"
    onClick={() =>
      setExpenseCurrency(prev =>
        prev === 'INR' ? destCurrency : 'INR'
      )
    }
    className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-full text-xs font-bold mb-3"
  >
    <ArrowLeftRight className="w-3 h-3" />
    {expenseCurrency}
  </button>
)}
          
          <Input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0.00" required
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
              <div className={cn("w-10 h-6 rounded-full transition relative", showSplit ? "bg-primary" : "bg-muted")}>
                <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-[left]", showSplit ? "left-5" : "left-1")} />
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
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-muted shrink-0">
                          <img
                            src={getAvatarUrl(m.avatar, 48)}
                            alt=""
                            className="w-full h-full"
                          />
                        </div>
                          <span className="text-sm font-medium text-foreground">{m.name}</span>
                          {splitMode === 'unequal' && isSelected && (
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Amount"
                              value={splitAmounts[m.id] || ''}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                              e.stopPropagation();
                              updateSplitAmount(m.id, e.target.value);
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
        {isEditing && existingExpense && <DeleteExpense expense={existingExpense} onDone={onClose} />}
      </form>
    </BottomSheet>
  );
}
