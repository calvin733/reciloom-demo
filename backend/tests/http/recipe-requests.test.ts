import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hanya query database yang diganti. Parser, controller, validator, service, dan
// error handler tetap kode asli; integration suite terpisah memakai PostgreSQL.
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { recipe: { create: vi.fn() } },
}));

import { prisma } from "../../src/lib/prisma.js";
import { createRecipe } from "../../src/controllers/recipe.controller.js";
import { errorHandler } from "../../src/middlewares/error-handler.js";
import { recipeEditorSchema } from "../../src/validators/recipe-editor.schema.js";

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use((req, _res, next) => {
  req.session = { userId: "44444444-4444-4444-8444-444444444444" } as typeof req.session;
  next();
});
app.post("/api/recipes", createRecipe);
app.get("/unexpected", () => { throw new Error("private-database-password-and-stack"); });
app.get("/arbitrary-status", () => { throw Object.assign(new Error("private"), { status: 400 }); });
app.use(errorHandler);

beforeEach(() => {
  vi.mocked(prisma.recipe.create).mockResolvedValue({ id: "test-recipe", status: "DRAFT" } as never);
});

describe("R01: validasi title sebelum query create", () => {
  it.each(["Kue latihan", "a".repeat(150), "A"])("menerima title valid: %s", async (title) => {
    await request(app).post("/api/recipes").send({ title }).expect(201);
    expect(prisma.recipe.create).toHaveBeenCalledOnce();
    expect(prisma.recipe.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title, status: "DRAFT" }) }));
  });
  it("menghapus spasi tepi sebelum menyimpan", async () => {
    await request(app).post("/api/recipes").send({ title: "  Kue  " }).expect(201);
    expect(prisma.recipe.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: "Kue" }) }));
  });
  it.each(["", "   ", "a".repeat(151), null, 42, true, [], {}])("menolak title invalid tanpa query: %j", async (title) => {
    const res = await request(app).post("/api/recipes").send({ title }).expect(400);
    expect(res.body.message).toEqual(expect.any(String));
    expect(prisma.recipe.create).not.toHaveBeenCalled();
  });
  it("menolak title yang tidak dikirim", async () => {
    await request(app).post("/api/recipes").send({}).expect(400);
    expect(prisma.recipe.create).not.toHaveBeenCalled();
  });
  it("memakai batas yang sama dengan editor tanpa menaikkan minimum draft", () => {
    for (const title of ["A", "a".repeat(150)]) {
      expect(recipeEditorSchema.safeParse({ title, ingredients: [], steps: [] }).success).toBe(true);
    }
    expect(recipeEditorSchema.safeParse({ title: "a".repeat(151), ingredients: [], steps: [] }).success).toBe(false);
  });
});

describe("R02: klasifikasi error HTTP", () => {
  it("mengembalikan 400 untuk JSON rusak tanpa membocorkan isi body", async () => {
    const res = await request(app).post("/api/recipes").set("Content-Type", "application/json").send('{"password":"private-value",').expect(400);
    expect(res.body).toEqual({ message: "Request body must contain valid JSON." });
    expect(JSON.stringify(res.body)).not.toContain("private-value");
    expect(prisma.recipe.create).not.toHaveBeenCalled();
  });
  it("mengembalikan 413 untuk body di atas batas parser", async () => {
    const res = await request(app).post("/api/recipes").send({ title: "x".repeat(110 * 1024) }).expect(413);
    expect(res.body).toEqual({ message: "Request body exceeds the 100 KB limit." });
    expect(prisma.recipe.create).not.toHaveBeenCalled();
  });
  it("tetap mengembalikan 500 generik untuk error internal", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(app).get("/unexpected").expect(500);
    expect(res.body).toEqual({ message: "Internal server error." });
    expect(log).toHaveBeenCalledWith("Unexpected API error.");
  });
  it("tidak mempercayai status arbitrer pada error selain parser", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await request(app).get("/arbitrary-status").expect(500, { message: "Internal server error." });
  });
});
