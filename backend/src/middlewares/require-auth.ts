import type { RequestHandler } from "express";
import { findUserById } from "../services/auth.service.js";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).json({
      message: "Authentication required.",
    });
    return;
  }

  const user = await findUserById(userId);

  if (!user) {
    res.status(401).json({
      message: "Authentication required.",
    });
    return;
  }

  next();
};
