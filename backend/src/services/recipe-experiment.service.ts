import { prisma } from "../lib/prisma.js";
import type {
  ExperimentInput,
} from "../validators/recipe-experiment.schema.js";

export const updateForkExperiment = async (
  recipeId: string,
  userId: string,
  input: ExperimentInput
) => {
  // 1. Cari Fork milik pengguna.
  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      authorId: userId,
      parentRecipeId: { not: null },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!recipe) {
    return { kind: "NOT_FOUND" } as const;
  }

  // 2. Hanya Draft yang dapat diedit.
  if (recipe.status !== "DRAFT") {
    return { kind: "NOT_DRAFT" } as const;
  }

  // 3. Update metadata dengan syarat kepemilikan
  //    dan status tetap diperiksa di database.
  const result = await prisma.recipe.updateMany({
    where: {
      id: recipeId,
      authorId: userId,
      parentRecipeId: { not: null },
      status: "DRAFT",
    },
    data: {
      experimentGoal: input.experimentGoal,
      experimentResult: input.experimentResult,
      experimentStatus: input.experimentStatus,
    },
  });

  if (result.count !== 1) {
    return { kind: "NOT_DRAFT" } as const;
  }

  // 4. Ambil kembali metadata yang sudah disimpan.
  const saved = await prisma.recipe.findUniqueOrThrow({
    where: { id: recipeId },
    select: {
      id: true,
      title: true,
      status: true,
      parentRecipeId: true,
      experimentGoal: true,
      experimentResult: true,
      experimentStatus: true,
    },
  });

  return {
    kind: "OK",
    data: saved,
  } as const;
};
