import { Router } from "express";
import { requireAuth } from "../middlewares/require-auth.js";
import {
  getMyRecipes,
} from "../controllers/me.controller.js";
import {
  updateMyDraftRecipe,
} from "../controllers/recipe-editor.controller.js";
import {
  getMyRecipeDetail,
  getMyRecipePublishReadiness,
} from "../controllers/recipe-detail.controller.js";
import {
  publishMyRecipe,
} from "../controllers/recipe-publication.controller.js";
import { compareMyRecipe } from "../controllers/recipe-compare.controller.js";
import { updateMyForkExperiment } from "../controllers/recipe-experiment.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/recipes", getMyRecipes);

router.get(
  "/recipes/:recipeId/publish-readiness",
  getMyRecipePublishReadiness
);

router.get(
  "/recipes/:recipeId",
  getMyRecipeDetail
);

router.get("/recipes/:recipeId/compare", compareMyRecipe);

router.put(
  "/recipes/:recipeId",
  updateMyDraftRecipe
);

router.post(
  "/recipes/:recipeId/publish",
  publishMyRecipe
);

router.patch(
  "/recipes/:recipeId/experiment",
  updateMyForkExperiment
);

export default router;
