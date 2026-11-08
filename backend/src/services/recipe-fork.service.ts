import { prisma } from "../lib/prisma.js";

export const createRecipeFork = async (
  sourceRecipeId: string,
  userId: string
) => {
  // 1. Ambil resep sumber yang sudah Published
  const sourceRecipe = await prisma.recipe.findFirst({
    where: {
      id: sourceRecipeId,
      status: "PUBLISHED",
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

  // 2. Tolak jika sumber tidak ada atau belum Published
  if (!sourceRecipe) {
    return null;
  }

  // 3. Buat resep Fork yang baru
  const fork = await prisma.recipe.create({
    data: {
      title: `Fork of ${sourceRecipe.title}`.slice(0, 150),
      status: "DRAFT",

      // Pemilik Fork adalah pengguna yang sedang Login
      author: {
        connect: { id: userId },
      },

      // Hubungkan Fork dengan resep original
      parentRecipe: {
        connect: { id: sourceRecipe.id },
      },

      // Salin semua Ingredients menjadi record baru
      ingredients: {
        create: sourceRecipe.ingredients.map((ingredient) => ({
          position: ingredient.position,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          note: ingredient.note,
        })),
      },

      // Salin semua Cooking Steps menjadi record baru
      steps: {
        create: sourceRecipe.steps.map((step) => ({
          position: step.position,
          instruction: step.instruction,
        })),
      },
    },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
        },
      },
      parentRecipe: {
        select: {
          id: true,
          title: true,
        },
      },
      ingredients: {
        orderBy: { position: "asc" },
      },
      steps: {
        orderBy: { position: "asc" },
      },
    },
  });

  return fork;
};
