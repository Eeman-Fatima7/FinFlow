"use client";

import { useState } from "react";
import { useCategories } from "./providers/categories-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

interface CategorySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowAddNew?: boolean;
  options?: string[];
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export function CategorySelect({
  value,
  onValueChange,
  placeholder = "Select category",
  allowAddNew = true,
  options,
  className = "",
  disabled = false,
  required = false,
}: CategorySelectProps) {
  const { categories, addCategory } = useCategories();

  const categoryOptions = options && options.length > 0 ? options : categories;
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    
    if (selectedValue === "__add_new__") {
      setShowCreateDialog(true);
      setNewCategoryName("");
    } else {
      onValueChange(selectedValue);
    }
  };

  const handleCreateCategory = async () => {
    setIsCreating(true);

    const result = await addCategory(newCategoryName);

    if (result.success) {
      toast.success("Category added successfully");
      onValueChange(newCategoryName.trim());
      setShowCreateDialog(false);
      setNewCategoryName("");
    } else {
      toast.error(result.error || "Failed to add category");
    }

    setIsCreating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newCategoryName.trim()) {
      e.preventDefault();
      handleCreateCategory();
    }
  };

  return (
    <>
      <select
        value={value}
        onChange={handleSelectChange}
        disabled={disabled}
        required={required}
        className={`w-full px-3 py-2 rounded-xl bg-accent/50 border border-border focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      >
        <option value="">{placeholder}</option>
        {categoryOptions.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
        {allowAddNew && (
          <option value="__add_new__" className="font-semibold">
            + Add new category...
          </option>
        )}
      </select>

      {/* Create Category Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a custom category to organize your transactions and budgets.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                placeholder="e.g., Pet Care, Hobbies, Tech"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                disabled={isCreating}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewCategoryName("");
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim() || isCreating}
            >
              {isCreating ? "Adding..." : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
