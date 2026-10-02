import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Upload, 
  Download, 
  Search, 
  Filter,
  Calendar,
  Tag,
  DollarSign,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ManualCashEntryModal } from "@/components/manual-cash-entry-modal";
import { ImportTransactionsModal } from "@/components/import-transactions-modal";
import { EditTransactionModal } from "@/components/edit-transaction-modal";
import { toast } from "sonner";
import { useCategories } from "@/components/providers/categories-provider";

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

const initialTransactions: Transaction[] = [
  { id: 1, date: "Feb 14, 2026", merchant: "Whole Foods Market", category: "Groceries", amount: -87.32, status: "completed", color: "#67e8f9" },
  { id: 2, date: "Feb 14, 2026", merchant: "Spotify Premium", category: "Subscriptions", amount: -15.99, status: "completed", color: "#c084fc" },
  { id: 3, date: "Feb 13, 2026", merchant: "Acme Corp", category: "Income", amount: 4200.00, status: "completed", color: "#86efac" },
  { id: 4, date: "Feb 12, 2026", merchant: "Pacific Gas & Electric", category: "Bills", amount: -142.50, status: "completed", color: "#c084fc" },
  { id: 5, date: "Feb 11, 2026", merchant: "Amazon", category: "Shopping", amount: -45.20, status: "completed", color: "#f9a8d4" },
  { id: 6, date: "Feb 10, 2026", merchant: "Starbucks", category: "Food & Drink", amount: -8.45, status: "completed", color: "#67e8f9" },
  { id: 7, date: "Feb 10, 2026", merchant: "Shell Gas Station", category: "Transportation", amount: -52.00, status: "completed", color: "#f9a8d4" },
  { id: 8, date: "Feb 9, 2026", merchant: "Netflix", category: "Subscriptions", amount: -18.99, status: "completed", color: "#c084fc" },
  { id: 9, date: "Feb 8, 2026", merchant: "Target", category: "Shopping", amount: -134.76, status: "completed", color: "#f9a8d4" },
  { id: 10, date: "Feb 7, 2026", merchant: "Planet Fitness", category: "Health", amount: -29.99, status: "completed", color: "#93c5fd" },
];

