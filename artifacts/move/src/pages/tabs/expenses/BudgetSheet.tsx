import { useState, useEffect } from "react";
import { TripBudget } from "@/lib/types";
import { Button, Input, Label, BottomSheet } from "@/components/ui";

// ── Budget Sheet ───────────────────────────────────────────────────────────────
export function BudgetSheet({ isOpen, onClose, current, onSave, activeCurrency }: {
  isOpen: boolean; onClose: () => void; current?: TripBudget; onSave: (b: TripBudget) => void; activeCurrency: string;
}) {
  const [vals, setVals] = useState<TripBudget>(current || { total: 0, transport: 0, food: 0, accommodation: 0, activities: 0, misc: 0 });
  useEffect(() => {
  setVals(
    current || {
      total: 0,
      transport: 0,
      food: 0,
      accommodation: 0,
      activities: 0,
      misc: 0,
    }
  );
}, [current, isOpen]);
  const handleSave = () => {

  onSave(vals);

  onClose();
};

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
