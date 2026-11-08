import { prisma } from "../lib/prisma.js";
import {
  compareIngredients,
  compareSteps,
} from "./recipe-compare.rules.js";

export const compareMyFork = async (
  forkId: string,
  userId: string
) => {
  // Ambil Fork yang benar-benar dimiliki pengguna.
  const fork = await prisma.recipe.findFirst({
    where: {
      id: forkId,
      authorId: userId,
      parentRecipeId: { not: null },
    },
    include: {
      ingredients: {
        orderBy: { position: "asc" },
      },
      steps: {
        orderBy: { position: "asc" },
      },
      parentRecipe: {
        include: {
          ingredients: {
            orderBy: { position: "asc" },
          },
          steps: {
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  // Tidak ada Fork, bukan pemilik, atau bukan resep hasil Fork.
  if (!fork || !fork.parentRecipe) {
    return null;
  }

  const original = fork.parentRecipe;

  // Bandingkan isi original dengan isi Fork.
  const ingredients = compareIngredients(
    original.ingredients,
    fork.ingredients
  );

  const steps = compareSteps(
    original.steps,
    fork.steps
  );

  return {
    original: {
      id: original.id,
      title: original.title,
      status: original.status,
    },
    fork: {
      id: fork.id,
      title: fork.title,
      status: fork.status,
      experimentGoal: fork.experimentGoal,
      experimentResult: fork.experimentResult,
      experimentStatus: fork.experimentStatus,
    },
    ingredients,
    steps,
  };
};
