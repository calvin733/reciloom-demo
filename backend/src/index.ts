import app from "./app.js";

const PORT = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

app.listen(PORT, () => {
    console.log(`ReciLoom API running at http://localhost:${PORT}`);
});
