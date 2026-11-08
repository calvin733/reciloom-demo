import type { Request, Response } from "express";
import { z } from "zod";
import { compareMyFork } from "../services/recipe-compare.service.js";

const recipeIdSchema = z.uuid();

export const compareMyRecipe = async (
  req: Request,
  res: Response
) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized.",
    });
  }

  const parsedId = recipeIdSchema.safeParse(
    req.params.recipeId
  );

  if (!parsedId.success) {
    return res.status(400).json({
      message: "Invalid recipe ID.",
    });
  }

  const comparison = await compareMyFork(
    parsedId.data,
    userId
  );

  if (!comparison) {
    return res.status(404).json({
      message: "Recipe fork not found.",
    });
  }

  return res.status(200).json({
    data: comparison,
  });
};
