// Global Categories Store - Single Source of Truth

// Base categories that ship with FinFlow
export const baseCategories = [
  "Income",
  "Bills",
  "Groceries",
  "Subscriptions",
  "Shopping",
  "Food & Drink",
  "Transportation",
  "Health",
  "Entertainment",
  "Housing",
  "Dining Out",
  "Healthcare",
  "Bills & Utilities",
  "Travel",
  "Education",
  "Personal Care",
  "Gifts",
  "Insurance",
  "Savings",
  "Other"
];

// Pastel color palette for categories
export const categoryColorPalette = [
  "#86efac", // green
  "#c084fc", // purple
  "#67e8f9", // cyan
  "#f9a8d4", // pink
  "#93c5fd", // blue
  "#fda4af", // light pink
  "#fbbf24", // amber
  "#a5b4fc", // indigo
  "#cbd5e1", // slate
  "#d8b4fe", // light purple
];

// Default category colors
export const defaultCategoryColors: Record<string, string> = {
  "Income": "#86efac",
  "Bills": "#c084fc",
  "Groceries": "#67e8f9",
  "Subscriptions": "#c084fc",
  "Shopping": "#f9a8d4",
  "Food & Drink": "#67e8f9",
  "Transportation": "#f9a8d4",
  "Health": "#93c5fd",
  "Entertainment": "#a5b4fc",
  "Housing": "#93c5fd",
  "Dining Out": "#f9a8d4",
  "Healthcare": "#fda4af",
  "Bills & Utilities": "#67e8f9",
  "Travel": "#c084fc",
  "Education": "#a5b4fc",
  "Personal Care": "#fda4af",
  "Gifts": "#f9a8d4",
  "Insurance": "#93c5fd",
  "Savings": "#86efac",
  "Other": "#cbd5e1",
};

// LocalStorage keys
export const STORAGE_KEYS = {
  CUSTOM_CATEGORIES: "finflow.customCategories",
  CATEGORY_META: "finflow.categoryMeta",
} as const;

// Category metadata (color, icon, etc.)
export interface CategoryMeta {
  color?: string;
  icon?: string;
}

// Normalize category name (trim, handle case)
export function normalizeCategoryName(name: string): string {
  return name.trim();
}

// Check if category name is duplicate (case-insensitive)
export function isDuplicate(name: string, existingCategories: string[]): boolean {
  const normalized = normalizeCategoryName(name).toLowerCase();
  return existingCategories.some(cat => cat.toLowerCase() === normalized);
}

// Check if category name is reserved
export function isReservedName(name: string): boolean {
  const normalized = normalizeCategoryName(name).toLowerCase();
  return normalized === "all";
}

// Get color for a category (from defaults or generate from palette)
export function getCategoryColor(
  categoryName: string,
  customMeta?: Record<string, CategoryMeta>
): string {
  // Check if custom color is defined
  if (customMeta && customMeta[categoryName]?.color) {
    return customMeta[categoryName].color!;
  }

  // Check default colors
  if (defaultCategoryColors[categoryName]) {
    return defaultCategoryColors[categoryName];
  }

  // Generate deterministic color from palette
  const hash = categoryName.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  const index = Math.abs(hash) % categoryColorPalette.length;
  return categoryColorPalette[index];
}

// Validate category name
export function validateCategoryName(
  name: string,
  existingCategories: string[]
): { valid: boolean; error?: string } {
  const normalized = normalizeCategoryName(name);

  if (!normalized) {
    return { valid: false, error: "Category name cannot be empty" };
  }

  if (isReservedName(normalized)) {
    return { valid: false, error: '"All" is a reserved name' };
  }

  if (isDuplicate(name, existingCategories)) {
    return { valid: false, error: "This category already exists" };
  }

  if (normalized.length > 50) {
    return { valid: false, error: "Category name is too long (max 50 characters)" };
  }

  return { valid: true };
}

// Load custom categories from localStorage
export function loadCustomCategories(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_CATEGORIES);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.error("Failed to load custom categories:", error);
  }
  return [];
}

// Save custom categories to localStorage
export function saveCustomCategories(categories: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(categories));
  } catch (error) {
    console.error("Failed to save custom categories:", error);
  }
}

// Load category metadata from localStorage
export function loadCategoryMeta(): Record<string, CategoryMeta> {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CATEGORY_META);
    if (stored) {
      const parsed = JSON.parse(stored);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    }
  } catch (error) {
    console.error("Failed to load category metadata:", error);
  }
  return {};
}

// Save category metadata to localStorage
export function saveCategoryMeta(meta: Record<string, CategoryMeta>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORY_META, JSON.stringify(meta));
  } catch (error) {
    console.error("Failed to save category metadata:", error);
  }
}
