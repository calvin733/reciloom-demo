import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

import {
  getPublishIssues,
  type PublishIssue,
} from "./recipe-publication.rules.js";

type PublishErrorReason =
  | "NOT_FOUND"
  | "ALREADY_PUBLISHED"
  | "INCOMPLETE"
  | "CONFLICT";

export class PublishRecipeError extends Error {
  constructor(
    public readonly reason: PublishErrorReason,
    public readonly issues: PublishIssue[] = []
  ) {
    super(reason);
  }
}

export const publishDraftRecipe = async (
  recipeId: string,
  userId: string
) => {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // 1. Ambil data terbaru milik pengguna
        const recipe = await tx.recipe.findFirst({
          where: {
            id: recipeId,
            authorId: userId,
          },
          include: {
            ingredients: true,
            steps: true,
          },
        });

        if (!recipe) {
          throw new PublishRecipeError("NOT_FOUND");
        }

        // 2. Hanya Draft yang boleh dipublikasikan
        if (recipe.status !== "DRAFT") {
          throw new PublishRecipeError("ALREADY_PUBLISHED");
        }

        // 3. Validasi konten terbaru
        const issues = getPublishIssues(recipe);

        if (issues.length > 0) {
          throw new PublishRecipeError("INCOMPLETE", issues);
        }

        // 4. Ubah status hanya jika masih Draft
        const updated = await tx.recipe.updateMany({
          where: {
            id: recipeId,
            authorId: userId,
            status: "DRAFT",
          },
          data: {
            status: "PUBLISHED",
          },
        });

        if (updated.count !== 1) {
          throw new PublishRecipeError("CONFLICT");
        }

        // 5. Kembalikan detail resep terbaru
        return tx.recipe.findUniqueOrThrow({
          where: {
            id: recipeId,
          },
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
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
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new PublishRecipeError("CONFLICT");
    }

    throw error;
  }
};
