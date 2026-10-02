import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  baseCategories,
  loadCustomCategories,
  saveCustomCategories,
  loadCategoryMeta,
  saveCategoryMeta,
  validateCategoryName,
  normalizeCategoryName,
  getCategoryColor as getColor,
  type CategoryMeta,
} from "../lib/categories";

interface CategoriesContextType {
  categories: string[];
  customCategories: string[];
  categoryMeta: Record<string, CategoryMeta>;
  addCategory: (name: string, meta?: CategoryMeta) => { success: boolean; error?: string };
  ensureCategory: (name: string) => void;
  getCategoryColor: (name: string) => string;
  getAllCategories: () => string[];
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [categoryMeta, setCategoryMeta] = useState<Record<string, CategoryMeta>>({});

  // Load from localStorage on mount
  useEffect(() => {
    const loadedCustom = loadCustomCategories();
    const loadedMeta = loadCategoryMeta();
    setCustomCategories(loadedCustom);
    setCategoryMeta(loadedMeta);
  }, []);

  // Get all categories (base + custom)
  const getAllCategories = (): string[] => {
    return [...baseCategories, ...customCategories];
  };

  // Add a new custom category
  const addCategory = (name: string, meta?: CategoryMeta): { success: boolean; error?: string } => {
    const normalized = normalizeCategoryName(name);
    const allCategories = getAllCategories();

    // Validate
    const validation = validateCategoryName(normalized, allCategories);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Add to custom categories
    const newCustomCategories = [...customCategories, normalized];
    setCustomCategories(newCustomCategories);
    saveCustomCategories(newCustomCategories);

    // Save metadata if provided
    if (meta) {
      const newMeta = { ...categoryMeta, [normalized]: meta };
      setCategoryMeta(newMeta);
      saveCategoryMeta(newMeta);
    }

    return { success: true };
  };

  // Ensure a category exists (used for imported transactions)
  const ensureCategory = (name: string): void => {
    const normalized = normalizeCategoryName(name);
    const allCategories = getAllCategories();

    // Check if already exists (case-insensitive)
    const exists = allCategories.some(cat => cat.toLowerCase() === normalized.toLowerCase());
    if (exists) return;

    // Add it
    addCategory(normalized);
  };

  // Get color for a category
  const getCategoryColor = (name: string): string => {
    return getColor(name, categoryMeta);
  };

  const value: CategoriesContextType = {
    categories: getAllCategories(),
    customCategories,
    categoryMeta,
    addCategory,
    ensureCategory,
    getCategoryColor,
    getAllCategories,
  };

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error("useCategories must be used within a CategoriesProvider");
  }
  return context;
}
