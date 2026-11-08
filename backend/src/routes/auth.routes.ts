import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  register,
  login,
  me,
  logout
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/require-auth.js";
import { getCsrfToken } from "../middlewares/csrf.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Try again later.",
  },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many registration attempts. Try again later." },
});

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", requireAuth, logout);
router.get("/me", me);
router.get("/csrf", getCsrfToken);

export default router;
