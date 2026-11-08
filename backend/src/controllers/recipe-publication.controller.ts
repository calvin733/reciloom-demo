import type { Request, Response } from "express";

import { recipeIdSchema } from "../validators/recipe-editor.schema.js";

import {
  publishDraftRecipe,
  PublishRecipeError,
} from "../services/recipe-publication.service.js";

export const publishMyRecipe = async (
  req: Request,
  res: Response
) => {
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).json({
      message: "Authentication required.",
    });
    return;
  }

  const idResult = recipeIdSchema.safeParse(
    req.params.recipeId
  );

  if (!idResult.success) {
    res.status(400).json({
      message: "Invalid recipe ID.",
    });
    return;
  }

  try {
    const recipe = await publishDraftRecipe(
      idResult.data,
      userId
    );

    res.status(200).json({
      message: "Recipe published successfully.",
      data: recipe,
    });
  } catch (error) {
    if (error instanceof PublishRecipeError) {
      if (error.reason === "NOT_FOUND") {
        res.status(404).json({
          message: "Recipe not found.",
        });
        return;
      }

      if (error.reason === "INCOMPLETE") {
        res.status(422).json({
          message: "Recipe is not ready to publish.",
          issues: error.issues,
        });
        return;
      }

      if (error.reason === "ALREADY_PUBLISHED") {
        res.status(409).json({
          message: "Recipe is already published.",
        });
        return;
      }

      if (error.reason === "CONFLICT") {
        res.status(409).json({
          message: "Recipe changed. Please retry.",
        });
        return;
      }
    }

    throw error;
  }
};
