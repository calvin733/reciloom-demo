import type {
  RecipeIngredient,
  RecipeStep,
} from "../generated/prisma/client.js";

type ChangeType =
  | "ADDED"
  | "REMOVED"
  | "MODIFIED"
  | "UNCHANGED";


type IngredientView = {
  position: number;
  name: string;
  quantity: string;
  unit: string;
  note: string | null;
  changeReason: string | null;
  observedEffect: string | null;
};

type StepView = {
  position: number;
  instruction: string;
};

type IngredientChange = {
  type: ChangeType;
  before: IngredientView | null;
  after: IngredientView | null;
};

type StepChange = {
  type: ChangeType;
  before: StepView | null;
  after: StepView | null;
};

// Ubah data Prisma menjadi object yang aman untuk JSON.

const ingredientView = (
  ingredient: RecipeIngredient
): IngredientView => ({
  position: ingredient.position,
  name: ingredient.name,
  quantity: ingredient.quantity.toString(),
  unit: ingredient.unit,
  note: ingredient.note,

  changeReason: ingredient.changeReason,
  observedEffect: ingredient.observedEffect,
});


const stepView = (step: RecipeStep): StepView => ({
  position: step.position,
  instruction: step.instruction,
});

// Nama + satuan dipakai untuk mencocokkan bahan.
const ingredientKey = (ingredient: RecipeIngredient) =>
  JSON.stringify([
    ingredient.name.trim().toLowerCase(),
    ingredient.unit.trim().toLowerCase(),
  ]);

export const compareIngredients = (
  original: RecipeIngredient[],
  fork: RecipeIngredient[]
): IngredientChange[] => {
  const changes: IngredientChange[] = [];

  // Kelompokkan bahan Fork berdasarkan nama dan satuan.
  const forkGroups = new Map<string, RecipeIngredient[]>();

  for (const ingredient of fork) {
    const key = ingredientKey(ingredient);
    const group = forkGroups.get(key) ?? [];
    group.push(ingredient);
    forkGroups.set(key, group);
  }

  // Cocokkan bahan original dengan bahan Fork.
  for (const oldIngredient of original) {
    const key = ingredientKey(oldIngredient);
    const group = forkGroups.get(key) ?? [];
    const newIngredient = group.shift();

    if (!newIngredient) {
      changes.push({
        type: "REMOVED",
        before: ingredientView(oldIngredient),
        after: null,
      });
      continue;
    }

    const modified =
      !oldIngredient.quantity.equals(newIngredient.quantity) ||
      oldIngredient.note !== newIngredient.note;

    changes.push({
      type: modified ? "MODIFIED" : "UNCHANGED",
      before: ingredientView(oldIngredient),
      after: ingredientView(newIngredient),
    });
  }

  // Bahan Fork yang belum terpasangkan berarti bahan baru.
  for (const group of forkGroups.values()) {
    for (const ingredient of group) {
      changes.push({
        type: "ADDED",
        before: null,
        after: ingredientView(ingredient),
      });
    }
  }

  return changes;
};

export const compareSteps = (
  original: RecipeStep[],
  fork: RecipeStep[]
): StepChange[] => {
  const changes: StepChange[] = [];

  const originalMap = new Map(
    original.map((step) => [step.position, step])
  );

  const forkMap = new Map(
    fork.map((step) => [step.position, step])
  );

  // Gabungkan semua posisi langkah.
  const positions = [
    ...new Set([...originalMap.keys(), ...forkMap.keys()]),
  ].sort((a, b) => a - b);

  for (const position of positions) {
    const oldStep = originalMap.get(position);
    const newStep = forkMap.get(position);

    if (!oldStep && newStep) {
      changes.push({
        type: "ADDED",
        before: null,
        after: stepView(newStep),
      });
    } else if (oldStep && !newStep) {
      changes.push({
        type: "REMOVED",
        before: stepView(oldStep),
        after: null,
      });
    } else if (oldStep && newStep) {
      changes.push({
        type:
          oldStep.instruction === newStep.instruction
            ? "UNCHANGED"
            : "MODIFIED",
        before: stepView(oldStep),
        after: stepView(newStep),
      });
    }
  }

  return changes;
};
