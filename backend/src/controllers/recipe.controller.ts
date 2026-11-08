
import type { Request, Response } from "express";
import { recipeTitleSchema } from "../validators/recipe-title.schema.js";

import {
  listRecipes,
  addRecipe,
} from "../services/recipe.service.js";

export const getRecipes = async (_req: Request, res: Response) => {
  const recipes = await listRecipes();

  res.status(200).json({
    data: recipes,
  });
};

export const createRecipe = async (req: Request, res: Response) => {
  const titleResult = recipeTitleSchema.safeParse(req.body?.title);

  if (!titleResult.success) {
    res.status(400).json({
      message: titleResult.error.issues[0]?.message ?? "Invalid recipe title.",
    });
    return;
  }


  const userId = req.session.userId;

  if (!userId) {
    res.status(401).json({
      message: "Authentication required.",
    });
    return;
  }

  const newRecipe = await addRecipe(titleResult.data, userId);

  res.status(201).json({
    data: newRecipe,
  });

};
