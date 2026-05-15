<p align="center">
  <img src="https://img.shields.io/badge/status-active-success.svg" alt="Status">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/python-3.11+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/next.js-14-black.svg" alt="Next.js">
  <img src="https://img.shields.io/badge/fastapi-0.115-teal.svg" alt="FastAPI">
</p>

<h1 align="center">🚀 SOCIALIUM</h1>
<p align="center"><strong>AI-Powered Social Media Management Platform</strong></p>
<p align="center">Autonomous content generation · Viral potential scoring · AI scheduling orchestrator · WhatsApp approval workflows</p>

---

## ✨ What is Socialium?

Socialium is an **AI-first social media management platform** that moves beyond manual scheduling into full autonomous content operations. It combines GPT-4o-mini content generation, 6-factor viral potential scoring, multi-layer audience activity prediction, and an AI scheduling orchestrator to handle the entire content lifecycle — from idea to published post — with minimal human intervention.

### Why Socialium?

- **Manual scheduling is dead** — AI scores every draft, predicts optimal posting times, and autonomously schedules high-potential content
- **Content quality gates** — Viral scoring engine prevents weak content from being published
- **Real observability** — Langfuse traces every AI call; PostHog tracks every scheduling decision
- **WhatsApp-native approval** — Stakeholders approve/reject posts via WhatsApp, not yet another dashboard

---

## 🏗 Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js 14)"]
        A[AI Content Generator]
        B[3-Column AI Scheduling UI]
        C[Analytics Dashboard]
        D[WhatsApp-linked Approval UI]
    end

    subgraph Backend["Backend (FastAPI)"]
        E[Content Service<br/>GPT-4o-mini]
        F[Viral Scoring Engine<br/>6-factor · 0-100]
        G[Audience Activity Analyzer<br/>5-layer prediction]
        H[AI Scheduling Orchestrator<br/>Auto-schedule decisions]
        I[WhatsApp Webhook<br/>Approval workflow]
    end

    subgraph Data["Data & Infra"]
        J[(PostgreSQL<br/>via Supabase)]
        K[(Qdrant<br/>Vector DB)]
        L[(Redis<br/>Cache)]
        M[Langfuse<br/>AI Observability]
        N[PostHog<br/>Product Analytics]
    end

    A --> E
    B --> F
    B --> G
    B --> H
    D --> I

    E --> K
    F --> L
    F --> J
    G --> L
    G --> J
    H --> F
    H --> G
    H --> J
    H --> N

    E -.-> M
    F -.-> M
    H -.-> M
```

---

## 🎯 Key Features

### 🤖 AI Content Generation
Generate platform-optimized social media posts from a simple topic prompt. Supports LinkedIn, Twitter/X, Instagram, and Facebook. Each generation is platform-aware — adjusting tone, hashtag count, character length, and engagement hooks per platform's algorithm.

### 🔥 Viral Potential Scoring Engine
Every draft is scored across **6 factors** (0–100 total) before scheduling:
| Factor | Weight | Method |
|---|---|---|
| Hook Strength | 0–20 | GPT-4o-mini rates opening line |
| Emotional Triggers | 0–20 | Pattern matching across 5 viral emotions |
| Trend Alignment | 0–20 | Cross-reference with cached trending keywords |
| Historical Performance | 0–20 | Qdrant similarity search vs past successful posts |
| Content Uniqueness | 0–10 | Penalizes near-duplicate content |
| Platform Algorithm Fit | 0–10 | Char length, hashtag count, boost/penalty keywords |

Scores cached in **Redis (30-min TTL)** and persisted to PostgreSQL for historical analysis.

### 📊 Audience Activity Analyzer
Predicts optimal posting times using **5 weighted data layers**:
1. **Workspace historical data** (0.40) — real engagement per hour/day from past 90 days
2. **Platform benchmarks** (0.25) — research-backed best times per audience segment
3. **Day-of-week intelligence** (0.20) — which days perform best for your brand
4. **Competitor quiet windows** (0.15) — post when competition is low
5. **Viral score modifier** — adjusts strategy (peak / pre-peak / off-peak)

Results cached in **Redis (4-hour TTL)** with activity snapshots persisted to PostgreSQL.

### ⚡ AI Scheduling Orchestrator
The central decision engine that **autonomously schedules content**:

| Viral Score | Confidence | Action |
|---|---|---|
| ≥ 65 | Any | ✅ **Auto-schedule** at peak time |
| 30–64 | ≥ 0.5 | 💬 **Confirm** — suggest best slot, user approves |
| < 50 | < 0.5 | 🕐 **Suggest times** — not enough data, user picks |
| < 30 | Any | ❌ **Improve content** — flagged for rewriting |

Supports **bulk scheduling** with automatic 2-hour gap deconfliction between posts.

### 📱 WhatsApp Approval Workflow
Stakeholders receive content drafts via WhatsApp and can **approve or reject** with a single reply. No dashboard login needed. Rejection triggers AI-powered regeneration with specific feedback incorporated.

### 📈 Analytics & A/B Testing
- Engagement analytics with follower activity tracking
- A/B testing engine with reinforcement learning
- Trend detection with 7-day and 1-hour change metrics

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | FastAPI (Python 3.11+), async SQLAlchemy, Pydantic v2 |
| **Database** | PostgreSQL (Supabase), SQLite (dev fallback) |
| **Vector DB** | Qdrant (content similarity, trend embeddings) |
| **Cache** | Redis (viral scores 30min TTL, activity 4hr TTL) |
| **AI / LLM** | OpenAI GPT-4o-mini, Anthropic Claude, Groq fallback |
| **Observability** | Langfuse (AI tracing), PostHog (product analytics) |
| **Scheduling** | APScheduler, Celery |
| **Payments** | Stripe |
| **Auth** | Supabase Auth (JWT) |
| **WhatsApp** | WapiHub / WATI API |

---

## 📁 Project Structure

```
socialium/
├── backend/
│   ├── app/
│   │   ├── core/           # Config, DB, Langfuse, Qdrant, OAuth state
│   │   ├── models/         # SQLAlchemy ORM models (11 models)
│   │   ├── routers/        # FastAPI route handlers (14 routers, 61 endpoints)
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   └── services/       # Business logic services (8 services)
│   ├── migrations/         # SQL migration files
│   ├── requirements.txt
│   └── celery_config.py
└── frontend/
    └── src/
        ├── app/            # Next.js App Router pages
        │   ├── (dashboard)/ # Analytics, Content, Scheduling, Platforms, Settings
        │   ├── login/
        │   └── signup/
        ├── components/     # Shared UI components
        ├── lib/            # Utility libraries
        ├── services/       # API client functions
        └── types/          # TypeScript type definitions
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL (or Supabase project)
- Redis (optional for caching)
- Qdrant (optional for vector search)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your keys (OpenAI, Supabase, Redis, etc.)

