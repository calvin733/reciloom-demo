import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/auth.service.js", () => ({
  registerUser: vi.fn(), verifyLogin: vi.fn().mockResolvedValue(null), findUserById: vi.fn(),
}));
import authRouter from "../../src/routes/auth.routes.js";
import { verifyLogin } from "../../src/services/auth.service.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

describe("R06: input dan limiter akun", () => {
  it("menolak password login lebih dari batas register sebelum verifikasi hash", async () => {
    await request(app).post("/api/auth/login").send({ email: "baker@example.test", password: "a".repeat(129) }).expect(400);
    expect(verifyLogin).not.toHaveBeenCalled();
  });
  it("password tepat 128 karakter masih mencapai verifikasi", async () => {
    await request(app).post("/api/auth/login").send({ email: "baker@example.test", password: "a".repeat(128) }).expect(401);
    expect(verifyLogin).toHaveBeenCalledOnce();
  });
  it("membatasi register berulang menggunakan middleware yang sebenarnya", async () => {
    for (let count = 0; count < 20; count++) await request(app).post("/api/auth/register").send({}).expect(400);
    const res = await request(app).post("/api/auth/register").send({}).expect(429);
    expect(res.body.message).toBe("Too many registration attempts. Try again later.");
  });
});
