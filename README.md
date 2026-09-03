# HireRight

> Specialized talent intelligence and matching engine for clinical trials and pharmaceutical development.

HireRight replaces noisy keyword-based resume searches with a structured, verified domain taxonomy and a deterministic, pure-role candidate matching engine.

---

## Table of Contents

- [Overview](#overview)
- [Architecture & Monorepo Structure](#architecture--monorepo-structure)
- [Core Concepts](#core-concepts)
  - [1. Domain Taxonomy](#1-domain-taxonomy)
  - [2. Claim Types & Signal Quality](#2-claim-types--signal-quality)
  - [3. Pure Scoring & Matching Algorithm](#3-pure-scoring--matching-algorithm)
  - [4. Single-Payload Candidate Builder](#4-single-payload-candidate-builder)
- [Development & Contributing](#development--contributing)
- [Documentation Index](#documentation-index)

---

## Overview

Traditional recruitment platforms fail in clinical research and life sciences because generic keyword matching cannot differentiate between candidate exposure, active production, and version-specific regulatory requirements (e.g. CDISC SDTM IG 3.3 vs 3.2, Define-XML 2.1, Pinnacle 21 issue resolution, or ISS/ISE data pooling).

HireRight solves this through:
- **Three seeded domain taxonomies** — Statistical Programming (122 activities), Clinical Research Associate (150), and Clinical Data Management (150) — each spanning 14 competency areas and structured hierarchically into Roles, Competency Areas, and Activities.
- **Granular Activity Claims** with proficiency levels (1–4), years of experience, recency tracking, and version multi-select variants.
- **A Deterministic Matching Engine** that pre-filters candidate pools in SQL and scores matches using a pure, table-tested mathematical algorithm factoring in proficiency, recency decay, and variant overlap.
- **A Zero-Latency Profile Builder** with debounced server-side autosave and cross-device resume capabilities.

---

## Architecture & Monorepo Structure

```
hiredright/
├── apps/
│   ├── api/                         # Backend API (Django 5.2, DRF 3.15+)
│   │   ├── manage.py                # Django CLI entrypoint
│   │   ├── Dockerfile               # Dev container image (runserver)
│   │   ├── Dockerfile.prod          # Multi-stage production image (Gunicorn)
│   │   ├── config/                  # Project configuration
│   │   │   ├── settings/            # base.py, dev.py, prod.py (env-driven)
│   │   │   ├── urls.py              # Root routing (admin, auth, OAuth2, schema)
│   │   │   ├── wsgi.py / asgi.py    # Server entrypoints
│   │   │   └── celery.py            # Celery app (queue for CV parsing, etc.)
│   │   ├── accounts/                # Custom User (email-first) + allauth + JWT
│   │   │   ├── models.py            # User (email, phone, verification, is_recruiter)
│   │   │   └── sms/backends.py      # Pluggable OTP SMS backends
│   │   ├── api/                     # REST API views & serializers (v1)
│   │   │   └── v1/
│   │   │       ├── views.py         # Builder, claims, search, resume, profile, health
│   │   │       ├── urls.py          # /api/v1/ route table
│   │   │       ├── permissions.py   # OAuth2 scope + is_recruiter gates for search
│   │   │       ├── serializers.py   # Dense builder & batch sync serializers
│   │   │       ├── auth_serializers.py # Custom registration serializer
│   │   │       └── tests/           # auth, builder, claims, skills, search, resume, health
│   │   ├── matching/                # Matching engine & pure scoring
│   │   │   ├── scoring.py           # Pure scoring function & dataclasses
│   │   │   ├── search.py            # SQL pre-filter & candidate search pipeline
│   │   │   └── tests/               # test_scoring.py (pure), test_search.py (ORM)
│   │   ├── profiles/                # Candidate profiles, claims & progress
│   │   │   ├── models.py            # CandidateProfile, CandidateRole, CandidateResume,
│   │   │   │                        # ActivityClaim, BuilderProgress
│   │   │   └── tasks.py             # Celery `parse_resume_task` (Gemini extraction)
│   │   ├── taxonomy/                # Taxonomy domain engine
│   │   │   ├── models.py            # Role, CompetencyArea, Activity (+ cache signals)
│   │   │   ├── management/commands/seed_taxonomy.py # Idempotent YAML seed runner
│   │   │   ├── seed/                # statistical_programming.yaml (122 activities)
│   │   │   │                        # clinical_research_associate.yaml (150)
│   │   │   │                        # clinical_data_management.yaml (150)
│   │   │   └── tests/               # test_models.py, test_seed.py
│   │   ├── requirements.txt         # Python dependencies
│   │   ├── pytest.ini               # pytest-django configuration
│   │   └── README.md                # Backend API documentation
│   └── web/                         # Frontend SPA (React 19, Vite, TypeScript)
│       ├── src/
│       │   ├── App.tsx              # Route table (react-router-dom v7)
│       │   ├── pages/               # login, signup, functions, profile, search, demo,
│       │   │                        # forgot-password, reset-password
│       │   ├── components/builder/  # Builder shell, steps, sidebar, selectors
│       │   ├── components/ui/       # Base UI primitives (button, card, input, …)
│       │   ├── hooks/               # use-claim-sync (500ms debounce), use-progress
│       │   ├── lib/api/             # client.ts, auth.ts, builder.ts, search.ts, types.ts
│       │   └── stores/              # builder-store.ts (Zustand)
│       ├── nginx/default.conf       # SPA routing + static caching for prod image
│       ├── Dockerfile.prod          # Multi-stage build → Nginx
│       ├── vite.config.ts           # Dev server :3000, /api proxy, Vitest config
│       └── README.md                # Frontend guide
├── docker-compose.yml               # db, redis, minio, createbuckets, api, worker
├── k8s/base/                        # Cloud-agnostic Kubernetes manifests
├── terraform/aws/                   # EKS + RDS provisioning (main.tf, variables.tf)
├── .github/workflows/               # tests.yml, production-deploy.yml, gitleaks.yml
├── .env.example                     # Environment variable template
├── docs/                            # Deep-dive documentation
│   ├── architecture.md              # System design & architectural patterns
│   ├── deployment.md                # Terraform / Kubernetes production strategy
│   ├── matching_engine.md           # Mathematical specification of scoring
│   ├── taxonomy_guide.md            # Taxonomy authoring & seed guide
│   └── api_reference.md             # REST API contracts & payload schemas
├── CONTRIBUTING.md                  # Local setup, seeding, tests
└── README.md                        # Root project documentation (this file)
```

---

## Core Concepts

### 1. Domain Taxonomy
The taxonomy is structured into three levels:
$$\text{Role} \longrightarrow \text{CompetencyArea} \longrightarrow \text{Activity}$$

- **Role**: Top-level pharma discipline. Three are seeded today:
  | Role code | Label | Competency areas | Activities |
  | :--- | :--- | :---: | :---: |
  | `statistical-programming` | Statistical Programming | 14 | 122 |
  | `clinical-research-associate` | Clinical Research Associate | 14 | 150 |
  | `clinical-data-management` | Clinical Data Management | 14 | 150 |
- **CompetencyArea**: Steps within the candidate builder. For Statistical Programming these are `core-programming`, `cdisc-sdtm`, `cdisc-adam`, `tlf-biostatistics`, `regulatory-submissions`, `therapeutic-areas`, `integrated-summaries`, `tools-systems-automation`, `leadership-oversight`, `ai-ml-automation`, `python-ecosystem`, `rwe-omop`, `cloud-native-computing`, and `complex-therapeutics-designs`.
- **Activity** (e.g. `sdtm-implementation-guide`, `base-sas`, `sap-interpretation`): Atomic items that candidates claim and recruiters search against. Activities attach to competency areas many-to-many, so a shared item such as ICH-GCP compliance is reused across roles rather than duplicated.

### 2. Claim Types & Signal Quality
To prevent score inflation and preserve data integrity, activities are classified into three types:
- `activity`: Verifiable tasks performed (e.g., *Double programming*, *Define-XML generation*). **Feeds match scoring.**
- `proficiency`: Working knowledge with tools or languages (e.g., *SAS Macro*, *R Tidyverse*). **Feeds match scoring.**
- `trait`: Self-reported dispositions (e.g., *Quality mindset*, *Scope management*). **Excluded from match scoring** because near-universal self-claims create noise without ranking signal.

### 3. Pure Scoring & Matching Algorithm
The matching engine is split into two layers:
1. **SQL Pre-filter (`search.py`)**: Uses database-level aggregations (`Count(..., distinct=True)`) to eliminate non-matching or private profiles before Python execution.
2. **Pure Role Scorer (`scoring.py`)**: Consumes immutable dataclasses (`Claim`, `Query`) and computes normalized scores ($[0.0, 1.0]$) accounting for:
   - **Proficiency Multipliers**: Exposed (0.6), Working (0.85), Proficient (1.0), Expert (1.15).
   - **Recency Decay**: Full credit for work within 2 years; 5% linear decay per year beyond, with a hard floor of 0.55 (old experience retains value).
   - **Variant Overlaps**: Version matching for multi-select standards (e.g. SDTM IG 3.3).
   - **Near-Miss Surfacing**: Candidates missing a variant or requirement are still scored and returned with diagnostic difference tuples (`missing_required`, `matched_required`).

### 4. Single-Payload Candidate Builder
The candidate profile builder loads all necessary data (role taxonomy tree, existing claims, builder progress state) in a single request (`BuilderPayloadSerializer`). Writes are debounced on the client and sent in batches up to 200 items (`ClaimBatchSerializer`), with server-side progress persistence (`BuilderProgress`) ensuring candidates never lose work across devices.

---

## Development & Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for full instructions on:
- Prerequisites and local setup
- Running the frontend and backend
- Seeding the taxonomy database
- Running the test suites and code quality checks
- Production deployment preparations

## Documentation Index

| Document | Description |
| :--- | :--- |
| [**Architecture Guide**](docs/architecture.md) | Architectural principles, system design, data flows, and performance guarantees. |
| [**Deployment Guide**](docs/deployment.md) | Production deployment strategy using Terraform, Kubernetes, and AWS. |
| [**Matching Engine Specification**](docs/matching_engine.md) | Mathematical formulas, weights, recency decay curves, variant satisfaction, and test suites. |
| [**Taxonomy Guide**](docs/taxonomy_guide.md) | Authoring taxonomy YAMLs, claim semantics, seniority hints, version variants, and seed lifecycle. |
| [**API Reference**](docs/api_reference.md) | REST API endpoints, serializers, batch claim sync contracts, and query schemas. |
| [**Backend API Guide**](apps/api/README.md) | Django application structure, models, database constraints, and development workflow. |
| [**Frontend Guide**](apps/web/README.md) | React frontend architecture, Vite configuration, routing, and state management. |

### Recruiter Search Dashboard
The system includes a dedicated Recruiter Search interface (`http://localhost:3000/search`) allowing authenticated recruiters to search candidate profiles.
- `/api/v1/search/` accepts **two** credentials and no third (`HasRecruiterSearchScope | IsRecruiterUser`): an OAuth2 client-credentials token carrying the `candidates:search` scope (service-to-service), or a logged-in user whose `is_recruiter` flag is `True` (the browser dashboard). A plain candidate JWT is rejected with `403`.
- Create a user with `is_recruiter=True` in the Django admin to use the dashboard.
- The login page reads `is_recruiter` off the auth response and redirects recruiters to the Search Dashboard, while standard candidates are routed to the Profile Builder.
- The dashboard allows configuring multiple skill requirements (Required vs. Optional) per role and instantly calculates a candidate % match score via the internal `scoring.py` engine based on skill recency and proficiency.
- Results carry no candidate PII — only `profile_id` and match diagnostics.
- A global User Menu is available in the top right corner across all authenticated pages to display the active profile's role and allow quick navigation.

## Smart Resume Parsing (AI)
HireRight features an intelligent resume parsing engine powered by Google Gemini (`gemini-3.6-flash`, via the `google-genai` SDK).
1. **Upload**: Users upload their PDF resume on the frontend Builder screen, tagged with the role they are building.
2. **Storage**: The document is pushed to MinIO via `django-storages`, stored both as a role-specific `CandidateResume` and on `CandidateProfile.resume`. Files are named `<Name>_<role-code>_Resume.pdf`.
3. **Queue**: A Celery task (`parse_resume_task`) is dispatched into the Redis queue.
4. **Extraction**: The worker extracts raw text via `pypdf`.
5. **Contextual Matching**: The text, along with the *context-specific* taxonomy for the active job role, is sent to Gemini with `response_mime_type: application/json`.
6. **Auto-Fill**: Gemini returns a JSON object of validated Activity codes which are inserted as `ActivityClaim` rows in Postgres with `is_ai_inferred=True`. If `GEMINI_API_KEY` is unset the task logs a warning and creates no claims.

### Resume downloads
Resumes are served through Django rather than by linking at MinIO directly. `GET /api/v1/profile/resume/download/` (global) and `/api/v1/profile/resume/download/<role_code>/` (role-specific) stream the file back through the API, so an HTTPS-hosted frontend never issues a plain-HTTP request to MinIO and trips browser Mixed Content blocking. `GET /api/v1/profile/` therefore returns these proxy paths in `resume` and `roles[].resume`, not raw storage URLs.

---

## Interactive Static Demo
An interactive, static demonstration of the HiredRight platform journey is available at `/demo`. This page uses mocked state to showcase the resume upload, AI extraction, skills review, profile generation, and candidate search experience without requiring a backend or database.

### Deploying the Demo to GitHub Pages
To publish the static demo to GitHub Pages:
1. Build the frontend: `cd apps/web && npm run build`
2. Prepare routing for GH Pages: `cp dist/index.html dist/404.html`
3. Push the `dist/` folder to your `gh-pages` branch. (Remember to configure `base` in `vite.config.ts` if deploying to a subdirectory).


### GitHub Pages & Localtunnel Testing Setup
To allow the GitHub Pages frontend to securely communicate with a local backend exposed via Localtunnel, the following configurations have been implemented:
1. **Frontend**: API requests are dynamic via the `VITE_API_URL` environment variable, ensuring the frontend knows the Localtunnel backend address.
2. **CORS & Headers**: Django `ALLOWED_HOSTS` includes the `.loca.lt` domain, and `CORS_ALLOWED_ORIGINS` includes `https://lucky-singh.github.io`.
3. **Localtunnel Warnings**: API calls include the `bypass-tunnel-reminder: true` header to bypass Localtunnel's anti-abuse interstitial page, preventing 511 Network Authentication Required errors on POST and preflight requests.

*Note for future AWS Deployment: When deploying the API to AWS (e.g., EC2, ECS, or AppRunner), you will need to update `VITE_API_URL` to your production API URL, update Django's `ALLOWED_HOSTS` to your AWS domain, and ensure `CORS_ALLOWED_ORIGINS` matches the frontend's final production domain.*
