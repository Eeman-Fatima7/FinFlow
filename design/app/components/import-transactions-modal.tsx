import { useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Upload, Download, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useCategories } from "../providers/categories-provider";

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

type ImportTransactionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (transactions: Transaction[]) => void;
};

// Simple CSV parser that handles quoted values
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  const rows = text.split(/\r?\n/);
  
  for (const row of rows) {
    if (!row.trim()) continue;
    
    const cols: string[] = [];
    let currentCol = "";
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          // Escaped quote
          currentCol += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of column
        cols.push(currentCol.trim());
        currentCol = "";
      } else {
        currentCol += char;
      }
    }
    
    // Add last column
    cols.push(currentCol.trim());
    lines.push(cols);
  }
  
  return lines;
}

function downloadTemplate() {
  const template = `Date,Merchant,Category,Amount,Status,PaymentMethod,Notes
Feb 15, 2026,Example Store,Shopping,-45.99,completed,Bank,Example transaction
Feb 14, 2026,Salary Deposit,Income,4200.00,completed,Bank,Monthly salary`;
  
  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "finflow-import-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  toast.success("Template downloaded");
}

export function ImportTransactionsModal({ open, onOpenChange, onImport }: ImportTransactionsModalProps) {
  const { getCategoryColor, ensureCategory } = useCategories();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<string[][] | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please select a CSV file");
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      
      if (parsed.length < 2) {
        toast.error("CSV file is empty or invalid");
        return;
      }

      setParsedData(parsed);
      
      // Create preview
      const headers = parsed[0].map(h => h.toLowerCase().trim());
      const dataRows = parsed.slice(1, 6); // First 5 rows for preview
      
      const preview = dataRows.map(row => {
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = row[i] || "";
        });
        return obj;
      });
      
      setPreviewRows(preview);
      toast.success(`Loaded ${parsed.length - 1} rows from CSV`);
    };

    reader.onerror = () => {
      toast.error("Failed to read file");
    };

    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!parsedData || parsedData.length < 2) {
      toast.error("No data to import");
      return;
    }

    const headers = parsedData[0].map(h => h.toLowerCase().trim());
    
    // Check required columns
    const required = ["date", "merchant", "category", "amount"];
    const missing = required.filter(r => !headers.includes(r));
    
    if (missing.length > 0) {
      toast.error(`CSV missing required columns: ${missing.join(", ")}`);
      return;
    }

    // Map column indices
    const dateIdx = headers.indexOf("date");
    const merchantIdx = headers.indexOf("merchant");
    const categoryIdx = headers.indexOf("category");
    const amountIdx = headers.indexOf("amount");
    const statusIdx = headers.indexOf("status");
    const paymentMethodIdx = headers.indexOf("paymentmethod");
    const notesIdx = headers.indexOf("notes");

    // Parse rows
    const transactions: Transaction[] = [];
    let skipped = 0;

    for (let i = 1; i < parsedData.length; i++) {
      const row = parsedData[i];
      
      // Skip empty rows
      if (row.every(cell => !cell.trim())) {
        skipped++;
        continue;
      }

      try {
        const merchant = row[merchantIdx]?.trim();
        const category = row[categoryIdx]?.trim();
        const amountStr = row[amountIdx]?.trim();
        const date = row[dateIdx]?.trim();

        if (!merchant || !category || !amountStr || !date) {
          skipped++;
          continue;
        }

        // Parse amount
        const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ""));
        if (isNaN(amount)) {
          skipped++;
          continue;
        }

        // Get payment method and determine source
        const paymentMethod = paymentMethodIdx >= 0 ? row[paymentMethodIdx]?.trim() : "Bank";
        const isCash = paymentMethod.toLowerCase() === "cash";

        const transaction: Transaction = {
          id: Date.now() + i, // Temporary ID, will be replaced
          date,
          merchant,
          category,
          amount,
          status: statusIdx >= 0 ? row[statusIdx]?.trim() || "completed" : "completed",
          color: getCategoryColor(category),
          source: isCash ? "Cash" : undefined,
          notes: notesIdx >= 0 ? row[notesIdx]?.trim() : undefined,
        };

        transactions.push(transaction);
      } catch (err) {
        skipped++;
      }
    }

    if (transactions.length === 0) {
      toast.error("No valid transactions found in CSV");
      return;
    }

    onImport(transactions);
    
    if (skipped > 0) {
      toast.success(`Imported ${transactions.length} transactions (${skipped} skipped)`);
    } else {
      toast.success(`Imported ${transactions.length} transactions`);
    }

    // Reset state
    setSelectedFile(null);
    setParsedData(null);
    setPreviewRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setParsedData(null);
    setPreviewRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto scrollbar-clean">
        <SheetHeader>
          <SheetTitle>Import Transactions</SheetTitle>
          <SheetDescription>Upload a CSV file to add transactions</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Template download */}
          <div className="bg-accent/50 rounded-2xl p-4 border-2 border-dashed">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium mb-1">Need a template?</h4>
                <p className="text-sm text-foreground/60 mb-3">
                  Download our CSV template with the correct format
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={downloadTemplate}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>

          {/* File uploader */}
          <div>
            <label className="text-sm font-medium mb-3 block">Upload CSV File</label>
            <div
              className="border-2 border-dashed rounded-2xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                <Upload className="w-8 h-8 text-foreground/40" />
              </div>
              {selectedFile ? (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                  {parsedData && (
                    <p className="text-sm text-foreground/60">
                      {parsedData.length - 1} rows detected
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-medium mb-1">Click to upload CSV</p>
                  <p className="text-sm text-foreground/60">or drag and drop</p>
                </div>
              )}
            </div>
          </div>

          {/* Required format info */}
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">Required Columns:</p>
                <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                  <li>• <strong>Date</strong> - e.g., "Feb 15, 2026"</li>
                  <li>• <strong>Merchant</strong> - Name of merchant/payee</li>
                  <li>• <strong>Category</strong> - Income, Bills, Groceries, etc.</li>
                  <li>• <strong>Amount</strong> - Use negative for expenses (e.g., -45.99)</li>
                </ul>
                <p className="font-medium text-blue-900 dark:text-blue-100 mt-3 mb-1">Optional:</p>
                <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                  <li>• <strong>Status</strong> - defaults to "completed"</li>
                  <li>• <strong>PaymentMethod</strong> - "Cash" or "Bank" (defaults to Bank)</li>
                  <li>• <strong>Notes</strong> - Additional information</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Preview */}
          {previewRows.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-3 block">Preview (first 5 rows)</label>
              <div className="border-2 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto scrollbar-clean">
                  <table className="w-full text-sm">
                    <thead className="bg-accent/50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Merchant</th>
                        <th className="text-left p-3 font-medium">Category</th>
                        <th className="text-right p-3 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-3">{row.date || "-"}</td>
                          <td className="p-3">{row.merchant || "-"}</td>
                          <td className="p-3">{row.category || "-"}</td>
                          <td className="p-3 text-right">
                            {row.amount ? `$${Math.abs(parseFloat(row.amount)).toFixed(2)}` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-4">
            <Button
              className="w-full rounded-xl"
              onClick={handleImport}
              disabled={!parsedData || parsedData.length < 2}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Transactions
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}