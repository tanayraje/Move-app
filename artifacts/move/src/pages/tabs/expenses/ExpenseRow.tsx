import { useState } from "react";
import { CreditCard, Plane, Train, Bus, Trash2 } from "lucide-react";
import { useDeleteExpense } from "@/hooks/use-store";
import { Expense, ExpenseCategory, TripMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EXPENSE_ICONS, TONES } from "./shared";

// ── Expense row: one quiet line, colour-coded by a small category tile ────────────────────────

export function ExpenseRow({
  expense,
  members,
  money,
  myId,
  onEdit,
}: {
  expense: Expense;
  members: TripMember[];
  money: (n: number) => string;
  myId?: string;
  onEdit: () => void;
}) {
  const cat: ExpenseCategory = TONES[expense.category] ? expense.category : "misc";
  const tone = TONES[cat];
  const title = cat === "settlement" ? expense.title.replace(/^Settlement:\s*/, "") : expense.title;
  // Pick a more specific icon from the title so flights stop showing a car
  const Icon =
    /^flight/i.test(title) ? Plane :
    /^(train|rail)/i.test(title) ? Train :
    /^bus/i.test(title) ? Bus :
    EXPENSE_ICONS[cat] || CreditCard;
  const payer: any = members.find(m => m.id === expense.payerId) || {
    name: expense.payerName || "Unknown User",
  };
  const splitCount = expense.split?.length ?? 0;
  const myShare = myId && splitCount > 1 ? expense.split?.find(sp => sp.memberId === myId)?.amount : undefined;
  const firstName = String(payer.name || "").split(" ")[0];

  // One quiet line: who paid, and how it was split. No avatars, no tile behind the icon.
  const meta = [firstName, splitCount > 1 ? `Split ${splitCount}` : null].filter(Boolean).join(" · ");

  return (
    <button onClick={onEdit} className="flex w-full items-center gap-3.5 px-4 py-3 text-left active:bg-muted/50">
      <Icon className={cn("h-5 w-5 shrink-0", tone.label)} strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-snug">{title}</p>
        <p className="truncate text-[12px] leading-snug text-muted-foreground">{meta}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-[15px] font-semibold tabular-nums", cat === "settlement" && "text-emerald-700")}>{money(expense.amount)}</p>
        {myShare !== undefined && <p className="text-[11px] tabular-nums text-muted-foreground">Yours {money(myShare)}</p>}
      </div>
    </button>
  );
}

export function DeleteExpense({ expense, onDone }: { expense: Expense; onDone: () => void }) {
  const { mutate: deleteExp, isPending } = useDeleteExpense();
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <div className="rounded-2xl bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-700">Delete this expense for everyone on the trip?</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-11 flex-1 rounded-xl bg-card text-sm font-semibold ring-1 ring-border"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => deleteExp({ id: expense.id, tripId: expense.tripId }, { onSuccess: onDone })}
          className="h-11 flex-1 rounded-xl bg-[#dc2626] dark:bg-[#dc2626]/85 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "Deleting" : "Delete"}
        </button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-card text-[15px] font-semibold text-red-600 ring-1 ring-border"
    >
      <Trash2 className="h-4 w-4" />
      Delete expense
    </button>
  );
}
