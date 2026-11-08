
import type { Request, Response } from "express";

import { listRecipesByAuthor } from "../services/recipe.service.js";

export const getMyRecipes = async (req: Request, res: Response) => {
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).json({
      message: "Authentication required.",
    });
    return;
  }

  const recipes = await listRecipesByAuthor(userId);

  res.status(200).json({
    data: recipes,
  });
};