export function Transactions() {
  const { categories: allCategories, getCategoryColor } = useCategories();
  const [transactionsData, setTransactionsData] = useState<Transaction[]>(initialTransactions);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Filter state
  const [draftFilters, setDraftFilters] = useState({
    datePreset: "all" as "7d" | "30d" | "3m" | "1y" | "all",
    minAmount: "",
    maxAmount: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);

  // Build categories for chips (All + actual categories)
  const categoryChips = ["All", ...allCategories];

  const filteredTransactions = transactionsData.filter(t => {
    const matchesSearch = t.merchant.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || t.category === selectedCategory;
    
    // Date filter
    let matchesDate = true;
    if (appliedFilters.datePreset !== "all") {
      const txnDate = new Date(t.date);
      const today = new Date();
      const daysAgo = {
        "7d": 7,
        "30d": 30,
        "3m": 90,
        "1y": 365,
      }[appliedFilters.datePreset];
      
      const cutoffDate = new Date(today);
      cutoffDate.setDate(today.getDate() - daysAgo);
      matchesDate = txnDate >= cutoffDate;
    }
    
    // Amount filter
    let matchesAmount = true;
    const absAmount = Math.abs(t.amount);
    if (appliedFilters.minAmount !== "") {
      const min = parseFloat(appliedFilters.minAmount);
      if (!isNaN(min)) {
        matchesAmount = matchesAmount && absAmount >= min;
      }
    }
    if (appliedFilters.maxAmount !== "") {
      const max = parseFloat(appliedFilters.maxAmount);
      if (!isNaN(max)) {
        matchesAmount = matchesAmount && absAmount <= max;
      }
    }
    
    return matchesSearch && matchesCategory && matchesDate && matchesAmount;
  });

  const handleAddCashTransaction = (payload: {
    type: "expense" | "income";
    amount: number;
    merchant: string;
    category: string;
    date: string;
    notes?: string;
  }) => {
    // Format date to match existing format (e.g., "Feb 14, 2026")
    const dateObj = new Date(payload.date);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // Get color based on category
    const color = getCategoryColor(payload.category) || "#93c5fd";

    // Create new transaction
    const newTransaction: Transaction = {
      id: Math.max(...transactionsData.map(t => t.id), 0) + 1,
      date: formattedDate,
      merchant: payload.merchant,
      category: payload.category,
      amount: payload.type === "expense" ? -payload.amount : payload.amount,
      status: "completed",
      color: color,
      source: "Cash",
      notes: payload.notes,
    };

    // Prepend to transactions list
    setTransactionsData(prev => [newTransaction, ...prev]);
    toast.success("Cash transaction added successfully! 💵");
  };

  const handleExport = () => {
    // Helper to escape CSV values
    const escapeCSV = (value: string | number | undefined): string => {
      if (value === undefined || value === null) return "";
      const str = String(value);
      // If contains comma, quotes, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Convert transactions to CSV
    const headers = ["Date", "Merchant", "Category", "Amount", "Status", "PaymentMethod", "Notes"];
    const rows = filteredTransactions.map(t => [
      escapeCSV(t.date),
      escapeCSV(t.merchant),
      escapeCSV(t.category),
      escapeCSV(t.amount),
      escapeCSV(t.status),
      escapeCSV(t.source === "Cash" ? "Cash" : "Bank"),
      escapeCSV(t.notes || ""),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "finflow-transactions.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredTransactions.length} transactions`);
  };

  return (
    <div className="space-y-6 max-w-[1320px] mx-auto">
      {/* Header actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold mb-1">All Transactions</h2>
          <p className="text-sm text-foreground/60">Track and manage your spending</p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => setManualOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Cash Transaction
          </Button>
        </div>
      </motion.div>

      {/* Search and filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-4 rounded-3xl border-2">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
              <Input 
                placeholder="Search by merchant, category, or amount..." 
                className="pl-10 bg-accent/50 border-0 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className="rounded-xl"
              onClick={() => setFilterOpen(true)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Category chips */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            {categoryChips.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary'
                    : 'bg-accent text-foreground/70 hover:bg-accent/80'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Transactions table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="rounded-3xl border-2 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent/50 border-b">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-foreground/70">Date</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground/70">Merchant</th>
                  <th className="text-left p-4 text-sm font-medium text-foreground/70">Category</th>
                  <th className="text-right p-4 text-sm font-medium text-foreground/70">Amount</th>
                  <th className="text-right p-4 text-sm font-medium text-foreground/70">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filteredTransactions.map((transaction, index) => (
                    <motion.tr
                      key={transaction.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => setSelectedTransaction(transaction)}
                      className="border-b hover:bg-accent/30 cursor-pointer transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="text-sm">{transaction.date}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                            style={{ backgroundColor: transaction.color }}
                          >
                            {transaction.merchant.charAt(0)}
                          </div>
                          <span className="font-medium">{transaction.merchant}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent">
                            {transaction.category}
                          </span>
                          {transaction.source === "Cash" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#dcfce7] text-[#16a34a]">
                              💵 Cash
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className={`text-lg font-semibold ${transaction.amount > 0 ? 'text-[#16a34a]' : 'text-foreground'}`}>
                          {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#dcfce7] text-[#16a34a]">
                          {transaction.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                <Search className="w-8 h-8 text-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-sm text-foreground/60">Try adjusting your search or filters</p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Transaction detail drawer */}
      <Sheet open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden p-0 gap-0">
          <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
            <SheetTitle>Transaction Details</SheetTitle>
            <SheetDescription>View and edit transaction information</SheetDescription>
          </SheetHeader>

          {selectedTransaction && (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6 scrollbar-hide">
                <div className="space-y-6">
                  <div className="flex items-center justify-center">
                    <div 
                      className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-white text-3xl"
                      style={{ backgroundColor: selectedTransaction.color }}
                    >
                      {selectedTransaction.merchant.charAt(0)}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className={`text-4xl font-bold mb-2 break-words ${selectedTransaction.amount > 0 ? 'text-[#16a34a]' : 'text-foreground'}`}>
                      {selectedTransaction.amount > 0 ? '+' : ''}${Math.abs(selectedTransaction.amount).toFixed(2)}
                    </div>
                    <div className="text-lg font-medium break-words">{selectedTransaction.merchant}</div>
                    <div className="text-sm text-foreground/60 mt-1">{selectedTransaction.date}</div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-2xl">
                      <Tag className="w-5 h-5 text-foreground/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground/60 mb-1">Category</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium break-words">{selectedTransaction.category}</span>
                          {selectedTransaction.source === "Cash" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#dcfce7] text-[#16a34a] whitespace-nowrap">
                              💵 Cash
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-2xl">
                      <Calendar className="w-5 h-5 text-foreground/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground/60 mb-1">Date</div>
                        <div className="font-medium break-words">{selectedTransaction.date}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-2xl">
                      <DollarSign className="w-5 h-5 text-foreground/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground/60 mb-1">Status</div>
                        <div className="font-medium capitalize break-words">{selectedTransaction.status}</div>
                      </div>
                    </div>

                    {selectedTransaction.notes && (
                      <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-2xl">
                        <Tag className="w-5 h-5 text-foreground/60 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-foreground/60 mb-1">Notes</div>
                          <div className="font-medium text-sm break-words">{selectedTransaction.notes}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-6 py-4 border-t bg-background">
                <div className="space-y-3">
                  <Button 
                    className="w-full rounded-xl" 
                    onClick={() => {
                      // Store transaction reference before closing details sheet
                      setTransactionToEdit(selectedTransaction);
                      setSelectedTransaction(null);
                      requestAnimationFrame(() => {
                        setEditOpen(true);
                      });
                    }}
                  >
                    Edit Transaction
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full rounded-xl text-destructive hover:text-destructive" 
                    onClick={() => {
                      // Store transaction reference before closing details sheet
                      setTransactionToDelete(selectedTransaction);
                      setSelectedTransaction(null);
                      requestAnimationFrame(() => {
                        setDeleteOpen(true);
                      });
                    }}
                  >
                    Delete Transaction
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Filter sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden p-0 gap-0 z-50">
          <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
            <SheetTitle>Filter Transactions</SheetTitle>
            <SheetDescription>Refine your transaction view</SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6 scrollbar-hide">
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-3 block">Date Range</label>
                <div className="space-y-2">
                  {[
                    { label: "Last 7 days", value: "7d" as const },
                    { label: "Last 30 days", value: "30d" as const },
                    { label: "Last 3 months", value: "3m" as const },
                    { label: "Last year", value: "1y" as const },
                    { label: "All time", value: "all" as const },
                  ].map((range) => (
                    <button
                      key={range.value}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                        draftFilters.datePreset === range.value
                          ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary font-medium border-2 border-[#86efac]'
                          : 'bg-accent/50 hover:bg-accent text-foreground/70'
                      }`}
                      onClick={() => setDraftFilters(prev => ({ ...prev, datePreset: range.value }))}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">Amount Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    placeholder="Min" 
                    type="number" 
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    className="rounded-xl bg-accent/50"
                    value={draftFilters.minAmount}
                    onChange={(e) => setDraftFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                  />
                  <Input 
                    placeholder="Max" 
                    type="number" 
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    className="rounded-xl bg-accent/50"
                    value={draftFilters.maxAmount}
                    onChange={(e) => setDraftFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-6 py-4 border-t bg-background">
            <div className="space-y-3">
              <Button 
                className="w-full rounded-xl"
                onClick={() => {
                  // Validate min/max
                  const min = parseFloat(draftFilters.minAmount);
                  const max = parseFloat(draftFilters.maxAmount);
                  
                  if (draftFilters.minAmount && draftFilters.maxAmount && !isNaN(min) && !isNaN(max) && min > max) {
                    toast.error("Minimum amount cannot be greater than maximum");
                    return;
                  }
                  
                  setAppliedFilters(draftFilters);
                  setFilterOpen(false);
                  toast.success("Filters applied successfully!");
                }}
              >
                Apply Filters
              </Button>
              <Button 
                variant="outline" 
                className="w-full rounded-xl" 
                onClick={() => {
                  const defaults = { datePreset: "all" as const, minAmount: "", maxAmount: "" };
                  setDraftFilters(defaults);
                  setAppliedFilters(defaults);
                  toast.success("Filters reset!");
                }}
              >
                Reset Filters
              </Button>
              <Button 
                variant="ghost" 
                className="w-full rounded-xl" 
                onClick={() => {
                  setDraftFilters(appliedFilters);
                  setFilterOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Manual Cash Entry Modal */}
      <ManualCashEntryModal
        open={manualOpen}
        onOpenChange={setManualOpen}
        onCreate={handleAddCashTransaction}
      />

      {/* Import Transactions Modal */}
      <ImportTransactionsModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onPreviewReady={() => {
          toast.info("Preview flow is only available on the dashboard transactions page");
        }}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        open={editOpen}
        onOpenChange={setEditOpen}
        transaction={transactionToEdit}
        onUpdate={(updatedTransaction) => {
          setTransactionsData(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
          setSelectedTransaction(updatedTransaction);
          toast.success("Transaction updated successfully!");
        }}
      />

      {/* Delete Transaction Modal */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action can't be undone. This will permanently delete the transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (transactionToDelete) {
                  setTransactionsData(prev => prev.filter(t => t.id !== transactionToDelete.id));
                  setSelectedTransaction(null);
                  toast.success("Transaction deleted successfully!");
                }
                setDeleteOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}