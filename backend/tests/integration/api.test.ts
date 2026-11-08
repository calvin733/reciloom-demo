import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { sessionPool, sessionStore } from "../../src/lib/session.js";

type Agent = ReturnType<typeof request.agent>;
const password = "Only-For-Isolated-Tests-123!";
const runId = randomUUID();
const ownerEmail = `owner-${runId}@example.test`;
const otherEmail = `other-${runId}@example.test`;
const owner = request.agent(app);
const other = request.agent(app);
const userIds: string[] = [];
const recipeIds: string[] = [];
const sessionIds = new Set<string>();
let ownerId: string;
let ownerToken: string;
let otherToken: string;

function rememberSession(res: request.Response) {
  const header = res.headers["set-cookie"];
  const cookies: string[] = Array.isArray(header) ? header : typeof header === "string" ? [header] : [];
  for (const cookie of cookies) {
    const value = cookie.match(/^reciloom\.sid=([^;]+)/)?.[1];
    if (value) {
      const signed = decodeURIComponent(value);
      if (signed.startsWith("s:")) sessionIds.add(signed.slice(2).split(".")[0]);
    }
  }
}

async function csrf(agent: Agent): Promise<string> {
  const res = await agent.get("/api/auth/csrf").expect(200);
  rememberSession(res);
  expect(res.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
  return res.body.csrfToken as string;
}

async function register(agent: Agent, email: string) {
  const token = await csrf(agent);
  const res = await agent.post("/api/auth/register").set("X-CSRF-Token", token)
    .send({ displayName: "Phase One Baker", email, password }).expect(201);
  userIds.push(res.body.data.id);
  expect(res.body.data).not.toHaveProperty("passwordHash");
  return res.body.data as { id: string; email: string };
}

async function login(agent: Agent, email: string): Promise<string> {
  const token = await csrf(agent);
  const res = await agent.post("/api/auth/login").set("X-CSRF-Token", token).send({ email, password }).expect(200);
  rememberSession(res);
  expect(res.body.data).not.toHaveProperty("passwordHash");
  return csrf(agent); // Login mengganti session; ambil token baru.
}

async function createDraft(title = "Kue integration", agent = owner, token = ownerToken): Promise<string> {
  const res = await agent.post("/api/recipes").set("X-CSRF-Token", token).send({ title }).expect(201);
  recipeIds.push(res.body.data.id);
  return res.body.data.id as string;
}

function completeInput(title = "Kue integration") {
  return {
    title,
    ingredients: [
      { name: "Gula", quantity: "100", unit: "g", note: "Gula pasir", changeReason: "Catatan sumber", observedEffect: null },
      { name: "Tepung", quantity: "200", unit: "g" },
      { name: "Telur", quantity: "2", unit: "butir" },
    ],
    steps: [{ instruction: "Campur bahan." }, { instruction: "Panggang." }],
  };
}

async function publishedSource(): Promise<string> {
  const id = await createDraft();
  await owner.put(`/api/me/recipes/${id}`).set("X-CSRF-Token", ownerToken).send(completeInput()).expect(200);
  await owner.post(`/api/me/recipes/${id}/publish`).set("X-CSRF-Token", ownerToken).expect(200);
  return id;
}

async function fork(sourceId: string, agent = other, token = otherToken) {
  const res = await agent.post(`/api/recipes/${sourceId}/fork`).set("X-CSRF-Token", token).expect(201);
  recipeIds.push(res.body.data.id);
  return res;
}

beforeAll(async () => {
  // Marker dan URL target sudah diverifikasi integration-setup sebelum app diimpor.
  ownerId = (await register(owner, ownerEmail)).id;
  await register(other, otherEmail);
  ownerToken = await login(owner, ownerEmail);
  otherToken = await login(other, otherEmail);
});

afterAll(async () => {
  try {
    // Tidak ada truncate/reset/deleteMany tanpa filter. Hanya ID fixture run ini.
    for (const id of [...recipeIds].reverse()) {
      await prisma.recipe.deleteMany({ where: { id, authorId: { in: userIds } } });
    }
    for (const id of userIds) {
      await prisma.user.deleteMany({ where: { id, email: { endsWith: `${runId}@example.test` } } });
    }
    if (sessionIds.size > 0) {
      await sessionPool.query("DELETE FROM session_store.session WHERE sid = ANY($1::text[])", [[...sessionIds]]);
    }
  } finally {
    await sessionStore.close();
    await sessionPool.end();
    await prisma.$disconnect();
  }
});

describe("Authentication dan session PostgreSQL", () => {
  it("register menyimpan hash dan tidak mengembalikannya dalam respons", async () => {
    const agent = request.agent(app);
    const user = await register(agent, `registered-${runId}@example.test`);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.passwordHash).toMatch(/^\$argon2id\$/);
    expect(saved.passwordHash).not.toBe(password);
  });
  it("menolak register invalid dan email duplikat", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    await agent.post("/api/auth/register").set("X-CSRF-Token", token).send({ displayName: "A", email: "invalid", password: "short" }).expect(400);
    await agent.post("/api/auth/register").set("X-CSRF-Token", token).send({ displayName: "Another Baker", email: ownerEmail, password }).expect(409);
  });
  it("menolak login dengan password salah", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    await agent.post("/api/auth/login").set("X-CSRF-Token", token).send({ email: ownerEmail, password: "Wrong-password" }).expect(401);
    await agent.get("/api/auth/me").expect(401);
  });
  it("login valid mempertahankan session antar-request dan mengganti token CSRF", async () => {
    const agent = request.agent(app);
    const previousToken = await csrf(agent);
    const loginRes = await agent.post("/api/auth/login").set("X-CSRF-Token", previousToken).send({ email: ownerEmail, password }).expect(200);
    rememberSession(loginRes);
    expect(loginRes.body.data).not.toHaveProperty("passwordHash");
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.data.id).toBe(ownerId);
    const rows = await sessionPool.query("SELECT sid FROM session_store.session WHERE sess->>'userId' = $1", [ownerId]);
    expect(rows.rowCount).toBeGreaterThan(0);
    await agent.post("/api/recipes").set("X-CSRF-Token", previousToken).send({ title: "Old token" }).expect(403);
    const freshToken = await csrf(agent);
    expect(freshToken).not.toBe(previousToken);
    await createDraft("Fresh token", agent, freshToken);
  });
  it("logout mengakhiri session server dan akses berikutnya ditolak", async () => {
    const agent = request.agent(app);
    const token = await login(agent, ownerEmail);
    await agent.post("/api/auth/logout").set("X-CSRF-Token", token).expect(200);
    await agent.get("/api/auth/me").expect(401);
    await agent.post("/api/recipes").set("X-CSRF-Token", token).send({ title: "After logout" }).expect(403);
  });
  it("protected GET menolak pengunjung dan mutasi menolak CSRF hilang/salah", async () => {
    await request(app).get("/api/me/recipes").expect(401);
    await owner.post("/api/recipes").send({ title: "No CSRF" }).expect(403);
    await owner.post("/api/recipes").set("X-CSRF-Token", "b".repeat(64)).send({ title: "Wrong CSRF" }).expect(403);
  });
});

