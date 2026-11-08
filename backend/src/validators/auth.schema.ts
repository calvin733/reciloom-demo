
import { z } from "zod";

export const registerSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(100),

  email: z.string()
    .trim()
    .max(255)
    .pipe(z.email())
    .transform((email) => email.toLowerCase()),

  password: z.string().min(12).max(128),
});

export const loginSchema = z.strictObject({
  email: registerSchema.shape.email,
  password: z.string().min(1).max(128),
});
