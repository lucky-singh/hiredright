# HireRight Backend API (`apps/api`)

> Django 5.2 & Django REST Framework (DRF) backend powering the HireRight talent intelligence platform, taxonomy engine, candidate profile builder, and matching algorithm.

---

## Table of Contents

- [App Architecture](#app-architecture)
  - [`taxonomy`](#taxonomy)
  - [`profiles`](#profiles)
  - [`matching`](#matching)
  - [`api/v1`](#apiv1)
- [Database Models & Constraints](#database-models--constraints)
- [Management Commands](#management-commands)
  - [`seed_taxonomy`](#seed_taxonomy)
- [Matching Engine Integration](#matching-engine-integration)
- [API Serializers & Payload Design](#api-serializers--payload-design)
- [Local Development & Testing](#local-development--testing)

---

## App Architecture

```
apps/api/
├── manage.py                        # Django CLI entrypoint
├── Dockerfile                       # API container image
├── config/                          # Project configuration
│   ├── settings/{base,dev,prod}.py  # Env-driven settings per environment
│   ├── urls.py                      # Root URL routing
│   ├── wsgi.py / asgi.py            # Server entrypoints
│   └── celery.py                    # Celery app
├── accounts/                        # Custom User + allauth + JWT
│   ├── models.py                    # User (email-first, phone, verification)
│   └── sms/backends.py              # Pluggable OTP SMS backends
├── api/
│   └── v1/
│       ├── views.py                 # BuilderView, ClaimBatchView, SearchView
│       ├── urls.py                  # /api/v1/ route table
│       ├── permissions.py           # OAuth2 scope gate for recruiter search
│       └── serializers.py           # Serializers for builder & batch sync
├── matching/
│   ├── scoring.py                   # Pure mathematical scoring function (no ORM)
│   ├── search.py                    # Candidate profile search & SQL pre-filter
│   └── tests/
│       └── test_scoring.py          # Table-driven unit tests
├── profiles/
│   └── models.py                    # CandidateProfile, ActivityClaim, BuilderProgress
├── taxonomy/
│   ├── models.py                    # Role, CompetencyArea, Activity
│   ├── management/
│   │   └── commands/
│   │       └── seed_taxonomy.py     # Seed loader management command
│   └── seed/
│       └── statistical_programming.yaml # Clinical statistical programming taxonomy
├── pytest.ini                       # pytest-django configuration
└── requirements.txt                 # Backend dependencies
```

---

### `taxonomy`

Defines the domain taxonomy model hierarchy:
$$\text{Role} \xrightarrow{\text{1:N}} \text{CompetencyArea} \xrightarrow{\text{1:N}} \text{Activity}$$

- **`Role`**: A major life sciences discipline (e.g. `statistical-programming`).
- **`CompetencyArea`**: Groupings representing stages in the profile builder (e.g. `cdisc-sdtm`, `cdisc-adam`, `tlf-biostatistics`, `regulatory-submissions`).
- **`Activity`**: The fundamental, tickable item claimed by candidates and queried by recruiters.

#### Activity Fields & Rules
- `code`: The stable public API slug (e.g. `sdtm-implementation-guide`). Changing labels is safe; changing `code` is a breaking contract.
- `claim_type`:
  - `activity`: Verifiable task performed (scorable).
  - `proficiency`: Tool/language proficiency (scorable).
  - `trait`: Self-reported disposition (excluded from scoring).
- `seniority_hint`: `junior`, `mid`, `senior`, `lead`. Drives builder suggestion chips; never auto-claims.
- `variants`: JSON list of allowed version strings (e.g. `["3.1.2", "3.2", "3.3", "3.4"]`).
- `is_scorable`: Boolean property returning `True` for `activity` and `proficiency`.

---

### `profiles`

Encapsulates candidate identities, verified claims, and wizard progress:

- **`CandidateProfile`**: Extends Django's user model with headline, ISO 3166-1 country code, availability status (`open_to_opportunities`), and recruiter search visibility (`is_searchable`).
- **`CandidateRole`**: Links candidate to a primary or secondary role with verified `years_experience`.
- **`CandidateResume`**: Stores role-specific uploaded resumes for a candidate. Eliminates cross-role contamination so a user can maintain separate PDFs for different roles.
- **`ActivityClaim`**: A candidate's assertion of having performed an `Activity`.
  - `proficiency`: 1 (`EXPOSED`), 2 (`WORKING`), 3 (`PROFICIENT`), 4 (`EXPERT`).
  - `years_experience`: Decimal field (0 to 60 years).
  - `last_used_year`: Integer (1980 to current year) used for recency decay.
  - `variants`: Subset of `Activity.variants` claimed by the candidate.
- **`BuilderProgress`**: Server-side autosave tracking completed area codes, current position, and completion timestamps. Prevents loss of candidate progress across devices.

---

### `matching`

The matching module is architecturally decoupled into two layers:

1. **`search.py` (ORM & I/O Layer)**:
   - Queries `CandidateProfile` where `is_searchable=True` and `open_to_opportunities=True`.
   - Pre-filters candidate IDs in SQL using `Count(distinct=True)` to ensure all required activity codes are present before loading claim rows.
   - Converts ORM querysets into lightweight immutable `Claim` dataclasses.
2. **`scoring.py` (Pure Functional Core)**:
   - Pure function `score(claims, query, today=None) -> MatchResult`.
   - Zero ORM or request dependencies, enabling instant table-driven testing without database overhead.

---

### `api/v1`

Optimized for high responsiveness and zero-latency user flows:

- **`BuilderPayloadSerializer`**: Consolidates the complete role tree, existing user claims, and builder progress into a single JSON payload. Eliminates interactive loading spinners during candidate onboarding.
- **`ClaimBatchSerializer`**: Ingests debounced batches of up to 200 claim updates. Supports upserts and deletions (`claimed: false`). Validates against duplicate activity codes in a single batch.

The views (`api/v1/views.py`) expose four endpoints:

| Endpoint | Method | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/v1/builder/{role_code}/` | `GET` | Candidate JWT | Single dense payload powering the builder |
| `/api/v1/builder/claims/` | `POST` | Candidate JWT | Debounced batch upsert/delete of claim deltas |
| `/api/v1/builder/progress/` | `PUT` | Candidate JWT | Server-side resume state |
| `/api/v1/search/` | `POST` | OAuth2 `candidates:search` | Recruiter matching |
| `/api/v1/profile/` | `GET` | Candidate JWT | Candidate summary, including multiple `roles` selected by the candidate and all `claims` annotated with `role_code`. |

#### Write-path validation

`update_or_create` does not run model `clean()`, so the claim batch endpoint
validates before it writes, in `ClaimBatchView`:

- every `activity_code` must exist and be `is_active` — an unknown code fails the
  batch rather than being skipped, because a silent skip would report success
  while discarding a candidate's answer;
- `variants` must be a subset of that activity's declared `variants`, or a stale
  client could store `"3.9"` against SDTM IG and poison every later variant search;
- `last_used_year` cannot exceed the current year.

#### Recruiter search authorization

Search reads across the entire candidate pool, so `IsAuthenticated` is not
sufficient — a candidate's own JWT must not open it. `HasRecruiterSearchScope`
(`api/v1/permissions.py`) requires an OAuth2 access token whose scope includes
`candidates:search` (registered in `OAUTH2_PROVIDER["SCOPES"]`). Tokens are
issued at `POST /o/token/` with `grant_type=client_credentials`.

---

### `accounts`

Email-first authentication supporting three candidate entry paths in one library:

- **Email** — passwordless magic link (allauth).
- **Mobile** — OTP via a pluggable `SMSBackend` (`accounts/sms/backends.py`); console backend in dev.
- **LinkedIn** — OIDC social login via allauth's generic `openid_connect`
  provider, configured with `provider_id: linkedin` and LinkedIn's discovery
  document. Deliberately *not* allauth's `linkedin_oauth2` provider: that one
  still calls the retired v1 profile projections (`/v2/me?projection=…`) with the
  `r_liteprofile` / `r_emailaddress` scopes, which LinkedIn no longer issues.

`SMS_BACKEND` defaults to the console backend in dev and is **required** in prod —
`config/settings/prod.py` reads it with no fallback, because silently printing a
login OTP into a production log would hand accounts to anyone with log access.

The custom `User` model (`accounts/models.py`) drops `username` in favour of a
unique `email`, and carries `phone_number`, `email_verified`, and
`phone_verified` flags. Account linking is keyed by verified email, so a
candidate who starts with email and later uses LinkedIn lands in the same
profile. API tokens are JWT (short access, rotating refresh) via
`dj-rest-auth` + `simplejwt`; recruiter service-to-service auth is separate
OAuth2 client-credentials via `django-oauth-toolkit`.

For local development, the frontend authenticates against
`POST /api/v1/auth/login/` and stores the returned access token in browser
localStorage. The default dev account is created with the following command and
then used in the browser UI:

```bash
cd apps/api
source /home/lucky/Documents/projects/hiredright/.venv/bin/activate
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); u, created = User.objects.get_or_create(email='demo@example.com', defaults={'first_name': 'Demo', 'last_name': 'User'}); u.set_password('demo123'); u.save(); print(f'Created={created} Email={u.email}')"
```

- Email: `demo@example.com`
- Password: `demo123`

The builder autosave endpoint is `POST /api/v1/builder/claims/` and persists the
candidate claim delta batch in PostgreSQL for the authenticated user.

---

## Database Models & Constraints

| Model | Table / Constraint | Description |
| :--- | :--- | :--- |
| `CompetencyArea` | `uniq_area_code_per_role` | Unique `(role, code)` |
| `Activity` | Unique `code` | Global slug for API stability |
| `CandidateRole` | `uniq_role_per_profile` | Unique `(profile, role)` |
| `CandidateResume` | `uniq_resume_per_profile_role` | Unique `(profile, role)` |
| `ActivityClaim` | `uniq_claim_per_profile_activity` | Unique `(profile, activity)` preventing race condition duplicates |
| `ActivityClaim` | Index `(activity, profile)` | Fast reverse lookup for recruiter search queries |
| `ActivityClaim` | Index `(profile, activity)` | Fast claim fetching during builder initialization |

---

## Management Commands

### `seed_taxonomy`

Loads or synchronizes domain taxonomies from YAML seed files into the database.

```bash
# Basic seed from default path (taxonomy/seed/<role_code>.yaml)
python manage.py seed_taxonomy statistical-programming

# Seed from a custom path
python manage.py seed_taxonomy statistical-programming --path /path/to/custom_taxonomy.yaml

# Dry run mode (validates and reports changes without saving to DB)
python manage.py seed_taxonomy statistical-programming --dry-run

# Prune mode (soft-deactivates DB activities not present in the seed file)
python manage.py seed_taxonomy statistical-programming --prune
```

#### Safe Deactivation Strategy (`--prune`)
Because `ActivityClaim.activity` uses `on_delete=models.PROTECT`, database rows are never deleted. When an activity is removed from a seed file and pruned, it is marked `is_active=False`. This prevents it from appearing in new profile builders while preserving historical claims and audit trails.

---

## Matching Engine Integration

### Invocation Example

```python
from matching.scoring import Query
from matching.search import search_candidates

# Search for a Senior CDISC Programmer
query = Query(
    required_activity_codes=frozenset({
        "sdtm-implementation-guide",
        "adam-implementation-guide",
        "define-xml",
    }),
    optional_activity_codes=frozenset({
        "p21-enterprise",
        "r-shiny",
        "ta-solid-tumor-oncology",
    }),
    required_variants={
        "sdtm-implementation-guide": frozenset({"3.3"}),
        "define-xml": frozenset({"2.1"}),
    }
)

# Search candidates (top 20)
results = search_candidates(query, limit=20, include_near_misses=False)

for ranked in results:
    print(f"Profile ID: {ranked.profile_id} | Score: {ranked.result.score_pct}%")
    print(f"  Matched Required: {ranked.result.matched_required}")
    print(f"  Matched Optional: {ranked.result.matched_optional}")
```

---

## Local Development & Testing

### Running Tests

Run the pure scoring test suite:

```bash
pytest matching/tests/test_scoring.py -v
```

### Code Quality & Linting

Run Ruff to ensure compliance with PEP 8 and formatting standards:

```bash
ruff check .
ruff format --check .
```
