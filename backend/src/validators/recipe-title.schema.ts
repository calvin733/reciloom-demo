import { z } from "zod";

// Draft boleh singkat; syarat minimal 3 karakter tetap diperiksa saat publish.
export const recipeTitleSchema = z
  .string({ error: "Recipe title must be a string." })
  .trim()
  .min(1, "Recipe title is required.")
  .max(150, "Recipe title must not exceed 150 characters.");
