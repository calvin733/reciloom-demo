import type { Request, Response } from "express";

import {
  recipeEditorSchema,
  recipeIdSchema,
} from "../validators/recipe-editor.schema.js";

import {
  replaceDraftRecipe,
  DraftEditError,
} from "../services/recipe-editor.service.js";

export const updateMyDraftRecipe = async (
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

  const bodyResult = recipeEditorSchema.safeParse(req.body);

  if (!bodyResult.success) {
    res.status(400).json({
      message: "Invalid recipe data.",
      errors: bodyResult.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    const recipe = await replaceDraftRecipe(
      idResult.data,
      userId,
      bodyResult.data
    );

    res.status(200).json({
      data: recipe,
    });
  } catch (error) {
    if (error instanceof DraftEditError) {
      if (error.reason === "NOT_FOUND") {
        res.status(404).json({
          message: "Recipe not found.",
        });
        return;
      }

      if (error.reason === "NOT_DRAFT") {
        res.status(409).json({
          message: "Only draft recipes can be edited.",
        });
        return;
      }
    }

    throw error;
  }
};
