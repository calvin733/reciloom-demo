# ReciLoom Demo

Browse recipes, fork them into private drafts, and publish your own versions.

## Run locally

Use Node.js 24 and an empty PostgreSQL database. Copy `backend/.env.example` to `backend/.env`, then set the database URL and a random session secret of at least 32 characters.

```sh
cd backend
npm ci
npm run db:migrate
npm run db:generate
npm run dev
```

Open a second terminal at the repo root.

```sh
cd frontend
npm ci
npm run dev
```

[Open ReciLoom](http://localhost:5173)
