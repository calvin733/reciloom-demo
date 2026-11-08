import type {
  Recipe,
  RecipeIngredient,
  RecipeStep,
} from "../generated/prisma/client.js";

type RecipeWithContent = Recipe & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

export type PublishIssue = {
  field: string;
  message: string;
};

export const getPublishIssues = (
  recipe: RecipeWithContent
): PublishIssue[] => {
  const issues: PublishIssue[] = [];

  if (recipe.status !== "DRAFT") {
    issues.push({
      field: "status",
      message: "Recipe is already published.",
    });
  }

  if (recipe.title.trim().length < 3) {
    issues.push({
      field: "title",
      message: "Title must contain at least 3 characters.",
    });
  }

  if (recipe.ingredients.length === 0) {
    issues.push({
      field: "ingredients",
      message: "Add at least one ingredient.",
    });
  }

  if (recipe.steps.length === 0) {
    issues.push({
      field: "steps",
      message: "Add at least one cooking step.",
    });
  }

  if (
    recipe.ingredients.some(
      (ingredient) =>
        !ingredient.name.trim() ||
        !ingredient.unit.trim() ||
        ingredient.quantity.lte(0)
    )
  ) {
    issues.push({
      field: "ingredients",
      message: "Ingredients must have a name, unit and positive quantity.",
    });
  }

  if (
    recipe.steps.some(
      (step) => !step.instruction.trim()
    )
  ) {
    issues.push({
      field: "steps",
      message: "Cooking steps cannot be empty.",
    });
  }

  return issues;
};
