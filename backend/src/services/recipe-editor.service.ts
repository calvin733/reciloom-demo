import { prisma } from "../lib/prisma.js";

import type {
  RecipeEditorInput,
} from "../validators/recipe-editor.schema.js";

export class DraftEditError extends Error {
  constructor(
    public readonly reason: "NOT_FOUND" | "NOT_DRAFT"
  ) {
    super(reason);
  }
}

export const replaceDraftRecipe = async (
  recipeId: string,
  userId: string,
  input: RecipeEditorInput
) => {
  return prisma.$transaction(async (tx) => {
    // 1. Periksa pemilik dan status resep
    const existing = await tx.recipe.findFirst({
      where: {
        id: recipeId,
        authorId: userId,
      },
      select: {
        status: true,
      },
    });

    if (!existing) {
      throw new DraftEditError("NOT_FOUND");
    }

    if (existing.status !== "DRAFT") {
      throw new DraftEditError("NOT_DRAFT");
    }

    // 2. Perbarui judul jika resep masih DRAFT
    const updated = await tx.recipe.updateMany({
      where: {
        id: recipeId,
        authorId: userId,
        status: "DRAFT",
      },
      data: {
        title: input.title,
      },
    });

    if (updated.count !== 1) {
      throw new DraftEditError("NOT_DRAFT");
    }

    // 3. Hapus isi lama
    await tx.recipeIngredient.deleteMany({
      where: { recipeId },
    });

    await tx.recipeStep.deleteMany({
      where: { recipeId },
    });

    // 4. Simpan daftar bahan baru

    // 4. Simpan daftar bahan baru
    if (input.ingredients.length > 0) {
      await tx.recipeIngredient.createMany({
        data: input.ingredients.map((ingredient, index) => ({
          recipeId,
          position: index + 1,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          note: ingredient.note ?? null,

          // Metadata eksperimen bahan
          changeReason: ingredient.changeReason ?? null,
          observedEffect: ingredient.observedEffect ?? null,
        })),
      });
    }


    // 5. Simpan daftar langkah baru
    if (input.steps.length > 0) {
      await tx.recipeStep.createMany({
        data: input.steps.map((step, index) => ({
          recipeId,
          position: index + 1,
          instruction: step.instruction,
        })),
      });
    }

    // 6. Ambil hasil terbaru
    return tx.recipe.findUniqueOrThrow({
      where: {
        id: recipeId,
      },
      include: {
        ingredients: {
          orderBy: { position: "asc" },
        },
        steps: {
          orderBy: { position: "asc" },
        },
      },
    });
  });
};
