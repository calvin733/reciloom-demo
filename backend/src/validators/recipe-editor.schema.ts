import { z } from "zod";
import { recipeTitleSchema } from "./recipe-title.schema.js";

const quantitySchema = z
  .string()
  .trim()
  .regex(
    /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/,
    "Invalid quantity format."
  )
  .refine(
    (value) => Number(value) > 0,
    "Quantity must be greater than zero."
  );

const ingredientSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  quantity: quantitySchema,
  unit: z.string().trim().min(1).max(30),
  note: z.string().trim().max(500).optional(),
  changeReason: z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .nullable()
  .optional(),

  observedEffect: z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .nullable()
  .optional(),
});

const stepSchema = z.strictObject({
  instruction: z.string().trim().min(1).max(5000),
});

export const recipeEditorSchema = z.strictObject({
  title: recipeTitleSchema,
  ingredients: z.array(ingredientSchema).max(50),
  steps: z.array(stepSchema).max(50),
});

export const recipeIdSchema = z.uuid();

export type RecipeEditorInput = z.infer<typeof recipeEditorSchema>;
