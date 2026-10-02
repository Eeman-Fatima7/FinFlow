"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useMemo } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import {
  baseCategories,
  validateCategoryName,
  normalizeCategoryName,
  getCategoryColor as getColor,
  type CategoryMeta,
} from "@/lib/categories";

interface ApiCategory {
  category_id: number;
  name: string;
  type: "income" | "expense" | string;
  icon: string | null;
  color: string | null;
}

interface CategoriesResponse {
  categories: ApiCategory[];
}

interface CategoriesContextType {
  categories: string[];
  customCategories: string[];
  categoryMeta: Record<string, CategoryMeta>;
  addCategory: (name: string, meta?: CategoryMeta) => Promise<{ success: boolean; error?: string }>;
  ensureCategory: (name: string) => Promise<void>;
  getCategoryColor: (name: string) => string;
  getAllCategories: () => string[];
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);

  const categoryMeta = useMemo(() => {
    const meta: Record<string, CategoryMeta> = {};

    apiCategories.forEach((category) => {
      if (category.color || category.icon) {
        meta[category.name] = {
          ...(category.color ? { color: category.color } : {}),
          ...(category.icon ? { icon: category.icon } : {}),
        };
      }
    });

    return meta;
  }, [apiCategories]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    [...baseCategories, ...apiCategories.map((category) => category.name)].forEach((name) => {
      const normalized = normalizeCategoryName(name);
      if (normalized) names.add(normalized);
    });

    return Array.from(names);
  }, [apiCategories]);

  const customCategories = useMemo(() => {
    const baseSet = new Set(baseCategories.map((category) => category.toLowerCase()));
    return categories.filter((category) => !baseSet.has(category.toLowerCase()));
  }, [categories]);

  useEffect(() => {
    let active = true;

    const fetchCategories = async () => {
      try {
        const response = await apiRequest<CategoriesResponse>("/categories", {
          method: "GET",
          auth: true,
        });

        if (active) {
          setApiCategories(response.categories || []);
        }
      } catch {
        if (active) {
          setApiCategories([]);
        }
      }
    };

    fetchCategories();

    return () => {
      active = false;
    };
  }, []);

  // Get all categories (base + api)
  // Add a new custom category
  const addCategory = async (name: string, meta?: CategoryMeta): Promise<{ success: boolean; error?: string }> => {
    const normalized = normalizeCategoryName(name);
    const allCategories = categories;

    const validation = validateCategoryName(normalized, allCategories);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const response = await apiRequest<{ category: ApiCategory }>("/categories", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          name: normalized,
          type: "expense",
          icon: meta?.icon,
          color: meta?.color,
        }),
      });

      if (response.category) {
        setApiCategories((prev) => {
          const exists = prev.some((category) => category.name.toLowerCase() === response.category.name.toLowerCase());
          if (exists) return prev;
          return [...prev, response.category];
        });
      } else {
        setApiCategories((prev) => {
          const fallback: ApiCategory = {
            category_id: Date.now(),
            name: normalized,
            type: "expense",
            icon: meta?.icon || null,
            color: meta?.color || null,
          };
          const exists = prev.some((category) => category.name.toLowerCase() === normalized.toLowerCase());
          if (exists) return prev;
          return [...prev, fallback];
        });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: "Failed to create category" };
    }

    return { success: true };
  };

  // Ensure a category exists (used for imported transactions)
  const ensureCategory = async (name: string): Promise<void> => {
    const normalized = normalizeCategoryName(name);

    const exists = categories.some(cat => cat.toLowerCase() === normalized.toLowerCase());
    if (exists) return;

    await addCategory(normalized);
  };

  // Get color for a category
  const getCategoryColor = (name: string): string => {
    return getColor(name, categoryMeta);
  };

  const value: CategoriesContextType = {
    categories,
    customCategories,
    categoryMeta,
    addCategory,
    ensureCategory,
    getCategoryColor,
    getAllCategories: () => categories,
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
