import React, { useState } from "react";
import { Plus, Coffee, Car, Home, Camera, ShoppingBag, CreditCard, Trash2 } from "lucide-react";
import { useExpenses, useSaveExpense, useDeleteExpense } from "@/hooks/use-store";
import { Trip, Expense, ExpenseCategory } from "@/lib/types";
import { generateId, cn } from "@/lib/utils";
import { Button, Input, Label, Select, BottomSheet, FAB } from "@/components/ui";
import { format } from "date-fns";

const EXPENSE_ICONS: Record<ExpenseCategory, any> = {
  food: Coffee,
  transport: Car,
  hotel: Home,
  activity: Camera,
  shopping: ShoppingBag,
  other: CreditCard,
};

export default function ExpensesTab({ trip }: { trip: Trip }) {
  const { data: expenses = [] } = useExpenses(trip.id);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by date
  const grouped = expenses.sort((a,b) => b.createdAt - a.createdAt).reduce((acc, exp) => {
    const d = format(new Date(exp.date), 'MMM d, yyyy');
    if(!acc[d]) acc[d] = [];
    acc[d].push(exp);
    return acc;
  }, {} as Record<string, Expense[]>);

  return (
    <div className="p-6 h-full relative">
      
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-primary-foreground shadow-xl shadow-primary/20 mb-8">
        <p className="text-primary-foreground/80 font-medium mb-1">Total Trip Cost</p>
        <h2 className="text-5xl font-display font-extrabold tracking-tight">${total.toFixed(2)}</h2>
      </div>

      <div className="space-y-6 pb-20">
        {Object.keys(grouped).length === 0 ? (
           <div className="text-center text-muted-foreground mt-12">
            <p>No expenses tracked yet.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-1">{date}</h3>
              <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden divide-y divide-border/50">
                {items.map(exp => <ExpenseRow key={exp.id} expense={exp} />)}
              </div>
            </div>
          ))
        )}
      </div>

      <FAB icon={Plus} onClick={() => setIsAddOpen(true)} />
      <AddExpenseSheet isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} tripId={trip.id} />
    </div>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const { mutate: deleteExp } = useDeleteExpense();
  const Icon = EXPENSE_ICONS[expense.category];

  return (
    <div className="flex items-center justify-between p-4 group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground/70 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-foreground text-sm">{expense.title}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{expense.category}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display font-bold text-foreground">${expense.amount.toFixed(2)}</span>
        <button 
          onClick={() => { if(confirm('Delete?')) deleteExp({ id: expense.id, tripId: expense.tripId }) }}
          className="text-muted-foreground hover:text-red-500"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AddExpenseSheet({ isOpen, onClose, tripId }: { isOpen: boolean, onClose: () => void, tripId: string }) {
  const { mutateAsync: addExp, isPending } = useSaveExpense();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await addExp({
      id: generateId(),
      tripId,
      title: fd.get('title') as string,
      amount: parseFloat(fd.get('amount') as string),
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
          <Label htmlFor="amount">Amount ($)</Label>
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
            <option value="hotel">Accommodation</option>
            <option value="activity">Activities</option>
            <option value="shopping">Shopping</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <Button type="submit" size="lg" className="mt-4" isLoading={isPending}>
          Save Expense
        </Button>
      </form>
    </BottomSheet>
  );
}
