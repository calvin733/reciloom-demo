import type { Request, Response } from "express";
import { z } from "zod";

import { experimentSchema } from "../validators/recipe-experiment.schema.js";
import { updateForkExperiment } from "../services/recipe-experiment.service.js";

const recipeIdSchema = z.uuid();

export const updateMyForkExperiment = async (
  req: Request,
  res: Response
) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized.",
    });
  }

  // 1. Validasi UUID.
  const parsedId = recipeIdSchema.safeParse(
    req.params.recipeId
  );

  if (!parsedId.success) {
    return res.status(400).json({
      message: "Invalid recipe ID.",
    });
  }

  // 2. Validasi Body JSON.
  const parsedBody = experimentSchema.safeParse(
    req.body
  );

  if (!parsedBody.success) {
    return res.status(400).json({
      message: "Invalid experiment data.",
      errors: parsedBody.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // 3. Simpan melalui Service.
  const result = await updateForkExperiment(
    parsedId.data,
    userId,
    parsedBody.data
  );

  if (result.kind === "NOT_FOUND") {
    return res.status(404).json({
      message: "Recipe fork not found.",
    });
  }

  if (result.kind === "NOT_DRAFT") {
    return res.status(409).json({
      message: "Only draft forks can be edited.",
    });
  }

  return res.status(200).json({
    message: "Experiment metadata updated.",
    data: result.data,
  });
};
