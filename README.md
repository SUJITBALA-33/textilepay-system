# TextilePay Payroll System

[![Vite](https://img.shields.io/badge/Vite-6.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)

TextilePay is an industrial-grade, multi-tenant payroll and production management system engineered specifically for textile and garment manufacturing units. It unites shop-floor production tracking across six manufacturing stages, dual-mode worker compensation (piece-rate and daily-wage), fixed manager salaries, pool distribution, statutory deductions (PF/ESI), automated UPI payout intents, and role-governed administrative workflows into a unified, responsive web platform.

---

## 1. Project Title & Overview

- **Project Name:** TextilePay Payroll System
- **Repository:** [`https://github.com/SUJITBALA-33/textilepay-system`](https://github.com/SUJITBALA-33/textilepay-system)
- **Deployment Platform:** Vercel (Frontend Single Page Application)
- **Backend Infrastructure:** Supabase (PostgreSQL with Row Level Security + Deno/Hono Edge Functions API)
- **UI System:** Custom dark industrial design language built with Tailwind CSS v4, Lucide React icons, and precision typography (`Instrument Serif` & `Geologica`).

---

## 2. Problem Statement & Objectives

Small-to-midsize textile factories face operational friction from fragmented record-keeping:
1. **Disjointed Production & Wage Calculation:** Piece rates and worker output logs are kept in paper registers or siloed spreadsheets, causing wage disputes and calculation errors.
2. **Multi-Stage Bottlenecks:** Orders flow through six stages (Cutting, Stitching, Embroidery, Checking, Finishing, Packing) where stage dependencies and piece rollbacks often lose traceability.
3. **Complex Compensation Models:** Factories employ both daily-wage laborers and piece-rate specialists, while managers receive fixed monthly salaries with overtime (OT). Calculating pool profit sharing, statutory Provident Fund (PF), and Employee State Insurance (ESI) deductions by hand is error-prone.
4. **Data Security & Tenant Isolation:** Factories require multi-company tenancy, role-based access control (Owners, Managers, Workers), and strict privacy for banking, UPI IDs, and Aadhaar numbers.

### Core Objectives
- Provide a responsive dashboard for owners and managers to monitor order progress, stage capacity, and bottlenecks in real time.
- Standardize wage calculations with pure, verifiable mathematical formulas for piece rates, daily wages, overtime multipliers, and PF/ESI deductions.
- Streamline payouts with single-click `upi://` payment intent generation and audit trails.
- Deliver a production-ready, modular architecture deployable directly to GitHub and Vercel.

---

## 3. Implemented Features

### Role-Based Access Control (RBAC) & Multi-Tenancy
- **Owner:** Complete factory oversight, company settings, worker rate configurations, pending user approval/rejection, account creation, order management, payroll finalization, and permanent deletion.
- **Manager:** Production line oversight, daily attendance/OT recording, order stage advancement, bottleneck mitigation, and worker profile submission.
- **Worker:** Personal dashboard displaying assigned section, real-time piece submission logs, attendance calendar, salary summaries, and payout history.
- **Multi-Company Tenancy:** Isolated tenant architecture powered by `company_id` foreign keys and PostgreSQL Row Level Security (RLS) policies.

### Shop-Floor Production Tracking
- **Six Standard Stages:** Cutting (S1), Stitching (S2), Embroidery (S3), Checking (S4), Finishing (S5), Packing (S6).
- **Stage Progression & Rollback:** Strict sequential verification preventing downstream stages from exceeding completed upstream quantities. Integrated stage rollback logic to correct clerical input errors.
- **Capacity & Bottleneck Calculation:** Real-time remaining capacity indicators (`order.quantity - completedPieces`) per stage with visual alert badges.

### Payroll & Compensation Engine
- **Piece-Rate Workers:** Earnings derived directly from validated stage submissions multiplied by section-specific piece rates.
- **Daily-Rate Workers:** Earnings computed from approved attendance logs multiplied by per-day wage rates.
- **Overtime Engine:** Automated overtime pay calculations supporting individual hourly rates and company-wide multipliers.
- **Manager Fixed Salaries:** Prorated monthly salaries combined with logged overtime pay.
- **Worker Pool Distribution:** Automatic distribution of remaining order margins among eligible floor workers.
- **Statutory Deductions:** Configurable per-worker PF (12% employee contribution on basic/earned pay) and ESI (0.75% contribution) toggles.

### Financial Workflows & Payouts
- **UPI Intent Integration:** Generates standard `upi://pay` deep links pre-populated with worker UPI VPA, beneficiary name, exact rupee amount, and note for mobile instant settlement.
- **Disbursement Audit Trail:** Record-keeping for cash, bank transfer, and UPI disbursements with transaction reference logging and timestamps.
- **Operational Reports:** Export-ready, printable summaries for monthly payroll, piece-rate audit slips, attendance ledgers, and order costing.

---

## 4. Actual Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^18.3.1` | Declarative UI rendering & state management |
| **Language** | TypeScript | `~5.7.2` | Static typing, interface contracts, and safety |
| **Build Tool & Bundler** | Vite | `^6.3.5` | Fast HMR dev server & optimized rollup production builds |
| **Styling & CSS** | Tailwind CSS | `^4.1.12` | Modern utility-first industrial theme engine |
| **Icons** | Lucide React | `^1.16.0` | Comprehensive icon library |
| **Database & Auth** | Supabase | `@supabase/supabase-js ^2.49.1` | PostgreSQL database, Auth JWT, and RLS policies |
| **Serverless API** | Deno + Hono | Supabase Edge Runtime | Authenticated administrative Edge Functions (`make-server-32660b5b`) |
| **Package Manager** | pnpm | `^10.0.0` or `^11.0.0` | Strict, reproducible, disk-efficient dependency management |
| **Deployment** | Vercel | Production Preset | Edge CDN hosting for static assets and client routing |

---

## 5. Project Architecture

The application adopts a decoupled, secure client-serverless architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                   Client Browser (Vercel)                   │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   React App & Views   │       │ Pure Domain Engine    │  │
│  │   (Tailwind 4 + UI)   │◄─────►│ (src/lib/payroll.ts)  │  │
│  └───────────┬───────────┘       └───────────────────────┘  │
└──────────────┼──────────────────────────────────────────────┘
               │
       HTTPS / Supabase SDK
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Infrastructure                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Supabase Auth (JWT Issue, Session Refresh, Passwords) │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ Edge Function API: "make-server-32660b5b" (Deno/Hono) │  │
│  │ • Validates Bearer Access Tokens                      │  │
│  │ • Enforces RBAC (Owner / Manager / Worker)            │  │
│  │ • Protected Admin Actions (User Provisioning)         │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ PostgreSQL Database (RLS Enforced)                    │  │
│  │ • companies, profiles, profile_private                │  │
│  │ • orders, piece_rates, submissions, attendance, payments│
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

1. **Client Application:** Static SPA served via Vercel Edge Network. Initiates sessions using `@supabase/supabase-js`.
2. **Domain Layer:** Pure calculation and validation logic is encapsulated in `src/lib/payroll.ts`. Zero UI or browser dependencies, allowing automated testing via Node test runner.
3. **Authorization Layer:** The client sends the user's Supabase access token to the Edge Function (`/functions/v1/make-server-32660b5b`). The function validates the JWT against Supabase Auth, loads the verified role from PostgreSQL, and rejects unauthorized mutations.
4. **Data Isolation:** Every table includes a `company_id`. Row Level Security (RLS) policies prevent data leaks across distinct manufacturing tenants. Sensitive identity data (bank account, Aadhaar) is segregated into `profile_private`.

---

## 6. Complete Folder Structure

```text
textilepay-system/
├── .figma/                          # Figma Make environment configuration
├── .github/                         # GitHub repository metadata and actions
├── public/
│   ├── favicon.svg                  # SVG Industrial thread spool logo
│   └── _redirects                   # Netlify/SPA static fallback route rules
├── scripts/
│   └── create-owner.mjs             # CLI script to bootstrap initial factory owner
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   └── ui-primitives.tsx    # Reusable UI widgets: Modal, Badge, StatCard, Inp, Sel, Btn, Toast
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx          # Role-aware responsive navigation sidebar
│   │   │   └── TopBar.tsx           # Global header with company badge, role chip, and sign-out
│   │   ├── views/
│   │   │   ├── AccountsView.tsx     # Company expense ledger and balance tracking
│   │   │   ├── AttendanceView.tsx   # Daily check-in, presence, and overtime management
│   │   │   ├── AuthScreen.tsx       # Secure login portal with role indicators
│   │   │   ├── CreateAccountForm.tsx# Provisioning form for new staff members
│   │   │   ├── DashboardView.tsx    # Executive operational metrics and order overview
│   │   │   ├── PayoutView.tsx       # Wage finalization, UPI deep-linking, payment history
│   │   │   ├── ProductionView.tsx   # Order stages, progress bars, bottleneck tracking
│   │   │   ├── ReportsView.tsx      # Comprehensive printable export reports
│   │   │   ├── WorkerDashView.tsx   # Dedicated worker portal for piece submissions & logs
│   │   │   └── WorkersView.tsx      # Staff directory, piece rates, pending approvals
│   │   └── App.tsx                  # Main application orchestrator & state router
│   ├── lib/
│   │   ├── payroll.ts               # Pure domain payroll math, types, rollbacks, UPI formatting
│   │   └── supabase.ts              # Supabase JavaScript client initialization & endpoints
│   ├── styles/
│   │   ├── fonts.css                # Typography imports (Instrument Serif, Geologica)
│   │   ├── index.css                # Tailwind CSS v4 directives and color variables
│   │   └── theme.css                # Industrial dark palette specifications
│   ├── types/
│   │   └── figma.d.ts               # Ambient module declarations
│   └── main.tsx                     # React DOM client entry point
├── supabase/
│   ├── config.toml                  # Supabase CLI project and function configuration
│   ├── functions/
│   │   └── make-server-32660b5b/    # Authenticated Hono Edge Function (Deno)
│   │       └── index.ts
│   └── migrations/
│       ├── 20261026000100_textilepay_production.sql  # Base schema, tables, RLS, triggers
│       └── 20261026000200_multi_company_tenancy.sql  # Multi-tenant isolation migration
├── tests/
│   └── textilepay.test.ts           # 26 automated unit & integration tests
├── utils/
│   └── supabase/
│       └── info.tsx                 # Supabase connection fallback constants
├── .env.example                     # Environment template with instructions
├── .gitignore                       # Production git exclusion rules
├── index.html                       # HTML5 entry template with SEO meta tags
├── package.json                     # Project manifest and scripts
├── pnpm-lock.yaml                   # Deterministic package dependency tree
├── tsconfig.app.json                # TypeScript application compiler configuration
├── tsconfig.json                    # TypeScript root project references
├── vercel.json                      # Vercel deployment and SPA rewrite rules
├── vite.config.ts                   # Standard Vite configuration with React & Tailwind plugins
└── vite.figma.config.ts             # Dedicated Figma Make runner configuration
```

---

## 7. Prerequisites

Ensure your development environment meets the following specifications:
- **Node.js:** `v20.x` or `v22.x` LTS (v24 compatible)
- **Package Manager:** `pnpm` version `10.x` or `11.x` (`npm install -g pnpm`)
- **Git:** Version `2.30+` installed and authenticated
- **Supabase Account:** Free or Pro tier project at [supabase.com](https://supabase.com)
- **Supabase CLI:** (Optional for migrations and Edge Function deployments) Install via `npm install -g supabase`
- **Vercel Account:** Free or Pro tier at [vercel.com](https://vercel.com)

---

## 8. Installation Instructions

1. **Clone the GitHub repository:**
   ```bash
   git clone https://github.com/SUJITBALA-33/textilepay-system.git
   cd textilepay-system
   ```

2. **Install project dependencies:**
   ```bash
   pnpm install
   ```

3. **Approve native builds (if prompted by pnpm 11+):**
   ```bash
   pnpm approve-builds --all
   ```

---

## 9. Local Setup in VS Code

1. Open the project root in Visual Studio Code:
   ```bash
   code .
   ```
2. **Recommended Extensions:**
   - **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
   - **ESLint** (`dbaeumer.vscode-eslint`)
   - **PostCSS Language Support** (`csstools.postcss`)
3. Set your VS Code TypeScript version to the workspace version:
   - Open any `.ts` or `.tsx` file.
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) -> **TypeScript: Select TypeScript Version...** -> **Use Workspace Version**.

---

## 10. Environment Variable Setup

TextilePay uses Vite's environment variable convention. Variables exposed to the browser must be prefixed with `VITE_`.

1. Copy the template to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Configure your credentials inside `.env.local`:
   ```dotenv
   # Supabase Project URL
   VITE_SUPABASE_URL=https://your-project-id.supabase.co

   # Supabase Public Anonymous API Key (safe for browser exposure)
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

> [!CAUTION]
> Never place `SUPABASE_SERVICE_ROLE_KEY` or database passwords into `.env.local` or any `VITE_*` variable. Client-side variables are bundled into the public JavaScript build!

---

## 11. Supabase Configuration

### Step 1: Create Supabase Project
1. Log in to [Supabase](https://supabase.com/dashboard) and click **New Project**.
2. Set your database password and choose a region closest to your factory users.

### Step 2: Configure Authentication Settings
1. Navigate to **Authentication → URL Configuration**.
2. Set **Site URL** to your local dev URL (e.g., `http://localhost:5173`) or your production Vercel domain (`https://textilepay-system.vercel.app`).
3. Add redirect URLs for both local and preview deployments:
   - `http://localhost:5173/**`
   - `https://*.vercel.app/**`
4. Under **Authentication → Providers → Email**:
   - Enable **Email** provider.
   - Disable **Confirm email** if you want immediate account usage during onboarding.
   - Disable **Allow new users to sign up** (TextilePay is an invite/admin-provisioned application).

---

## 12. Database Schema & Migration Instructions

### Applying Migrations via Supabase CLI
Run the following commands from the repository root:
```bash
# Log in to Supabase CLI
supabase login

# Link your local repo to your remote project ref
supabase link --project-ref your-project-id

# Apply all database migrations
supabase db push
```

### Applying Migrations via Supabase SQL Editor
If you prefer not to use the CLI:
1. Open your Supabase Dashboard -> **SQL Editor**.
2. Run the SQL script located at:
   [`supabase/migrations/20261026000100_textilepay_production.sql`](supabase/migrations/20261026000100_textilepay_production.sql)
3. Run the second migration located at:
   [`supabase/migrations/20261026000200_multi_company_tenancy.sql`](supabase/migrations/20261026000200_multi_company_tenancy.sql)

### Database Entities Created:
- `companies`: Multi-tenant company registries with unique UUID identifiers.
- `profiles`: Core user profiles with roles (`owner`, `manager`, `worker`), approval status, section assignment, and pay type.
- `profile_private`: Segregated sensitive personal information (Aadhaar, Bank Account, IFSC, UPI ID, Emergency Contact).
- `orders`: Factory orders, client names, garment types, deadlines, quantities, piece rates, and six stage completion counts.
- `piece_rates`: Company-level rates for sections S1 through S6.
- `attendance`: Date-stamped worker attendance, shift statuses, and overtime hours.
- `submissions`: Piece-rate submission logs with stage, quantity, and status.
- `payments`: Wage disbursement records, payment method (UPI/Cash/Bank), transaction references, and timestamps.
- `app_settings`: Company-specific global overtime multipliers and configuration flags.

### Bootstrapping the Initial Factory Owner
Because public signups are disabled, bootstrap your initial company and owner using the administrator script:

```bash
SUPABASE_URL=https://your-project-id.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key \
COMPANY_NAME="Premier Textile Mills" \
OWNER_EMAIL=owner@premiertextiles.com \
OWNER_PASSWORD="SecureOwnerPassword123!" \
OWNER_NAME="Factory Owner" \
OWNER_USERNAME=premierowner \
pnpm owner:create
```

---

## 13. Development Commands

| Command | Purpose |
| :--- | :--- |
| `pnpm dev` | Launch local Vite development server with Hot Module Replacement (HMR) |
| `pnpm typecheck` | Run TypeScript compiler in `--noEmit` mode to verify type safety |
| `pnpm test` | Execute automated unit and integration tests with native Node test runner |
| `pnpm build` | Compile and bundle production assets into the `dist/` directory |
| `pnpm preview` | Locally preview the compiled production build from `dist/` |

---

## 14. Testing Commands

TextilePay includes a test suite verifying core payroll math, stage rollback logic, capacity constraints, UPI deep link generation, and role access structures:

```bash
# Run the complete test suite
pnpm test
```

### Test Coverage Highlights:
- **Piece-Rate Wage Math:** Exact multiplication and rate-matching.
- **Daily-Wage & Overtime Math:** Daily wage calculation + overtime rate and multiplier rules.
- **Manager Salary Computations:** Prorated fixed pay + logged overtime additions.
- **Statutory PF & ESI Deductions:** Precise 12% PF and 0.75% ESI calculation and netting.
- **Production Stage Progressions:** Validation preventing stage overflow.
- **Stage Rollback Algorithm:** Safe rollback of invalid stage quantities.
- **UPI URI Construction:** Valid parsing of `upi://pay?pa=...&pn=...&am=...&cu=INR`.

---

## 15. Production Build Commands

To build the project for production deployment:

```bash
pnpm build
```

The build executes `vite build`, compiling TypeScript and bundling CSS and assets into `dist/`.
To verify the output locally before pushing:

```bash
pnpm preview
```

---

## 16. GitHub Repository Setup

TextilePay is connected to the official repository:
[`https://github.com/SUJITBALA-33/textilepay-system`](https://github.com/SUJITBALA-33/textilepay-system)

### Initial Push Instructions:
```bash
# Verify current git status
git status

# Add remote if not already set
git remote add origin https://github.com/SUJITBALA-33/textilepay-system.git

# Stage all files
git add .

# Create the initial commit
git commit -m "Convert TextilePay project into GitHub-ready and Vercel-deployable application"

# Ensure main branch is targeted
git branch -M main

# Push to GitHub
git push -u origin main
```

---

## 17. Vercel Import & Deployment Steps

1. **Log in to Vercel:** Open [vercel.com](https://vercel.com) and log in with your GitHub account.
2. **Add New Project:** Click **Add New...** -> **Project**.
3. **Import Git Repository:** Select `SUJITBALA-33/textilepay-system`.
4. **Configure Project Settings:**
   - **Framework Preset:** Vite
   - **Root Directory:** `./`
   - **Build Command:** `pnpm build` (or leave default `vite build`)
   - **Output Directory:** `dist`
   - **Install Command:** `pnpm install`
5. **Add Environment Variables:** (See Section 18 below).
6. **Deploy:** Click **Deploy**. Vercel will build and assign an Edge-routed domain (e.g., `https://textilepay-system.vercel.app`).

---

## 18. Environment Variable Configuration in Vercel

In your Vercel Project Dashboard:
1. Navigate to **Settings → Environment Variables**.
2. Add the following variables for **Production**, **Preview**, and **Development**:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://your-project-id.supabase.co` | Your live Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsIn...` | Public anonymous key |

3. Trigger a redeployment in the **Deployments** tab by selecting **Redeploy** so the variables take effect during build time.

---

## 19. Backend Hosting Requirements

### Architecture Separation: Frontend vs Serverless API
- **Frontend SPA:** Hosted globally on **Vercel** with client-side SPA routing governed by [`vercel.json`](vercel.json).
- **Backend API & Auth:** Hosted directly on **Supabase Infrastructure**.
  - PostgreSQL database with Row Level Security.
  - Edge Function: `supabase/functions/make-server-32660b5b` running on Deno.

### Deploying the Edge Function:
The Edge Function handles administrative operations (such as user account creation by owners/managers):

```bash
# Deploy the Edge Function
supabase functions deploy make-server-32660b5b

# (Optional) Lock down CORS to your production Vercel domain
supabase secrets set ALLOWED_ORIGIN=https://textilepay-system.vercel.app
```

> [!NOTE]
> The Edge Function automatically receives `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` within the Supabase cloud environment. No manual secret injection into Vercel is needed for the backend API.

---

## 20. Common Errors & Solutions

### 1. `Authentication required (401)`
- **Cause:** User session token has expired or is missing from request headers.
- **Solution:** Sign out and log back in to refresh the Supabase Auth session token. Confirm `VITE_SUPABASE_URL` matches the deployed backend project.

### 2. `User profile is not configured`
- **Cause:** Database triggers have not executed or migration has not been applied.
- **Solution:** Run `supabase db push` to ensure triggers `on_auth_user_created` and table constraints are active.

### 3. `Account remains in "Pending" status`
- **Cause:** New manager and worker accounts require explicit approval by a factory Owner.
- **Solution:** Log in as an Owner, navigate to **Workers & Rates → Pending Approvals**, and click **Approve Worker**.

### 4. `Direct route navigation returns 404 on Vercel`
- **Cause:** Static hosts expect an index file for deep links on Single Page Applications.
- **Solution:** Handled automatically by [`vercel.json`](vercel.json) rewrites:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

### 5. `CORS Policy Block on Edge Function`
- **Cause:** Function origin header mismatch.
- **Solution:** Set `ALLOWED_ORIGIN` secret in Supabase CLI to your Vercel URL, or ensure the Edge Function returns `Access-Control-Allow-Origin: *`.

---

## 21. Security Notes

1. **Privileged Keys:** Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code or commit it to GitHub. It is used exclusively in `scripts/create-owner.mjs` and the Supabase Edge Function environment.
2. **Data Privacy (Aadhaar & Bank Data):** Sensitive identity data is partitioned into the `profile_private` table with dedicated RLS policies accessible only by the individual worker and authorized company owners.
3. **Multi-Factor Authentication (MFA):** Recommended for Owner accounts via the Supabase Auth dashboard.
4. **Financial Disclaimers:** TextilePay formats UPI payment intent strings for manual settlement. Always reconcile disbursements against your primary banking statement before closing payroll periods.

## 22. Multi-Company Onboarding and Tenant Security

There is no platform administrator role or public company-registration page. A trusted platform operator provisions each company with the `owner:create` script. Run it only from a secured operator machine with the Supabase service-role key in the process environment; never add that key to `VITE_*` variables, browser storage, or frontend code. The script creates an active company, its approved initial owner, company piece-rate defaults, and company settings. The database generates a UUID for each company. If Auth creation fails, the script attempts to roll back its new company and reports cleanup failures.

The first setup requires the production, multi-company, tenant-hardening, `20261027000200_remove_company_slugs.sql`, `20261027000300_dynamic_company_sections.sql`, `20261027000400_company_subscriptions.sql`, and `20261027000500_company_trial_30_days.sql` migrations. Review each migration, back up production data, and apply it through your normal Supabase change process; this repository does not run migrations automatically. The tenant-hardening migration makes Auth signup metadata create only pending workers and grants tenant context only to approved users in active companies. The slug migration removes the unused company slug column while preserving company records and related data. The dynamic sections migration creates a company-specific section catalog and JSON-backed order stages, migrating existing six-stage data forward.

Owners can reconfigure their factory pipeline in **Workers & Rates → Sections**. They can rename and reorder sections, add more, or deactivate ones they no longer use. Deactivated sections remain in historical records. The Create Account and approval forms offer that company's active sections, and production, submissions, and piece rates follow the same company-specific setup.

The shared login page asks for email and password only. After authentication, the Edge Function reads the user's trusted profile, loads that company's workspace, and returns its company name for the application header and dashboards. Users do not choose a company at login; company membership remains controlled by the database profile and RLS.

### SaaS Subscription Billing

TextilePay is priced at **₹499 INR per company per month** through Razorpay Subscriptions. Companies receive a 30-day trial, with days remaining shown after sign-in. Owners can manage billing from **Billing & Plan**; managers and workers share the company plan. After trial expiry, all operational API routes deny access until Razorpay confirms an active subscription. A cancelled or past-due subscription retains access only through its paid period end. Webhook updates are signature-checked and deduplicated before they change a company's access state.

Before enabling checkout, create a Razorpay **monthly INR ₹499** plan in the Razorpay Dashboard and set these as Supabase Edge Function secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID`, and `RAZORPAY_WEBHOOK_SECRET`. Do not add the key secret or webhook secret to Vercel frontend variables or commit them. Configure the Razorpay webhook to call:

```text
https://<project-ref>.supabase.co/functions/v1/make-server-32660b5b/make-server-32660b5b/billing/webhook
```

Subscribe to `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.resumed`, and `subscription.completed`. Apply `20261027000400_company_subscriptions.sql` and `20261027000500_company_trial_30_days.sql`, then deploy the updated `make-server-32660b5b` function. Use Razorpay Test Mode keys and a test plan first; switch to live keys and a live plan only after testing checkout and webhook renewal events.

Run the PostgreSQL isolation checks against a disposable local Supabase database with Docker available:

```bash
supabase start
supabase db reset
supabase test db
```

The SQL test creates two companies and four test accounts inside a transaction, tests tenant reads and writes under the `authenticated` role, then rolls its fixtures back. The existing Node tests do not connect to Supabase; the tenant API test checks the Edge Function with separate accounts for both companies. Do not use the service-role key to simulate normal-user authorization.

For the live API isolation check, provide two approved owner test accounts through `TENANT_TEST_SUPABASE_URL`, `TENANT_TEST_SUPABASE_ANON_KEY`, `TENANT_TEST_OWNER_A_EMAIL`, `TENANT_TEST_OWNER_A_PASSWORD`, `TENANT_TEST_OWNER_B_EMAIL`, and `TENANT_TEST_OWNER_B_PASSWORD`, then run `npm run test:tenant-api`. It uses each account's ordinary Auth session and performs workspace reads only.

---

## 23. License

All rights reserved. Proprietary software developed for TextilePay factory operations. Unauthorized copying, distribution, or deployment without explicit authorization from the repository owner is strictly prohibited.
