import type {
  Request,
  Response,
  NextFunction,
} from "express";
import { Prisma } from "../generated/prisma/client.js";
import { registerSchema } from "../validators/auth.schema.js";
import { registerUser } from "../services/auth.service.js";
import { loginSchema } from "../validators/auth.schema.js";
import {
  verifyLogin,
  findUserById,
} from "../services/auth.service.js";

export const register = async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      message: "Invalid registration data.",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    const user = await registerUser(result.data);

    res.status(201).json({
      data: user,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        message: "Email is already registered.",
      });
      return;
    }

    throw error;
  }
};


export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      message: "Invalid login data.",
    });
    return;
  }

  const user = await verifyLogin(
    result.data.email,
    result.data.password
  );

  if (!user) {
    res.status(401).json({
      message: "Invalid email or password.",
    });
    return;
  }

  req.session.regenerate((error) => {
    if (error) {
      next(error);
      return;
    }

    req.session.userId = user.id;

    req.session.save((saveError) => {
      if (saveError) {
        next(saveError);
        return;
      }

      res.status(200).json({
        data: user,
      });
    });
  });
}

export const me = async (req: Request, res: Response) => {
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

  res.status(200).json({
    data: user,
  });
};


export const logout = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    res.clearCookie("reciloom.sid", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({
      message: "Logged out successfully.",
    });
  });
};
