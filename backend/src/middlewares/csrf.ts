import { randomBytes, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

// Membuat atau mengambil CSRF Token dari session
export const getCsrfToken: RequestHandler = (req, res) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }

  res.set("Cache-Control", "no-store");

  res.status(200).json({
    csrfToken: req.session.csrfToken,
  });
};

// Memeriksa CSRF Token pada request yang mengubah data
export const csrfProtection: RequestHandler = (req, res, next) => {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];

  if (safeMethods.includes(req.method)) {
    next();
    return;
  }

  const expectedToken = req.session.csrfToken;
  const submittedToken = req.get("X-CSRF-Token");

  const validFormat = (value: unknown): value is string => {
    return (
      typeof value === "string" &&
      /^[0-9a-f]{64}$/.test(value)
    );
  };

  if (
    !validFormat(expectedToken) ||
    !validFormat(submittedToken)
  ) {
    res.status(403).json({
      message: "Invalid or missing CSRF token.",
    });
    return;
  }

  const tokensMatch = timingSafeEqual(
    Buffer.from(expectedToken, "hex"),
    Buffer.from(submittedToken, "hex")
  );

  if (!tokensMatch) {
    res.status(403).json({
      message: "Invalid or missing CSRF token.",
    });
    return;
  }

  next();
};
