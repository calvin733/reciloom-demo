
import { Router } from "express";

import {
  getRecipes,
  createRecipe,
} from "../controllers/recipe.controller.js";

import { requireAuth } from "../middlewares/require-auth.js";

import {
  getPublicRecipeDetail,
} from "../controllers/recipe-detail.controller.js";

import { forkRecipe } from "../controllers/recipe-fork.controller.js";


const router = Router();

router.get("/", getRecipes);

router.get("/:recipeId", getPublicRecipeDetail);

router.post("/", requireAuth, createRecipe);

router.post("/:recipeId/fork", requireAuth, forkRecipe);

export default router;
