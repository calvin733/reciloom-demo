
import { prisma } from "../lib/prisma.js";
import { getPublishIssues } from "./recipe-publication.rules.js";

// Relasi yang ingin ditampilkan pada Recipe Detail
const detailInclude = {
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
} as const;

// Detail resep untuk pengunjung publik
export const findPublicRecipeDetail = async (recipeId: string) => {
  return prisma.recipe.findFirst({
    where: {
      id: recipeId,
      status: "PUBLISHED",
    },
    include: detailInclude,
  });
};

// Detail resep pribadi user
export const findMyRecipeDetail = async (
  recipeId: string,
  userId: string
) => {
  return prisma.recipe.findFirst({
    where: {
      id: recipeId,
      authorId: userId,
    },
    include: detailInclude,
  });
};


export const checkPublishReadiness = async (
  recipeId: string,
  userId: string
) => {
  const recipe = await findMyRecipeDetail(
    recipeId,
    userId
  );

  if (!recipe) {
    return null;
  }

  const issues = getPublishIssues(recipe);

  return {
    recipeId: recipe.id,
    status: recipe.status,
    readyToPublish: issues.length === 0,
    issues,
  };
};
