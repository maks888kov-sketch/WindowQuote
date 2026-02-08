#!/usr/bin/env python3
"""
apply_patch.pyw

Drop this file next to your repo folders (apps/, docs/, supabase/) and run it.
It will create missing directories and write all required files.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass
class Patch:
    action: str
    target: str
    before: str | None = None
    after: str | None = None
    content: str | None = None


def apply_write(target_path: Path, content: str) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content, encoding="utf-8")


def apply_replace(target_path: Path, before: str, after: str) -> None:
    data = target_path.read_text(encoding="utf-8")
    if before not in data:
        raise ValueError(f"Expected text not found in {target_path}.")
    target_path.write_text(data.replace(before, after, 1), encoding="utf-8")


def apply_append(target_path: Path, content: str) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    existing = ""
    if target_path.exists():
        existing = target_path.read_text(encoding="utf-8")
    target_path.write_text(existing + content, encoding="utf-8")


def run_patches(base_dir: Path, patches: Iterable[Patch]) -> None:
    for patch in patches:
        target_path = (base_dir / patch.target).resolve()
        if patch.action == "write":
            if patch.content is None:
                raise ValueError("write action requires content")
            apply_write(target_path, patch.content)
        elif patch.action == "replace":
            if patch.before is None or patch.after is None:
                raise ValueError("replace action requires before/after")
            apply_replace(target_path, patch.before, patch.after)
        elif patch.action == "append":
            if patch.content is None:
                raise ValueError("append action requires content")
            apply_append(target_path, patch.content)
        else:
            raise ValueError(f"Unknown action: {patch.action}")


PATCHES: list[Patch] = [
    Patch(
        action="write",
        target="README.md",
        content="""# WindowQuote\n\nCross-platform window measurement and quotation system. Multi-tenant SaaS for managing customers, orders, measurements, and pricing calculations.\n\n## Setup\n\n### 1) Supabase project\n1. Create a new Supabase project.\n2. In the SQL editor, run migrations in order from `supabase/migrations`.\n3. Create a private Storage bucket named `photos`.\n\n### 2) Environment variables\nCopy the Vite example env file and fill in your project values:\n\n```bash\ncp apps/web/.env.example apps/web/.env\n```\n\nSet:\n- `VITE_SUPABASE_URL`\n- `VITE_SUPABASE_ANON_KEY`\n\n### 3) Install dependencies\n\n```bash\ncd apps/web\nnpm install\n```\n\n### 4) Run the web app\n\n```bash\nnpm run dev\n```\n\nOpen the local URL printed by Vite.\n""",
    ),
    Patch(
        action="write",
        target="apps/web/.env.example",
        content="""VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=\n""",
    ),
    Patch(
        action="write",
        target="apps/web/.gitignore",
        content="""node_modules\ndist\n.env\n""",
    ),
    Patch(
        action="write",
        target="apps/web/index.html",
        content="""<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>WindowQuote</title>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n    <script type=\"module\" src=\"/src/main.tsx\"></script>\n  </body>\n</html>\n""",
    ),
    Patch(
        action="write",
        target="apps/web/package.json",
        content="""{\n  \"name\": \"windowquote-web\",\n  \"private\": true,\n  \"version\": \"0.1.0\",\n  \"type\": \"module\",\n  \"scripts\": {\n    \"dev\": \"vite\",\n    \"build\": \"tsc -b && vite build\",\n    \"preview\": \"vite preview\"\n  },\n  \"dependencies\": {\n    \"@supabase/supabase-js\": \"^2.49.1\",\n    \"react\": \"^18.3.1\",\n    \"react-dom\": \"^18.3.1\",\n    \"react-router-dom\": \"^6.26.2\"\n  },\n  \"devDependencies\": {\n    \"@types/react\": \"^18.3.5\",\n    \"@types/react-dom\": \"^18.3.0\",\n    \"@vitejs/plugin-react\": \"^4.3.1\",\n    \"typescript\": \"^5.5.4\",\n    \"vite\": \"^5.4.2\"\n  }\n}\n""",
    ),
    Patch(
        action="write",
        target="apps/web/tsconfig.json",
        content="""{\n  \"compilerOptions\": {\n    \"target\": \"ES2020\",\n    \"useDefineForClassFields\": true,\n    \"lib\": [\"ES2020\", \"DOM\", \"DOM.Iterable\"],\n    \"module\": \"ESNext\",\n    \"skipLibCheck\": true,\n    \"moduleResolution\": \"Bundler\",\n    \"allowImportingTsExtensions\": true,\n    \"resolveJsonModule\": true,\n    \"isolatedModules\": true,\n    \"noEmit\": true,\n    \"jsx\": \"react-jsx\",\n    \"strict\": true\n  },\n  \"include\": [\"src\"]\n}\n""",
    ),
    Patch(
        action="write",
        target="apps/web/tsconfig.node.json",
        content="""{\n  \"compilerOptions\": {\n    \"composite\": true,\n    \"skipLibCheck\": true,\n    \"module\": \"ESNext\",\n    \"moduleResolution\": \"Bundler\",\n    \"allowSyntheticDefaultImports\": true\n  },\n  \"include\": [\"vite.config.ts\"]\n}\n""",
    ),
    Patch(
        action="write",
        target="apps/web/vite.config.ts",
        content="""import { defineConfig } from \"vite\";\nimport react from \"@vitejs/plugin-react\";\n\nexport default defineConfig({\n  plugins: [react()],\n});\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/vite-env.d.ts",
        content="""/// <reference types=\"vite/client\" />\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/main.tsx",
        content="""import React from \"react\";\nimport ReactDOM from \"react-dom/client\";\nimport { BrowserRouter } from \"react-router-dom\";\nimport App from \"./App\";\nimport \"./index.css\";\n\nReactDOM.createRoot(document.getElementById(\"root\")!).render(\n  <React.StrictMode>\n    <BrowserRouter>\n      <App />\n    </BrowserRouter>\n  </React.StrictMode>\n);\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/App.tsx",
        content="""import { Navigate, Route, Routes } from \"react-router-dom\";\nimport Layout from \"./components/Layout\";\nimport AuthPage from \"./pages/AuthPage\";\nimport OnboardingPage from \"./pages/OnboardingPage\";\nimport CustomersPage from \"./pages/CustomersPage\";\nimport SitesPage from \"./pages/SitesPage\";\nimport OrdersPage from \"./pages/OrdersPage\";\nimport OrderDetailPage from \"./pages/OrderDetailPage\";\nimport NewMeasurementPage from \"./pages/NewMeasurementPage\";\nimport MeasurementHistoryPage from \"./pages/MeasurementHistoryPage\";\n\nconst App = () => {\n  return (\n    <Routes>\n      <Route element={<Layout />}>\n        <Route index element={<Navigate to=\"/orders\" replace />} />\n        <Route path=\"/auth\" element={<AuthPage />} />\n        <Route path=\"/onboarding\" element={<OnboardingPage />} />\n        <Route path=\"/customers\" element={<CustomersPage />} />\n        <Route path=\"/sites\" element={<SitesPage />} />\n        <Route path=\"/orders\" element={<OrdersPage />} />\n        <Route path=\"/orders/:id\" element={<OrderDetailPage />} />\n        <Route path=\"/orders/:id/measurements/new\" element={<NewMeasurementPage />} />\n        <Route path=\"/orders/:id/measurements\" element={<MeasurementHistoryPage />} />\n      </Route>\n    </Routes>\n  );\n};\n\nexport default App;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/components/Layout.tsx",
        content="""import { NavLink, Outlet, useLocation } from \"react-router-dom\";\n\nconst navItems = [\n  { label: \"Orders\", to: \"/orders\" },\n  { label: \"Customers\", to: \"/customers\" },\n  { label: \"Sites\", to: \"/sites\" },\n  { label: \"Auth\", to: \"/auth\" },\n];\n\nconst Layout = () => {\n  const location = useLocation();\n  const hideNav = location.pathname.startsWith(\"/orders/\");\n\n  return (\n    <div className=\"app-shell\">\n      <header className=\"app-header\">\n        <div>\n          <p className=\"app-title\">WindowQuote</p>\n          <p className=\"app-subtitle\">Measurement & Order Console</p>\n        </div>\n        <NavLink className=\"btn\" to=\"/onboarding\">\n          Create Org\n        </NavLink>\n      </header>\n      <main className=\"app-main\">\n        <Outlet />\n      </main>\n      {!hideNav && (\n        <nav className=\"bottom-nav\">\n          {navItems.map((item) => (\n            <NavLink key={item.to} className=\"nav-link\" to={item.to}>\n              {item.label}\n            </NavLink>\n          ))}\n        </nav>\n      )}\n    </div>\n  );\n};\n\nexport default Layout;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/lib/supabaseClient.ts",
        content="""import { createClient } from \"@supabase/supabase-js\";\n\nconst supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;\nconst supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;\n\nif (!supabaseUrl || !supabaseAnonKey) {\n  console.warn(\"Missing Supabase env vars. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\");\n}\n\nexport const supabase = createClient(supabaseUrl ?? \"\", supabaseAnonKey ?? \"\");\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/pages/AuthPage.tsx",
        content="""import { useState } from \"react\";\nimport { supabase } from \"../lib/supabaseClient\";\n\nconst AuthPage = () => {\n  const [email, setEmail] = useState(\"\");\n  const [password, setPassword] = useState(\"\");\n  const [message, setMessage] = useState<string | null>(null);\n\n  const handleAuth = async (mode: \"sign-in\" | \"sign-up\") => {\n    setMessage(null);\n\n    const action = mode === \"sign-in\" ? supabase.auth.signInWithPassword : supabase.auth.signUp;\n    const { error } = await action({ email, password });\n\n    if (error) {\n      setMessage(error.message);\n      return;\n    }\n\n    setMessage(mode === \"sign-in\" ? \"Signed in.\" : \"Check your email to confirm sign up.\");\n  };\n\n  return (\n    <section className=\"card\">\n      <h1>Sign in or create an account</h1>\n      <p>Use Supabase Auth to access your organization workspace.</p>\n      <form\n        className=\"stack\"\n        onSubmit={(event) => {\n          event.preventDefault();\n          void handleAuth(\"sign-in\");\n        }}\n      >\n        <label className=\"field\">\n          Email\n          <input\n            type=\"email\"\n            value={email}\n            onChange={(event) => setEmail(event.target.value)}\n            required\n          />\n        </label>\n        <label className=\"field\">\n          Password\n          <input\n            type=\"password\"\n            value={password}\n            onChange={(event) => setPassword(event.target.value)}\n            required\n          />\n        </label>\n        <div className=\"row\">\n          <button className=\"btn\" type=\"submit\">\n            Sign in\n          </button>\n          <button\n            className=\"btn secondary\"\n            type=\"button\"\n            onClick={() => void handleAuth(\"sign-up\")}\n          >\n            Sign up\n          </button>\n        </div>\n      </form>\n      {message && <p className=\"notice\">{message}</p>}\n    </section>\n  );\n};\n\nexport default AuthPage;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/pages/OnboardingPage.tsx",
        content="""import { FormEvent, useState } from \"react\";\nimport { supabase } from \"../lib/supabaseClient\";\n\nconst OnboardingPage = () => {\n  const [orgName, setOrgName] = useState(\"\");\n  const [message, setMessage] = useState<string | null>(null);\n\n  const handleCreateOrg = async (event: FormEvent<HTMLFormElement>) => {\n    event.preventDefault();\n    setMessage(null);\n\n    const { error } = await supabase.rpc(\"create_org\", { org_name: orgName });\n    if (error) {\n      setMessage(error.message);\n      return;\n    }\n\n    setMessage(\"Organization created. You can now manage customers and orders.\");\n  };\n\n  return (\n    <section className=\"card\">\n      <h1>Onboarding</h1>\n      <p>Create your organization using the secure RPC.</p>\n      <form className=\"stack\" onSubmit={handleCreateOrg}>\n        <label className=\"field\">\n          Organization name\n          <input\n            value={orgName}\n            onChange={(event) => setOrgName(event.target.value)}\n            required\n          />\n        </label>\n        <button className=\"btn\" type=\"submit\">\n          Create organization\n        </button>\n      </form>\n      {message && <p className=\"notice\">{message}</p>}\n    </section>\n  );\n};\n\nexport default OnboardingPage;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/pages/CustomersPage.tsx",
        content="""const CustomersPage = () => {\n  return (\n    <section className=\"stack\">\n      <div className=\"page-header\">\n        <div>\n          <h1>Customers</h1>\n          <p>Capture customer details and search by name.</p>\n        </div>\n        <button className=\"btn\">New customer</button>\n      </div>\n      <div className=\"card\">\n        <label className=\"field\">\n          Search\n          <input placeholder=\"Search customers\" />\n        </label>\n        <div className=\"empty-state\">\n          <p>No customers yet. Create your first customer to get started.</p>\n        </div>\n      </div>\n    </section>\n  );\n};\n\nexport default CustomersPage;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/pages/SitesPage.tsx",
        content="""const SitesPage = () => {\n  return (\n    <section className=\"stack\">\n      <div className=\"page-header\">\n        <div>\n          <h1>Sites</h1>\n          <p>Manage job sites linked to customers.</p>\n        </div>\n        <button className=\"btn\">New site</button>\n      </div>\n      <div className=\"card\">\n        <div className=\"empty-state\">\n          <p>No sites yet. Add a site once a customer is selected.</p>\n        </div>\n      </div>\n    </section>\n  );\n};\n\nexport default SitesPage;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/pages/OrdersPage.tsx",
        content="""import { Link } from \"react-router-dom\";\n\nconst OrdersPage = () => {\n  return (\n    <section className=\"stack\">\n      <div className=\"page-header\">\n        <div>\n          <h1>Orders</h1>\n          <p>Track orders, statuses, and measurements.</p>\n        </div>\n        <button className=\"btn\">New order</button>\n      </div>\n      <div className=\"card\">\n        <div className=\"empty-state\">\n          <p>No orders yet. Create your first order from a customer site.</p>\n        </div>\n        <div className=\"list\">\n          <div className=\"list-row\">\n            <div>\n              <strong>Order #1001</strong>\n              <p>Draft · Example Site</p>\n            </div>\n            <Link className=\"btn secondary\" to=\"/orders/1001\">\n              View\n            </Link>\n          </div>\n        </div>\n      </div>\n    </section>\n  );\n};\n\nexport default OrdersPage;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/pages/OrderDetailPage.tsx",
        content="""import { Link, useParams } from \"react-router-dom\";\n\nconst OrderDetailPage = () => {\n  const { id } = useParams();\n\n  return (\n    <section className=\"stack\">\n      <div className=\"page-header\">\n        <div>\n          <h1>Order {id}</h1>\n          <p>Status history and measurements for this order.</p>\n        </div>\n        <Link className=\"btn\" to={`/orders/${id}/measurements/new`}>\n          New measurement\n        </Link>\n      </div>\n      <div className=\"card\">\n        <h2>Status history</h2>\n        <ul className=\"timeline\">\n          <li>Draft · Created today</li>\n        </ul>\n      </div>\n      <div className=\"card\">\n        <div className=\"row\">\n          <h2>Measurements</h2>\n          <Link className=\"btn secondary\" to={`/orders/${id}/measurements`}>\n            View all versions\n          </Link>\n        </div>\n        <div className=\"empty-state\">\n          <p>No measurements yet. Add your first measurement version.</p>\n        </div>\n      </div>\n    </section>\n  );\n};\n\nexport default OrderDetailPage;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/pages/NewMeasurementPage.tsx",
        content="""import { useParams } from \"react-router-dom\";\n\nconst NewMeasurementPage = () => {\n  const { id } = useParams();\n\n  return (\n    <section className=\"stack\">\n      <div className=\"page-header\">\n        <div>\n          <h1>New Measurement</h1>\n          <p>Create a new measurement version for order {id}.</p>\n        </div>\n        <button className=\"btn\">Save draft</button>\n      </div>\n      <div className=\"card stack\">\n        <h2>Measurement items</h2>\n        <div className=\"grid\">\n          <label className=\"field\">\n            Item type\n            <select>\n              <option>Window</option>\n              <option>Door</option>\n              <option>Hardware</option>\n            </select>\n          </label>\n          <label className=\"field\">\n            Width (mm)\n            <input type=\"number\" placeholder=\"0\" />\n          </label>\n          <label className=\"field\">\n            Height (mm)\n            <input type=\"number\" placeholder=\"0\" />\n          </label>\n          <label className=\"field\">\n            Quantity\n            <input type=\"number\" placeholder=\"1\" />\n          </label>\n        </div>\n        <label className=\"field\">\n          Params (JSON)\n          <textarea rows={4} placeholder='{"color":"white"}' />\n        </label>\n        <button className=\"btn secondary\">Add item</button>\n      </div>\n      <div className=\"card stack\">\n        <h2>Photos</h2>\n        <p>Upload photos to the private “photos” storage bucket.</p>\n        <input type=\"file\" multiple />\n      </div>\n    </section>\n  );\n};\n\nexport default NewMeasurementPage;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/pages/MeasurementHistoryPage.tsx",
        content="""import { useParams } from \"react-router-dom\";\n\nconst MeasurementHistoryPage = () => {\n  const { id } = useParams();\n\n  return (\n    <section className=\"stack\">\n      <div className=\"page-header\">\n        <div>\n          <h1>Measurement history</h1>\n          <p>Read-only versions for order {id}.</p>\n        </div>\n      </div>\n      <div className=\"card\">\n        <div className=\"list\">\n          <div className=\"list-row\">\n            <div>\n              <strong>Version 1</strong>\n              <p>Draft · 0 items</p>\n            </div>\n            <button className=\"btn secondary\">View</button>\n          </div>\n        </div>\n      </div>\n    </section>\n  );\n};\n\nexport default MeasurementHistoryPage;\n""",
    ),
    Patch(
        action="write",
        target="apps/web/src/index.css",
        content=""":root {\n  color-scheme: light;\n  font-family: \"Inter\", system-ui, sans-serif;\n  line-height: 1.5;\n  font-weight: 400;\n  color: #0f172a;\n  background-color: #f8fafc;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n}\n\na {\n  color: inherit;\n  text-decoration: none;\n}\n\n.app-shell {\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n}\n\n.app-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 1.5rem;\n  background: #ffffff;\n  border-bottom: 1px solid #e2e8f0;\n}\n\n.app-title {\n  font-size: 1.5rem;\n  margin: 0;\n  font-weight: 700;\n}\n\n.app-subtitle {\n  margin: 0.2rem 0 0;\n  color: #64748b;\n  font-size: 0.9rem;\n}\n\n.app-main {\n  flex: 1;\n  padding: 1.5rem;\n  padding-bottom: 5rem;\n}\n\n.bottom-nav {\n  display: flex;\n  justify-content: space-around;\n  gap: 0.5rem;\n  padding: 0.75rem 1rem;\n  border-top: 1px solid #e2e8f0;\n  background: #ffffff;\n  position: fixed;\n  bottom: 0;\n  left: 0;\n  right: 0;\n}\n\n.nav-link {\n  padding: 0.4rem 0.75rem;\n  border-radius: 999px;\n  color: #475569;\n  font-weight: 600;\n}\n\n.nav-link.active {\n  background: #0f172a;\n  color: #ffffff;\n}\n\n.card {\n  background: #ffffff;\n  border: 1px solid #e2e8f0;\n  border-radius: 1rem;\n  padding: 1.5rem;\n}\n\n.stack {\n  display: grid;\n  gap: 1rem;\n}\n\n.page-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 1rem;\n}\n\n.row {\n  display: flex;\n  gap: 1rem;\n  align-items: center;\n  justify-content: space-between;\n}\n\n.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));\n  gap: 1rem;\n}\n\n.btn {\n  border: none;\n  background: #0f172a;\n  color: #ffffff;\n  padding: 0.6rem 1rem;\n  border-radius: 0.75rem;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n.btn.secondary {\n  background: #e2e8f0;\n  color: #0f172a;\n}\n\n.field {\n  display: grid;\n  gap: 0.4rem;\n  font-weight: 600;\n  color: #334155;\n}\n\n.field input,\n.field select,\n.field textarea {\n  padding: 0.6rem 0.8rem;\n  border-radius: 0.6rem;\n  border: 1px solid #cbd5f5;\n  font-size: 0.95rem;\n  font-family: inherit;\n}\n\n.empty-state {\n  text-align: center;\n  padding: 2rem 1rem;\n  color: #64748b;\n}\n\n.list {\n  display: grid;\n  gap: 1rem;\n}\n\n.list-row {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  border: 1px solid #e2e8f0;\n  padding: 1rem;\n  border-radius: 0.75rem;\n}\n\n.notice {\n  margin-top: 1rem;\n  padding: 0.75rem 1rem;\n  background: #e0f2fe;\n  color: #0c4a6e;\n  border-radius: 0.75rem;\n}\n\n.timeline {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: grid;\n  gap: 0.5rem;\n}\n\n@media (max-width: 720px) {\n  .page-header {\n    flex-direction: column;\n    align-items: flex-start;\n  }\n\n  .app-header {\n    flex-direction: column;\n    align-items: flex-start;\n    gap: 0.75rem;\n  }\n}\n""",
    ),
    Patch(
        action="write",
        target="supabase/migrations/001_init.sql",
        content="""create extension if not exists \"pgcrypto\";\n\ncreate type role as enum ('admin', 'manager', 'measurer', 'worker');\ncreate type order_status as enum (\n  'draft',\n  'quoted',\n  'approved',\n  'scheduled',\n  'completed',\n  'canceled'\n);\ncreate type item_type as enum ('window', 'door', 'hardware', 'glass', 'other');\n\ncreate or replace function set_updated_at()\nreturns trigger\nlanguage plpgsql\nas $$\nbegin\n  new.updated_at = now();\n  return new;\nend;\n$$;\n\ncreate table orgs (\n  id uuid primary key default gen_random_uuid(),\n  name text not null,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n);\n\ncreate table profiles (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  user_id uuid not null references auth.users(id) on delete cascade,\n  display_name text,\n  phone text,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n  unique (org_id, user_id)\n);\n\ncreate table org_members (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  user_id uuid not null references auth.users(id) on delete cascade,\n  role role not null default 'worker',\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n  unique (org_id, user_id)\n);\n\ncreate table customers (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  name text not null,\n  email text,\n  phone text,\n  notes text,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n);\n\ncreate table sites (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  customer_id uuid not null references customers(id) on delete cascade,\n  name text not null,\n  address_line1 text,\n  address_line2 text,\n  city text,\n  region text,\n  postal_code text,\n  country text,\n  notes text,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n);\n\ncreate table orders (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  customer_id uuid not null references customers(id) on delete cascade,\n  site_id uuid references sites(id) on delete set null,\n  title text not null,\n  status order_status not null default 'draft',\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n);\n\ncreate table order_status_history (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  order_id uuid not null references orders(id) on delete cascade,\n  status order_status not null,\n  notes text,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n);\n\ncreate table measurements (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  order_id uuid not null references orders(id) on delete cascade,\n  version integer not null,\n  created_by uuid references auth.users(id) on delete set null,\n  notes text,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n  unique (order_id, version)\n);\n\ncreate table measurement_items (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  measurement_id uuid not null references measurements(id) on delete cascade,\n  item_type item_type not null,\n  width numeric(10, 2),\n  height numeric(10, 2),\n  quantity integer not null default 1,\n  params_json jsonb not null default '{}'::jsonb,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n);\n\ncreate table attachments (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  order_id uuid references orders(id) on delete set null,\n  measurement_id uuid references measurements(id) on delete set null,\n  path text not null,\n  description text,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n);\n\ncreate table measurement_item_attachments (\n  id uuid primary key default gen_random_uuid(),\n  org_id uuid not null references orgs(id) on delete cascade,\n  measurement_item_id uuid not null references measurement_items(id) on delete cascade,\n  attachment_id uuid not null references attachments(id) on delete cascade,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now(),\n  unique (measurement_item_id, attachment_id)\n);\n\ncreate index idx_profiles_org_id on profiles(org_id);\ncreate index idx_profiles_user_id on profiles(user_id);\ncreate index idx_org_members_org_id on org_members(org_id);\ncreate index idx_org_members_user_id on org_members(user_id);\ncreate index idx_customers_org_id on customers(org_id);\ncreate index idx_sites_org_id on sites(org_id);\ncreate index idx_sites_customer_id on sites(customer_id);\ncreate index idx_orders_org_id on orders(org_id);\ncreate index idx_orders_customer_id on orders(customer_id);\ncreate index idx_orders_site_id on orders(site_id);\ncreate index idx_order_status_history_org_id on order_status_history(org_id);\ncreate index idx_order_status_history_order_id on order_status_history(order_id);\ncreate index idx_measurements_org_id on measurements(org_id);\ncreate index idx_measurements_order_id on measurements(order_id);\ncreate index idx_measurement_items_org_id on measurement_items(org_id);\ncreate index idx_measurement_items_measurement_id on measurement_items(measurement_id);\ncreate index idx_attachments_org_id on attachments(org_id);\ncreate index idx_attachments_order_id on attachments(order_id);\ncreate index idx_attachments_measurement_id on attachments(measurement_id);\ncreate index idx_measurement_item_attachments_org_id on measurement_item_attachments(org_id);\ncreate index idx_measurement_item_attachments_measurement_item_id on measurement_item_attachments(measurement_item_id);\n\ncreate trigger set_orgs_updated_at\nbefore update on orgs\nfor each row execute function set_updated_at();\n\ncreate trigger set_profiles_updated_at\nbefore update on profiles\nfor each row execute function set_updated_at();\n\ncreate trigger set_org_members_updated_at\nbefore update on org_members\nfor each row execute function set_updated_at();\n\ncreate trigger set_customers_updated_at\nbefore update on customers\nfor each row execute function set_updated_at();\n\ncreate trigger set_sites_updated_at\nbefore update on sites\nfor each row execute function set_updated_at();\n\ncreate trigger set_orders_updated_at\nbefore update on orders\nfor each row execute function set_updated_at();\n\ncreate trigger set_order_status_history_updated_at\nbefore update on order_status_history\nfor each row execute function set_updated_at();\n\ncreate trigger set_measurements_updated_at\nbefore update on measurements\nfor each row execute function set_updated_at();\n\ncreate trigger set_measurement_items_updated_at\nbefore update on measurement_items\nfor each row execute function set_updated_at();\n\ncreate trigger set_attachments_updated_at\nbefore update on attachments\nfor each row execute function set_updated_at();\n\ncreate trigger set_measurement_item_attachments_updated_at\nbefore update on measurement_item_attachments\nfor each row execute function set_updated_at();\n""",
    ),
    Patch(
        action="write",
        target="supabase/migrations/002_functions.sql",
        content="""create or replace function create_org(org_name text)\nreturns uuid\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\ndeclare\n  new_org_id uuid;\nbegin\n  insert into orgs (name)\n  values (org_name)\n  returning id into new_org_id;\n\n  insert into org_members (org_id, user_id, role)\n  values (new_org_id, auth.uid(), 'admin');\n\n  return new_org_id;\nend;\n$$;\n\ncreate or replace function is_member_of_org(org_id uuid)\nreturns boolean\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $$\n  select exists (\n    select 1\n    from org_members\n    where org_members.org_id = is_member_of_org.org_id\n      and org_members.user_id = auth.uid()\n  );\n$$;\n\ncreate or replace function is_org_admin(org_id uuid)\nreturns boolean\nlanguage sql\nstable\nsecurity definer\nset search_path = public\nas $$\n  select exists (\n    select 1\n    from org_members\n    where org_members.org_id = is_org_admin.org_id\n      and org_members.user_id = auth.uid()\n      and org_members.role = 'admin'\n  );\n$$;\n""",
    ),
    Patch(
        action="write",
        target="supabase/migrations/003_rls.sql",
        content="""alter table orgs enable row level security;\nalter table profiles enable row level security;\nalter table org_members enable row level security;\nalter table customers enable row level security;\nalter table sites enable row level security;\nalter table orders enable row level security;\nalter table order_status_history enable row level security;\nalter table measurements enable row level security;\nalter table measurement_items enable row level security;\nalter table attachments enable row level security;\nalter table measurement_item_attachments enable row level security;\n\ncreate policy \"orgs_select\" on orgs\n  for select\n  using (is_member_of_org(id));\n\ncreate policy \"orgs_update\" on orgs\n  for update\n  using (is_org_admin(id));\n\ncreate policy \"orgs_delete\" on orgs\n  for delete\n  using (is_org_admin(id));\n\ncreate policy \"profiles_select\" on profiles\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"profiles_insert\" on profiles\n  for insert\n  with check (is_member_of_org(org_id) and auth.uid() = user_id);\n\ncreate policy \"profiles_update\" on profiles\n  for update\n  using (is_member_of_org(org_id) and auth.uid() = user_id)\n  with check (is_member_of_org(org_id) and auth.uid() = user_id);\n\ncreate policy \"profiles_delete\" on profiles\n  for delete\n  using (is_org_admin(org_id));\n\ncreate policy \"org_members_select\" on org_members\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"org_members_insert\" on org_members\n  for insert\n  with check (is_org_admin(org_id));\n\ncreate policy \"org_members_update\" on org_members\n  for update\n  using (is_org_admin(org_id))\n  with check (is_org_admin(org_id));\n\ncreate policy \"org_members_delete\" on org_members\n  for delete\n  using (is_org_admin(org_id));\n\ncreate policy \"customers_select\" on customers\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"customers_insert\" on customers\n  for insert\n  with check (is_member_of_org(org_id));\n\ncreate policy \"customers_update\" on customers\n  for update\n  using (is_member_of_org(org_id))\n  with check (is_member_of_org(org_id));\n\ncreate policy \"customers_delete\" on customers\n  for delete\n  using (is_member_of_org(org_id));\n\ncreate policy \"sites_select\" on sites\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"sites_insert\" on sites\n  for insert\n  with check (is_member_of_org(org_id));\n\ncreate policy \"sites_update\" on sites\n  for update\n  using (is_member_of_org(org_id))\n  with check (is_member_of_org(org_id));\n\ncreate policy \"sites_delete\" on sites\n  for delete\n  using (is_member_of_org(org_id));\n\ncreate policy \"orders_select\" on orders\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"orders_insert\" on orders\n  for insert\n  with check (is_member_of_org(org_id));\n\ncreate policy \"orders_update\" on orders\n  for update\n  using (is_member_of_org(org_id))\n  with check (is_member_of_org(org_id));\n\ncreate policy \"orders_delete\" on orders\n  for delete\n  using (is_member_of_org(org_id));\n\ncreate policy \"order_status_history_select\" on order_status_history\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"order_status_history_insert\" on order_status_history\n  for insert\n  with check (is_member_of_org(org_id));\n\ncreate policy \"measurements_select\" on measurements\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"measurements_insert\" on measurements\n  for insert\n  with check (is_member_of_org(org_id));\n\ncreate policy \"measurement_items_select\" on measurement_items\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"measurement_items_insert\" on measurement_items\n  for insert\n  with check (is_member_of_org(org_id));\n\ncreate policy \"attachments_select\" on attachments\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"attachments_insert\" on attachments\n  for insert\n  with check (is_member_of_org(org_id));\n\ncreate policy \"measurement_item_attachments_select\" on measurement_item_attachments\n  for select\n  using (is_member_of_org(org_id));\n\ncreate policy \"measurement_item_attachments_insert\" on measurement_item_attachments\n  for insert\n  with check (is_member_of_org(org_id));\n""",
    ),
]


if __name__ == "__main__":
    base = Path(__file__).resolve().parent
    run_patches(base, PATCHES)
    print("Patches applied successfully.")
