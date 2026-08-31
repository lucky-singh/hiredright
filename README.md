# HireRight

> Specialized talent intelligence and matching engine for clinical trials and pharmaceutical development.

HireRight replaces noisy keyword-based resume searches with a structured, verified domain taxonomy and a deterministic, pure-function candidate matching engine.

---

## Table of Contents

- [Overview](#overview)
- [Architecture & Monorepo Structure](#architecture--monorepo-structure)
- [Core Concepts](#core-concepts)
  - [1. Domain Taxonomy](#1-domain-taxonomy)
  - [2. Claim Types & Signal Quality](#2-claim-types--signal-quality)
  - [3. Pure Scoring & Matching Algorithm](#3-pure-scoring--matching-algorithm)
  - [4. Single-Payload Candidate Builder](#4-single-payload-candidate-builder)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Setup](#installation--setup)
  - [Seeding the Taxonomy](#seeding-the-taxonomy)
  - [Running Tests](#running-tests)
- [Documentation Index](#documentation-index)

---

## Overview

Traditional recruitment platforms fail in clinical research and life sciences because generic keyword matching cannot differentiate between candidate exposure, active production, and version-specific regulatory requirements (e.g. CDISC SDTM IG 3.3 vs 3.2, Define-XML 2.1, Pinnacle 21 issue resolution, or ISS/ISE data pooling).

HireRight solves this through:
- **A 107-parameter Clinical Statistical Programming Taxonomy** structured hierarchically into Functions, Competency Areas, and Activities.
- **Granular Activity Claims** with proficiency levels (1–4), years of experience, recency tracking, and version multi-select variants.
- **A Deterministic Matching Engine** that pre-filters candidate pools in SQL and scores matches using a pure, table-tested mathematical algorithm factoring in proficiency, recency decay, and variant overlap.
- **A Zero-Latency Profile Builder** with debounced server-side autosave and cross-device resume capabilities.

---

## Architecture & Monorepo Structure

```
hiredright/
├── apps/
│   └── api/                         # Backend API (Django 5.2, DRF 3.15+)
│       ├── manage.py                # Django CLI entrypoint
│       ├── Dockerfile               # API container image
│       ├── config/                  # Project configuration
│       │   ├── settings/            # base.py, dev.py, prod.py (env-driven)
│       │   ├── urls.py              # Root routing (admin, auth, OAuth2, schema)
│       │   ├── wsgi.py / asgi.py    # Server entrypoints
│       │   └── celery.py            # Celery app (queue for CV parsing, etc.)
│       ├── accounts/                # Custom User (email-first) + allauth + JWT
│       │   ├── models.py            # User (email, phone, verification flags)
│       │   └── sms/backends.py      # Pluggable OTP SMS backends
│       ├── api/                     # REST API views & serializers (v1)
│       │   └── v1/
│       │       ├── views.py         # BuilderView, ClaimBatchView, SearchView
│       │       ├── urls.py          # /api/v1/ route table
│       │       ├── permissions.py   # OAuth2 scope gate for recruiter search
│       │       └── serializers.py   # Dense builder & batch sync serializers
│       ├── matching/                # Matching engine & pure scoring
│       │   ├── scoring.py           # Pure scoring function & dataclasses
│       │   ├── search.py            # SQL pre-filter & candidate search pipeline
│       │   └── tests/
│       │       └── test_scoring.py  # Table-driven test suite
│       ├── profiles/                # Candidate profiles, claims & progress
│       │   └── models.py            # CandidateProfile, ActivityClaim, BuilderProgress
│       ├── taxonomy/                # Taxonomy domain engine
│       │   ├── models.py            # Function, CompetencyArea, Activity
│       │   ├── management/
│       │   │   └── commands/
│       │   │       └── seed_taxonomy.py # Idempotent YAML seed runner
│       │   └── seed/
│       │       └── statistical_programming.yaml # 107-item seed breakdown
│       ├── requirements.txt         # Python dependencies
│       ├── pytest.ini               # pytest-django configuration
│       └── README.md                # Backend API documentation
├── docker-compose.yml               # postgres, redis, minio, api, worker
├── .env.example                     # Environment variable template
├── docs/                            # Deep-dive documentation
│   ├── architecture.md              # System design & architectural patterns
│   ├── matching_engine.md           # Mathematical specification of scoring
│   ├── taxonomy_guide.md            # Taxonomy authoring & seed guide
│   └── api_reference.md             # REST API contracts & payload schemas
└── README.md                        # Root project documentation (this file)
```

---

## Core Concepts

### 1. Domain Taxonomy
The taxonomy is structured into three levels:
$$\text{Function} \longrightarrow \text{CompetencyArea} \longrightarrow \text{Activity}$$

- **Function** (e.g. `statistical-programming`): Top-level pharma discipline.
- **CompetencyArea** (e.g. `core-programming`, `cdisc-sdtm`, `cdisc-adam`, `tlf-biostatistics`, `regulatory-submissions`, `therapeutic-areas`, `integrated-summaries`, `tools-systems-automation`, `leadership-oversight`): Steps within the candidate builder.
- **Activity** (e.g. `sdtm-implementation-guide`, `base-sas`, `sap-interpretation`): Atomic items that candidates claim and recruiters search against.

### 2. Claim Types & Signal Quality
To prevent score inflation and preserve data integrity, activities are classified into three types:
- `activity`: Verifiable tasks performed (e.g., *Double programming*, *Define-XML generation*). **Feeds match scoring.**
- `proficiency`: Working knowledge with tools or languages (e.g., *SAS Macro*, *R Tidyverse*). **Feeds match scoring.**
- `trait`: Self-reported dispositions (e.g., *Quality mindset*, *Scope management*). **Excluded from match scoring** because near-universal self-claims create noise without ranking signal.

### 3. Pure Scoring & Matching Algorithm
The matching engine is split into two layers:
1. **SQL Pre-filter (`search.py`)**: Uses database-level aggregations (`Count(..., distinct=True)`) to eliminate non-matching or private profiles before Python execution.
2. **Pure Function Scorer (`scoring.py`)**: Consumes immutable dataclasses (`Claim`, `Query`) and computes normalized scores ($[0.0, 1.0]$) accounting for:
   - **Proficiency Multipliers**: Exposed (0.6), Working (0.85), Proficient (1.0), Expert (1.15).
   - **Recency Decay**: Full credit for work within 2 years; 5% linear decay per year beyond, with a hard floor of 0.55 (old experience retains value).
   - **Variant Overlaps**: Version matching for multi-select standards (e.g. SDTM IG 3.3).
   - **Near-Miss Surfacing**: Candidates missing a variant or requirement are still scored and returned with diagnostic difference tuples (`missing_required`, `matched_required`).

### 4. Single-Payload Candidate Builder
The candidate profile builder loads all necessary data (function taxonomy tree, existing claims, builder progress state) in a single request (`BuilderPayloadSerializer`). Writes are debounced on the client and sent in batches up to 200 items (`ClaimBatchSerializer`), with server-side progress persistence (`BuilderProgress`) ensuring candidates never lose work across devices.

---

## Getting Started

### Prerequisites
- Python 3.11+ (or 3.12/3.14)
- PostgreSQL 15+ (or SQLite for local prototyping)
- Redis 7+ (for caching and Celery queues)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repo-url> hiredright
   cd hiredright
   ```

2. **Start infrastructure (PostgreSQL, Redis, MinIO):**
   ```bash
   cp .env.example .env
   docker compose up -d db redis minio
   ```

   `.env` stays at the repo root — Docker Compose and a bare `runserver` both
   read that one file. (An `apps/api/.env` overrides it if you need two API
   instances on different databases.)

3. **Set up virtual environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r apps/api/requirements.txt
   ```

4. **Run database migrations:**
   ```bash
   cd apps/api
   python manage.py migrate
   ```

   The default settings module is `config.settings.dev` (SQLite-free; PostgreSQL
   via Docker Compose). Override with `DJANGO_SETTINGS_MODULE=config.settings.prod`
   for production.

5. **Run the development server:**
   ```bash
   python manage.py runserver
   ```

   Or run the backend stack (API + Celery worker + DB) entirely in Docker:
   ```bash
   docker compose up -d
   ```
   *(Note: Database data is safely persisted via Docker named volumes (`pgdata`). Do not run `docker compose down -v` unless you intentionally want to wipe your local database).*

### Running the Frontend UI

The frontend is a Vite + React application located in `apps/web`. It runs on your host machine (rather than in Docker) to provide the fastest possible Hot Module Replacement (HMR) and developer experience.

1. **Ensure the backend is running** via Docker:
   ```bash
   docker compose up -d
   ```
2. **Start the UI:**
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```
   *This starts the Vite dev server (usually on `http://localhost:5173`) which points to your local backend API.*

6. **Create the local demo user in PostgreSQL-backed auth:**
   The frontend logs into the API through the normal Django auth flow. Create a local dev user before testing the builder:

   ```bash
   cd apps/api
   source /home/lucky/Documents/projects/hiredright/.venv/bin/activate
   python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); u, created = User.objects.get_or_create(email='demo@example.com', defaults={'first_name': 'Demo', 'last_name': 'User'}); u.set_password('demo123'); u.save(); print(f'Created={created} Email={u.email}')"
   ```

   This creates the local demo account in the configured PostgreSQL database.

7. **Log in for local development:**
   The frontend uses the Django REST auth API at `/api/v1/auth/login/` and stores the returned JWT in localStorage.

   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/login/ \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@example.com","password":"demo123"}'
   ```

   For a local database-backed demo flow, the dev user is:
   - Email: `demo@example.com`
   - Password: `demo123`

   The candidate builder autosaves by posting claim deltas to `/api/v1/builder/claims/` with the bearer token.

### Seeding the Taxonomy

Taxonomy files are loaded idempotently from YAML definitions:

```bash
# Seed Statistical Programming taxonomy
python manage.py seed_taxonomy statistical-programming

# Seed Clinical Operations taxonomy
python manage.py seed_taxonomy clinical-operations

# Preview changes without modifying the database
python manage.py seed_taxonomy statistical-programming --dry-run

# Prune and soft-deactivate removed items (without deleting candidate history)
python manage.py seed_taxonomy statistical-programming --prune
```

### Running Tests

The suite is split by whether a test needs a database. The scoring core is pure,
so its tests run instantly with nothing else up:

```bash
cd apps/api
pytest matching/tests/test_scoring.py -v
```

Everything else is ORM-backed and needs PostgreSQL running (`docker compose up -d db`):

```bash
cd apps/api
pytest -v
```

| Suite | Needs a database | Covers |
| :--- | :---: | :--- |
| `matching/tests/test_scoring.py` | no | Ranking maths: proficiency, recency decay, variant overlap, normalisation |
| `matching/tests/test_search.py` | yes | SQL pre-filter, its agreement with the scorer, ranking and limits |
| `api/v1/tests/test_builder.py` | yes | Dense builder payload, resume state |
| `api/v1/tests/test_claims.py` | yes | Batch autosave validation and upsert/delete semantics |
| `api/v1/tests/test_search_endpoint.py` | yes | Recruiter scope authorization and the query contract |

### Code Quality

```bash
cd apps/api
ruff check .
ruff format --check .
```

---

## Documentation Index

| Document | Description |
| :--- | :--- |
| [**Architecture Guide**](docs/architecture.md) | Architectural principles, system design, data flows, and performance guarantees. |
| [**Matching Engine Specification**](docs/matching_engine.md) | Mathematical formulas, weights, recency decay curves, variant satisfaction, and test suites. |
| [**Taxonomy Guide**](docs/taxonomy_guide.md) | Authoring taxonomy YAMLs, claim semantics, seniority hints, version variants, and seed lifecycle. |
| [**API Reference**](docs/api_reference.md) | REST API endpoints, serializers, batch claim sync contracts, and query schemas. |
| [**Backend API Guide**](apps/api/README.md) | Django application structure, models, database constraints, and development workflow. |

### Recruiter Search Dashboard
The system includes a dedicated Recruiter Search interface (`http://localhost:3000/search`) allowing authenticated recruiters to search candidate profiles. 
- You must create a user with the `is_recruiter=True` flag in the Django admin to access the underlying API endpoints (`/api/v1/search/`).
- The login page automatically detects the `is_recruiter` role on login and redirects recruiters to the Search Dashboard, while standard candidates are routed to the Profile Builder.
- The dashboard allows configuring multiple skill requirements (Required vs. Optional) per function and instantly calculates a candidate % match score via the internal `scoring.py` engine based on skill recency and proficiency.
- A global User Menu is available in the top right corner across all authenticated pages to display the active profile's role and allow quick navigation.

## Smart Resume Parsing (AI)
HireRight features an intelligent resume parsing engine powered by Google Gemini (e.g., `gemini-2.5-flash`).
1. **Upload**: Users upload their PDF resume on the frontend Builder screen.
2. **Storage**: The document is securely pushed to MinIO via `django-storages`.
3. **Queue**: A Celery task (`parse_resume_task`) is dispatched into the Redis queue.
4. **Extraction**: The worker extracts raw text via `pypdf`.
5. **Contextual Matching**: The text, along with the *context-specific* taxonomy for the active job function, is sent to Gemini.
6. **Auto-Fill**: Gemini returns a JSON object of validated Activity codes which are automatically inserted as `ActivityClaim` rows in Postgres.
