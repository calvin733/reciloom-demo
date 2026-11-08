import express from "express";
import recipeRouter from "./routes/recipe.routes.js";
import authRouter from "./routes/auth.routes.js";
import { sessionMiddleware } from "./lib/session.js";
import meRouter from "./routes/me.routes.js";
import { csrfProtection } from "./middlewares/csrf.js";
import { errorHandler } from "./middlewares/error-handler.js";

const app = express();

// Aktifkan hanya bila hosting memakai tepat satu reverse proxy tepercaya.
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    application: "ReciLoom API",
  });
});

app.use(sessionMiddleware);
app.use(csrfProtection);

app.use("/api/recipes", recipeRouter);
app.use("/api/me", meRouter);
app.use("/api/auth", authRouter);

app.use(errorHandler);

export default app;