describe("Draft, validasi, ownership, dan publish", () => {
  it("create draft valid, judul 150 karakter, dan judul pendek tetap diperbolehkan", async () => {
    for (const title of ["Draft valid", "a".repeat(150), "A"]) {
      const id = await createDraft(title);
      const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id } });
      expect(recipe).toMatchObject({ title, status: "DRAFT", authorId: ownerId, parentRecipeId: null });
    }
  });
  it("judul invalid tidak membuat row database", async () => {
    const before = await prisma.recipe.count({ where: { authorId: ownerId } });
    for (const title of ["", "a".repeat(151), 12, null]) {
      await owner.post("/api/recipes").set("X-CSRF-Token", ownerToken).send({ title }).expect(400);
    }
    expect(await prisma.recipe.count({ where: { authorId: ownerId } })).toBe(before);
  });
  it("JSON invalid/oversized mempertahankan status 400/413 di app asli", async () => {
    await request(app).post("/api/recipes").set("Content-Type", "application/json").send('{"title":').expect(400);
    await request(app).post("/api/recipes").send({ title: "x".repeat(110 * 1024) }).expect(413);
  });
  it("editor menyimpan konten sendiri dan input invalid tidak mengubah isi sebelumnya", async () => {
    const id = await createDraft();
    const saved = await owner.put(`/api/me/recipes/${id}`).set("X-CSRF-Token", ownerToken).send(completeInput()).expect(200);
    expect(saved.body.data.ingredients).toHaveLength(3);
    const invalid = completeInput("Should not be saved");
    invalid.ingredients[0].quantity = "0";
    await owner.put(`/api/me/recipes/${id}`).set("X-CSRF-Token", ownerToken).send(invalid).expect(400);
    const after = await owner.get(`/api/me/recipes/${id}`).expect(200);
    expect(after.body.data.title).toBe("Kue integration");
    expect(after.body.data.ingredients).toEqual(saved.body.data.ingredients);
  });
  it("akun lain tidak dapat membaca, mengedit, atau publish draft", async () => {
    const id = await createDraft();
    await other.get(`/api/me/recipes/${id}`).expect(404);
    await other.put(`/api/me/recipes/${id}`).set("X-CSRF-Token", otherToken).send(completeInput()).expect(404);
    await other.post(`/api/me/recipes/${id}/publish`).set("X-CSRF-Token", otherToken).expect(404);
  });
  it("draft incomplete ditolak publish, lalu konten lengkap bisa published dan tidak bisa diedit", async () => {
    const id = await createDraft();
    await owner.post(`/api/me/recipes/${id}/publish`).set("X-CSRF-Token", ownerToken).expect(422);
    const incomplete = await owner.get(`/api/me/recipes/${id}/publish-readiness`).expect(200);
    expect(incomplete.body.data.readyToPublish).toBe(false);
    await owner.put(`/api/me/recipes/${id}`).set("X-CSRF-Token", ownerToken).send(completeInput()).expect(200);
    const ready = await owner.get(`/api/me/recipes/${id}/publish-readiness`).expect(200);
    expect(ready.body.data.readyToPublish).toBe(true);
    const published = await owner.post(`/api/me/recipes/${id}/publish`).set("X-CSRF-Token", ownerToken).expect(200);
    expect(published.body.data.status).toBe("PUBLISHED");
    await owner.put(`/api/me/recipes/${id}`).set("X-CSRF-Token", ownerToken).send(completeInput()).expect(409);
    await owner.post(`/api/me/recipes/${id}/publish`).set("X-CSRF-Token", ownerToken).expect(409);
  });
  it("katalog publik menyembunyikan draft dan My Recipes memfilter pemilik", async () => {
    const draftId = await createDraft();
    await request(app).get(`/api/recipes/${draftId}`).expect(404);
    const publicList = await request(app).get("/api/recipes").expect(200);
    expect(publicList.body.data.some((row: { id: string }) => row.id === draftId)).toBe(false);
    const mine = await owner.get("/api/me/recipes").expect(200);
    expect(mine.body.data.length).toBeGreaterThan(0);
    expect(mine.body.data.every((row: { authorId: string }) => row.authorId === ownerId)).toBe(true);
  });
});

