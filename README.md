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
- **A 107-parameter Clinical Statistical Programming Taxonomy** structured hierarchically into Roles, Competency Areas, and Activities.
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
│       │   ├── scoring.py           # Pure scoring role & dataclasses
│       │   ├── search.py            # SQL pre-filter & candidate search pipeline
│       │   └── tests/
│       │       └── test_scoring.py  # Table-driven test suite
│       ├── profiles/                # Candidate profiles, claims & progress
│       │   └── models.py            # CandidateProfile, ActivityClaim, BuilderProgress
│       ├── taxonomy/                # Taxonomy domain engine
│       │   ├── models.py            # Role, CompetencyArea, Activity
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
$$\text{Role} \longrightarrow \text{CompetencyArea} \longrightarrow \text{Activity}$$

- **Role** (e.g. `statistical-programming`): Top-level pharma discipline.
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
| [**Matching Engine Specification**](docs/matching_engine.md) | Mathematical formulas, weights, recency decay curves, variant satisfaction, and test suites. |
| [**Taxonomy Guide**](docs/taxonomy_guide.md) | Authoring taxonomy YAMLs, claim semantics, seniority hints, version variants, and seed lifecycle. |
| [**API Reference**](docs/api_reference.md) | REST API endpoints, serializers, batch claim sync contracts, and query schemas. |
| [**Backend API Guide**](apps/api/README.md) | Django application structure, models, database constraints, and development workflow. |

### Recruiter Search Dashboard
The system includes a dedicated Recruiter Search interface (`http://localhost:3000/search`) allowing authenticated recruiters to search candidate profiles. 
- You must create a user with the `is_recruiter=True` flag in the Django admin to access the underlying API endpoints (`/api/v1/search/`).
- The login page automatically detects the `is_recruiter` role on login and redirects recruiters to the Search Dashboard, while standard candidates are routed to the Profile Builder.
- The dashboard allows configuring multiple skill requirements (Required vs. Optional) per role and instantly calculates a candidate % match score via the internal `scoring.py` engine based on skill recency and proficiency.
- A global User Menu is available in the top right corner across all authenticated pages to display the active profile's role and allow quick navigation.

## Smart Resume Parsing (AI)
HireRight features an intelligent resume parsing engine powered by Google Gemini (e.g., `gemini-3.6-flash`).
1. **Upload**: Users upload their PDF resume on the frontend Builder screen.
2. **Storage**: The document is securely pushed to MinIO via `django-storages`.
3. **Queue**: A Celery task (`parse_resume_task`) is dispatched into the Redis queue.
4. **Extraction**: The worker extracts raw text via `pypdf`.
5. **Contextual Matching**: The text, along with the *context-specific* taxonomy for the active job role, is sent to Gemini.
6. **Auto-Fill**: Gemini returns a JSON object of validated Activity codes which are automatically inserted as `ActivityClaim` rows in Postgres.

---

## Interactive Static Demo
An interactive, static demonstration of the HiredRight platform journey is available at `/demo`. This page uses mocked state to showcase the resume upload, AI extraction, skills review, profile generation, and candidate search experience without requiring a backend or database.

### Deploying the Demo to GitHub Pages
To publish the static demo to GitHub Pages:
1. Build the frontend: `cd apps/web && npm run build`
2. Prepare routing for GH Pages: `cp dist/index.html dist/404.html`
3. Push the `dist/` folder to your `gh-pages` branch. (Remember to configure `base` in `vite.config.ts` if deploying to a subdirectory).

