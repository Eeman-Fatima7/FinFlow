"use client";

import { useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Upload, Download, FileText, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";
import type { ImportPreviewResponse } from "@/lib/import-types";

type ImportTransactionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreviewReady: (payload: ImportPreviewResponse) => void;
};

function downloadTemplate() {
  const template = `Date,Merchant,Description,Amount,Direction,Category,Status,ReferenceId,Notes
2026-02-15,Example Store,POS Purchase,-45.99,debit,Shopping,completed,ABC123,Example transaction
2026-02-14,Salary Deposit,Salary credit,4200.00,credit,Salary,completed,SALARYFEB,Monthly salary`;

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

export function ImportTransactionsModal({ open, onOpenChange, onPreviewReady }: ImportTransactionsModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [bankHint, setBankHint] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetImportState = () => {
    setSelectedFile(null);
    setLoadingPreview(false);
    setBankHint("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    resetImportState();
    onOpenChange(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to import");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (bankHint.trim()) {
      formData.append("bank_hint", bankHint.trim());
    }

    setLoadingPreview(true);

    try {
      const payload = await apiRequest<ImportPreviewResponse>("/transactions/import/preview", {
        method: "POST",
        auth: true,
        body: formData,
      });

      onPreviewReady(payload);
      resetImportState();
      onOpenChange(false);

      if (payload.rows.length === 0) {
        toast.error("No rows could be extracted from file");
      } else {
        toast.success(`Preview ready: ${payload.rows.length} rows extracted`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to preview import");
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto scrollbar-clean">
        <SheetHeader>
          <SheetTitle>Import Transactions</SheetTitle>
          <SheetDescription>Upload CSV, PDF, or image and review before saving</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="bg-accent/50 rounded-2xl p-4 border-2 border-dashed">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium mb-1">Need a CSV template?</h4>
                <p className="text-sm text-foreground/60 mb-3">
                  Download a sample format for CSV statements.
                </p>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block">Upload Statement File</label>
            <div
              className="border-2 border-dashed rounded-2xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,text/csv,application/pdf,image/*"
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
                    <span className="font-medium break-all">{selectedFile.name}</span>
                  </div>
                  <p className="text-sm text-foreground/60">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium mb-1">Click to upload file</p>
                  <p className="text-sm text-foreground/60">CSV, PDF, or image statement</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Bank hint (optional)</label>
            <input
              type="text"
              placeholder="e.g., easypaisa, sadapay, myabl"
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
              value={bankHint}
              onChange={(e) => setBankHint(e.target.value)}
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">How import works:</p>
                <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                  <li>• CSV files are parsed natively server-side</li>
                  <li>• PDF/image documents are extracted using AWS Textract</li>
                  <li>• You review and edit rows before final save</li>
                  <li>• Duplicates are flagged before confirm</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <Button className="w-full rounded-xl" onClick={handlePreview} disabled={!selectedFile || loadingPreview}>
              {loadingPreview ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing Preview...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Generate Preview
                </>
              )}
            </Button>
            <Button variant="outline" className="w-full rounded-xl" onClick={handleCancel} disabled={loadingPreview}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
