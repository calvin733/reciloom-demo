import { Prisma } from "../../src/generated/prisma/client.js";
import type { Recipe, RecipeIngredient, RecipeStep } from "../../src/generated/prisma/client.js";

export const recipeId = "11111111-1111-4111-8111-111111111111";

export const ingredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  id: "22222222-2222-4222-8222-222222222222",
  recipeId,
  position: 1,
  name: "Gula",
  quantity: new Prisma.Decimal("100"),
  unit: "g",
  note: null,
  changeReason: null,
  observedEffect: null,
  ...overrides,
});

export const step = (overrides: Partial<RecipeStep> = {}): RecipeStep => ({
  id: "33333333-3333-4333-8333-333333333333",
  recipeId,
  position: 1,
  instruction: "Campur bahan.",
  ...overrides,
});

export const draft = (overrides: Partial<Recipe> = {}): Recipe & { ingredients: RecipeIngredient[]; steps: RecipeStep[] } => ({
  id: recipeId,
  title: "Kue latihan",
  status: "DRAFT",
  createdAt: new Date("2026-11-03T00:00:00Z"),
  authorId: "44444444-4444-4444-8444-444444444444",
  parentRecipeId: null,
  experimentGoal: null,
  experimentResult: null,
  experimentStatus: "NOT_TESTED",
  ...overrides,
  ingredients: [ingredient()],
  steps: [step()],
});
