import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // Hanya error parser yang dikenal; status arbitrer dari error lain tidak dipercaya.
  if (error && typeof error === "object") {
    const parserError = error as { type?: unknown; status?: unknown };

    if (parserError.type === "entity.parse.failed" && parserError.status === 400) {
      res.status(400).json({ message: "Request body must contain valid JSON." });
      return;
    }

    if (parserError.type === "entity.too.large" && parserError.status === 413) {
      res.status(413).json({ message: "Request body exceeds the 100 KB limit." });
      return;
    }
  }

  // Jangan mencetak body, stack, atau konfigurasi rahasia dari error ke log.
  console.error("Unexpected API error.");
  res.status(500).json({ message: "Internal server error." });
};
