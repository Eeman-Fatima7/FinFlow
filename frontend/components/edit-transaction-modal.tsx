"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Calendar } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState } from "react";
import { CategorySelect } from "./category-select";

type Transaction = {
  id: number;
  date: string;
  dateIso?: string | null;
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
  categoryOptions?: string[];
  onUpdate: (updated: Transaction) => void;
};

type FormState = {
  merchant: string;
  amount: string;
  category: string;
  date: string;
  status: string;
  notes: string;
};

const toIsoDate = (value?: string | null) => {
  if (!value) return "";

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    return dateOnlyMatch[0];
  }

  const parsedDate = new Date(String(value));
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const buildFormState = (transaction: Transaction): FormState => ({
  merchant: transaction.merchant,
  amount: Math.abs(transaction.amount).toString(),
  category: transaction.category,
  date: toIsoDate(transaction.dateIso || transaction.date),
  status: transaction.status,
  notes: transaction.notes || "",
});

type EditTransactionContentProps = {
  transaction: Transaction;
  categoryOptions?: string[];
  onUpdate: (updated: Transaction) => void;
  onClose: () => void;
};

function EditTransactionContent({
  transaction,
  categoryOptions,
  onUpdate,
  onClose,
}: EditTransactionContentProps) {
  const [form, setForm] = useState<FormState>(() => buildFormState(transaction));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const merchantValue = form.merchant.trim();
    if (!merchantValue) return;

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const categoryValue = form.category;
    if (!categoryValue) return;

    const dateValue = form.date;
    if (!dateValue) return;

    const finalAmount = transaction.amount < 0 ? -amountNum : amountNum;
    const notesValue = form.notes.trim();
    const statusValue = form.status.toLowerCase();

    const updatedTransaction: Transaction = {
      ...transaction,
      merchant: merchantValue,
      amount: finalAmount,
      category: categoryValue,
      dateIso: dateValue,
      date: dateValue,
      status: statusValue,
      source: transaction.source || "Bank",
      notes: notesValue || undefined,
    };

    onUpdate(updatedTransaction);
    onClose();
  };

  return (
    <Card className="w-full max-w-lg max-h-[90dvh] rounded-3xl border-2 flex flex-col overflow-hidden">
      <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
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
              onClick={onClose}
              className="rounded-xl"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6 scrollbar-hide">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant / Description</Label>
              <Input
                id="merchant"
                value={form.merchant}
                onChange={(e) => setForm((prev) => ({ ...prev, merchant: e.target.value }))}
                placeholder="Enter merchant name"
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <CategorySelect
                value={form.category}
                onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                options={categoryOptions}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <div className="relative">
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="rounded-xl"
                  required
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {transaction.source === "Cash" && (
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="px-4 py-3 rounded-xl bg-accent/30 border border-border text-foreground/60 flex items-center gap-2">
                  <span>💵 Cash</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 bg-background border-t px-6 py-4 rounded-b-3xl flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
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
  );
}

export function EditTransactionModal({
  open,
  onOpenChange,
  transaction,
  categoryOptions,
  onUpdate,
}: EditTransactionModalProps) {
  if (!transaction) return null;

  const closeModal = () => {
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/50 z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <EditTransactionContent
              key={transaction.id}
              transaction={transaction}
              categoryOptions={categoryOptions}
              onUpdate={onUpdate}
              onClose={closeModal}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
