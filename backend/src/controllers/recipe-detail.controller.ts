import type { Request, Response } from "express";

import { recipeIdSchema } from "../validators/recipe-editor.schema.js";

import {
  findPublicRecipeDetail,
  findMyRecipeDetail,
  checkPublishReadiness,
} from "../services/recipe-detail.service.js";

// GET /api/recipes/:recipeId
export const getPublicRecipeDetail = async (
  req: Request,
  res: Response
) => {
  const idResult = recipeIdSchema.safeParse(
    req.params.recipeId
  );

  if (!idResult.success) {
    res.status(400).json({
      message: "Invalid recipe ID.",
    });
    return;
  }

  const recipe = await findPublicRecipeDetail(idResult.data);

  if (!recipe) {
    res.status(404).json({
      message: "Recipe not found.",
    });
    return;
  }

  res.status(200).json({
    data: recipe,
  });
};

// GET /api/me/recipes/:recipeId
export const getMyRecipeDetail = async (
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

  const recipe = await findMyRecipeDetail(
    idResult.data,
    userId
  );

  if (!recipe) {
    res.status(404).json({
      message: "Recipe not found.",
    });
    return;
  }

  res.status(200).json({
    data: recipe,
  });
};

// GET /api/me/recipes/:recipeId/publish-readiness
export const getMyRecipePublishReadiness = async (
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

  const result = await checkPublishReadiness(
    idResult.data,
    userId
  );

  if (!result) {
    res.status(404).json({
      message: "Recipe not found.",
    });
    return;
  }

  res.status(200).json({
    data: result,
  });
};
