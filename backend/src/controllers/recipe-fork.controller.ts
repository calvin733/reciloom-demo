import type { Request, Response } from "express";
import { z } from "zod";
import { createRecipeFork } from "../services/recipe-fork.service.js";

const recipeIdSchema = z.uuid();

export const forkRecipe = async (
  req: Request,
  res: Response
) => {
  // 1. Pastikan pengguna sudah Login
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({
      message: "Unauthorized.",
    });
  }

  // 2. Validasi ID resep sumber
  const parsedId = recipeIdSchema.safeParse(
    req.params.recipeId
  );

  if (!parsedId.success) {
    return res.status(400).json({
      message: "Invalid recipe ID.",
    });
  }

  // 3. Jalankan logika Fork melalui Service
  const fork = await createRecipeFork(
    parsedId.data,
    userId
  );

  // 4. Tolak jika resep sumber tidak tersedia
  if (!fork) {
    return res.status(404).json({
      message: "Published source recipe not found.",
    });
  }

  // 5. Kirim hasil Fork yang berhasil dibuat
  return res.status(201).json({
    message: "Recipe fork created successfully.",
    data: fork,
  });
};
