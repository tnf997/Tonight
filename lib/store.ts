type RecipeCache = {
  recipes: any[];
  timestamp: number;
} | null;

type PantryCache = {
  items: any[];
  timestamp: number;
} | null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let recipeCache: RecipeCache = null;
let pantryCache: PantryCache = null;

export function getRecipeCache() {
  if (!recipeCache) return null;
  if (Date.now() - recipeCache.timestamp > CACHE_TTL) return null;
  return recipeCache.recipes;
}

export function setRecipeCache(recipes: any[]) {
  recipeCache = { recipes, timestamp: Date.now() };
}

export function invalidateRecipeCache() {
  recipeCache = null;
}

export function getPantryCache() {
  if (!pantryCache) return null;
  if (Date.now() - pantryCache.timestamp > CACHE_TTL) return null;
  return pantryCache.items;
}

export function setPantryCache(items: any[]) {
  pantryCache = { items, timestamp: Date.now() };
}

export function invalidatePantryCache() {
  pantryCache = null;
}