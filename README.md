# WindowQuote

Cross-platform window measurement and quotation system. Multi-tenant SaaS for managing customers, orders, measurements, and pricing calculations.

## Setup

### 1) Supabase project
1. Create a new Supabase project.
2. In the SQL editor, run migrations in order from `supabase/migrations`.
3. Create a private Storage bucket named `photos`.

### 2) Environment variables
Copy the Vite example env file and fill in your project values:

```bash
cp apps/web/.env.example apps/web/.env
```

Set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3) Install dependencies

```bash
cd apps/web
npm install
```

### 4) Run the web app

```bash
npm run dev
```

Open the local URL printed by Vite.
