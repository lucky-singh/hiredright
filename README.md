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
│   └── api/                         # Backend API (Django 5.1, DRF 3.15)
│       ├── api/                     # REST API views & serializers (v1)
│       │   └── v1/
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
│       └── README.md                # Backend API documentation
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

2. **Set up virtual environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r apps/api/requirements.txt
   ```

3. **Run database migrations:**
   ```bash
   cd apps/api
   python manage.py migrate
   ```

### Seeding the Taxonomy

Taxonomy files are loaded idempotently from YAML definitions:

```bash
# Seed Statistical Programming taxonomy
python manage.py seed_taxonomy statistical-programming

# Preview changes without modifying the database
python manage.py seed_taxonomy statistical-programming --dry-run

# Prune and soft-deactivate removed items (without deleting candidate history)
python manage.py seed_taxonomy statistical-programming --prune
```

### Running Tests

Execute the table-driven test suite:

```bash
pytest apps/api/matching/tests/test_scoring.py -v
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
