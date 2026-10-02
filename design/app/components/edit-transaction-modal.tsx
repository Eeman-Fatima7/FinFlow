import { motion, AnimatePresence } from "motion/react";
import { X, Calendar } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState, useEffect } from "react";
import { CategorySelect } from "./category-select";

type Transaction = {
  id: number;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  status: string;
  color: string;
  source?: string;
  notes?: string;
};

type EditTransactionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onUpdate: (updated: Transaction) => void;
};

export function EditTransactionModal({
  open,
  onOpenChange,
  transaction,
  onUpdate,
}: EditTransactionModalProps) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("completed");
  const [notes, setNotes] = useState("");

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      setMerchant(transaction.merchant);
      setAmount(Math.abs(transaction.amount).toString());
      setCategory(transaction.category);
      
      // Convert date from "Feb 14, 2026" to "2026-02-14" for input
      const parsedDate = new Date(transaction.date);
      const isoDate = parsedDate.toISOString().split('T')[0];
      setDate(isoDate);
      
      setStatus(transaction.status);
      setNotes(transaction.notes || "");
    }
  }, [transaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!transaction) return;

    // Validate
    if (!merchant.trim()) {
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    if (!category) {
      return;
    }

    if (!date) {
      return;
    }

    // Format date back to "Feb 14, 2026" format
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // Preserve the sign (expense is negative)
    const finalAmount = transaction.amount < 0 ? -amountNum : amountNum;

    // Create updated transaction with all fields
    const updatedTransaction: Transaction = {
      ...transaction,
      merchant: merchant.trim(),
      amount: finalAmount,
      category,
      date: formattedDate,
      status,
      notes: notes.trim() || undefined,
    };

    onUpdate(updatedTransaction);

    onOpenChange(false);
  };

  if (!transaction) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-lg max-h-[90dvh] rounded-3xl border-2 flex flex-col overflow-hidden">
              <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="shrink-0 bg-background border-b px-6 py-4 rounded-t-3xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">Edit Transaction</h2>
                      <p className="text-sm text-foreground/60 mt-1">Update transaction details</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onOpenChange(false)}
                      className="rounded-xl"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6 scrollbar-hide">
                  <div className="space-y-5">
                    {/* Merchant */}
                    <div className="space-y-2">
                      <Label htmlFor="merchant">Merchant / Description</Label>
                      <Input
                        id="merchant"
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        placeholder="Enter merchant name"
                        className="rounded-xl"
                        required
                      />
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="rounded-xl"
                        required
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <CategorySelect
                        value={category}
                        onValueChange={setCategory}
                        required
                      />
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <div className="relative">
                        <Input
                          id="date"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="rounded-xl"
                          required
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 pointer-events-none" />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <select
                        id="status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                        required
                      >
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>

                    {/* Payment Method (read-only) */}
                    {transaction.source === "Cash" && (
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <div className="px-4 py-3 rounded-xl bg-accent/30 border border-border text-foreground/60 flex items-center gap-2">
                          <span>💵 Cash</span>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (optional)</Label>
                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 bg-background border-t px-6 py-4 rounded-b-3xl flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 rounded-xl"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}