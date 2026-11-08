
import { prisma } from "../lib/prisma.js";


export const listRecipes = async () => {
  const recipes = await prisma.recipe.findMany({
    where: {
      status: "PUBLISHED",
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  return recipes;
};


export const addRecipe = async (
  title: string,
  authorId: string
) => {
  const newRecipe = await prisma.recipe.create({
    data: {
      title: title,
      status: "DRAFT",
      author: {
        connect: {
          id: authorId,
        },
      },
    },
  });

  return newRecipe;
};

export const listRecipesByAuthor = async (authorId: string) => {
  const recipes = await prisma.recipe.findMany({
    where: {
      authorId: authorId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  return recipes;
};