# Run database migrations
python migrate_collections.py

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000

# Start dev server
npm run dev
```

Visit `http://localhost:3000` for the frontend and `http://localhost:8000/docs` for the API docs.

### Environment Variables

<details>
<summary>Click to expand full env reference</summary>

```bash
# Backend (.env)
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/socialium
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
QDRANT_URL=http://localhost:6333
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
POSTHOG_API_KEY=phc_...
STRIPE_SECRET_KEY=sk_...
WAP_API_KEY=...
```

</details>

---

## 🔌 API Overview

| Group | Endpoints | Description |
|---|---|---|
| Auth | `/api/v1/auth/*` | Login, signup, token refresh |
| Workspace | `/api/v1/workspace/*` | CRUD + member management |
| Content | `/api/v1/content/*` | Generate, list, update, delete |
| Scheduling | `/api/v1/scheduling/*` | Manual + AI auto-scheduling, viral scores, optimal times |
| Analytics | `/api/v1/analytics/*` | Engagement, follower activity |
| Trends | `/api/v1/trends/*` | Trending keyword detection |
| A/B Testing | `/api/v1/ab-testing/*` | Experiment management |
| Approvals | `/api/v1/approvals/*` | Approval workflow via WhatsApp |
| Auto Reply | `/api/v1/auto-reply/*` | AI-powered comment replies |
| WhatsApp | `/api/v1/whatsapp/*` | Webhook for WhatsApp approval |
| Billing | `/api/v1/billing/*` | Stripe subscriptions |
| Platforms | `/api/v1/platforms/*` | OAuth connections |
| Memory | `/api/v1/memory/*` | AI context memory |

Full interactive API docs at `/docs` when running locally.

---

## 🧠 AI Scheduling Flow

```
Draft Created
    │
    ▼
Viral Scoring Engine (6 factors, 0-100)
    │
    ├── Score ≥ 65 ──▶ Auto-Schedule at Peak Time
    │
    ├── Score 30-64 ──▶ Audience Activity Analyzer
    │                      │
    │                      ├── High confidence ──▶ Confirm Schedule (user approves)
    │                      └── Low confidence ───▶ Suggest 3 Alternatives
    │
    └── Score < 30 ──▶ Flag for Improvement (AI suggests rewrite)
```

Every decision is tracked in PostHog and every AI call is traced in Langfuse.

---

## 📊 Observability

- **Langfuse** — Full trace of every OpenAI call: prompt, completion, token usage, latency. Traces are named by function (`viral-scoring`, `viral-hook-scoring`, `ai-auto-schedule`) for easy filtering.
- **PostHog** — Every scheduling decision fires `auto_schedule_decision` event with viral score, confidence, platform, and action taken.
- **Health endpoint** — `GET /health` returns service status including Langfuse connectivity.

---

## 🧪 Testing & Quality

- All backend functions fully implemented — **zero stubs, zero TODOs**
- Async SQLAlchemy for all database queries
- httpx `AsyncClient` with 15-second timeout for all external API calls
- Specific error messages with proper HTTP status codes — no generic 500s
- Redis gracefully degrades when unavailable (falls back to direct computation)

---

## 📄 License

MIT © 2025

---

<p align="center">
  <sub>Built with ❤️ for social media teams who want AI to do the heavy lifting.</sub>
</p>