describe("Fork, Compare, dan catatan eksperimen", () => {
  it("menolak fork draft/nonexistent dan compare resep yang bukan fork", async () => {
    const id = await createDraft();
    await other.post(`/api/recipes/${id}/fork`).set("X-CSRF-Token", otherToken).expect(404);
    await other.post(`/api/recipes/${randomUUID()}/fork`).set("X-CSRF-Token", otherToken).expect(404);
    await owner.get(`/api/me/recipes/${id}/compare`).expect(404);
  });
  it("fork menyalin konten published ke record baru dengan owner dan parent yang benar", async () => {
    const sourceId = await publishedSource();
    const source = await request(app).get(`/api/recipes/${sourceId}`).expect(200);
    const res = await fork(sourceId);
    expect(res.body.data.id).not.toBe(sourceId);
    expect(res.body.data).toMatchObject({ status: "DRAFT", parentRecipeId: sourceId });
    expect(res.body.data.authorId).not.toBe(ownerId);
    expect(res.body.data.ingredients).toHaveLength(3);
    expect(res.body.data.steps).toHaveLength(2);
    res.body.data.ingredients.forEach((row: { id: string; name: string; quantity: string; changeReason: null }, index: number) => {
      expect(row.id).not.toBe(source.body.data.ingredients[index].id);
      expect(row.name).toBe(source.body.data.ingredients[index].name);
      expect(row.quantity).toBe(source.body.data.ingredients[index].quantity);
      expect(row.changeReason).toBeNull();
    });
    res.body.data.steps.forEach((row: { id: string; instruction: string }, index: number) => {
      expect(row.id).not.toBe(source.body.data.steps[index].id);
      expect(row.instruction).toBe(source.body.data.steps[index].instruction);
    });
  });
  it("mengedit fork tidak mengubah parent dan Compare mengembalikan perbedaan yang sesuai", async () => {
    const sourceId = await publishedSource();
    const before = await request(app).get(`/api/recipes/${sourceId}`).expect(200);
    const forkId = (await fork(sourceId)).body.data.id as string;
    const input = {
      title: "Variasi kurang gula",
      ingredients: [
        { name: "Gula", quantity: "80", unit: "g", note: "Kurangi gula", changeReason: "Lebih ringan", observedEffect: "Tetap lembut" },
        { name: "Tepung", quantity: "200", unit: "g" },
        { name: "Madu", quantity: "15", unit: "g" },
      ],
      steps: [{ instruction: "Campur bahan." }, { instruction: "Kukus." }],
    };
    await other.put(`/api/me/recipes/${forkId}`).set("X-CSRF-Token", otherToken).send(input).expect(200);
    const after = await request(app).get(`/api/recipes/${sourceId}`).expect(200);
    expect(after.body.data).toEqual(before.body.data);
    const compared = await other.get(`/api/me/recipes/${forkId}/compare`).expect(200);
    expect(compared.body.data.original.id).toBe(sourceId);
    expect(compared.body.data.ingredients.map((item: { type: string }) => item.type)).toEqual(["MODIFIED", "UNCHANGED", "REMOVED", "ADDED"]);
    expect(compared.body.data.steps.map((item: { type: string }) => item.type)).toEqual(["UNCHANGED", "MODIFIED"]);
    expect(compared.body.data.ingredients[0].after).toMatchObject({ changeReason: "Lebih ringan", observedEffect: "Tetap lembut" });
    const saved = await other.get(`/api/me/recipes/${forkId}`).expect(200);
    expect(saved.body.data.ingredients[0]).toMatchObject({ changeReason: "Lebih ringan", observedEffect: "Tetap lembut" });
    await owner.get(`/api/me/recipes/${forkId}/compare`).expect(404);
    await request(app).get(`/api/me/recipes/${forkId}/compare`).expect(401);
  });
  it("Compare fork dari fork menggunakan parent langsung, bukan ancestor root", async () => {
    const sourceId = await publishedSource();
    const parentId = (await fork(sourceId)).body.data.id as string;
    await other.post(`/api/me/recipes/${parentId}/publish`).set("X-CSRF-Token", otherToken).expect(200);
    const childId = (await fork(parentId)).body.data.id as string;
    const compared = await other.get(`/api/me/recipes/${childId}/compare`).expect(200);
    expect(compared.body.data.original.id).toBe(parentId);
    expect(compared.body.data.original.id).not.toBe(sourceId);
    expect(compared.body.data.ingredients.every((row: { type: string }) => row.type === "UNCHANGED")).toBe(true);
  });
  it("metadata hanya boleh diperbarui pada fork draft milik sendiri", async () => {
    const sourceId = await publishedSource();
    const forkId = (await fork(sourceId)).body.data.id as string;
    const notes = { experimentGoal: "Kurangi manis", experimentResult: "Tetap lembut", experimentStatus: "SUCCESS" };
    await owner.patch(`/api/me/recipes/${forkId}/experiment`).set("X-CSRF-Token", ownerToken).send(notes).expect(404);
    await other.patch(`/api/me/recipes/${forkId}/experiment`).set("X-CSRF-Token", otherToken).send(notes).expect(200);
    const compared = await other.get(`/api/me/recipes/${forkId}/compare`).expect(200);
    expect(compared.body.data.fork).toMatchObject(notes);
    await other.post(`/api/me/recipes/${forkId}/publish`).set("X-CSRF-Token", otherToken).expect(200);
    await other.patch(`/api/me/recipes/${forkId}/experiment`).set("X-CSRF-Token", otherToken).send(notes).expect(409);
  });
});
