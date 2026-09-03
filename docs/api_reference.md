# API Reference (v1)

> REST API contracts, payload schemas, batch update formats, and search interfaces for HireRight.

---

## Table of Contents

- [Overview & Base URLs](#overview--base-urls)
- [Authentication](#authentication)
- [Candidate Profile Builder Endpoints](#candidate-profile-builder-endpoints)
  - [1. Fetch Builder Working Set](#1-fetch-builder-working-set)
  - [2. Debounced Batch Claims Update](#2-debounced-batch-claims-update)
  - [3. Update Builder Progress](#3-update-builder-progress)
- [Candidate Profile & Resume Endpoints](#candidate-profile--resume-parsing-endpoints)
  - [1. Upload Resume for AI Parsing](#1-upload-resume-for-ai-parsing)
  - [2. Check Resume Parsing Status](#2-check-resume-parsing-status)
  - [3. Fetch Global Candidate Profile](#3-fetch-global-candidate-profile)
  - [4. Download a Resume](#4-download-a-resume)
- [Recruiter Search & Matching Endpoints](#recruiter-search--matching-endpoints)
  - [1. Fetch Skill Vocabulary](#1-fetch-skill-vocabulary)
  - [2. Search & Rank Candidates](#2-search--rank-candidates)
- [Operational Endpoints](#operational-endpoints)
- [Error Handling & Status Codes](#error-handling--status-codes)

---

## Overview & Base URLs

- **Base URL**: `/api/v1` (or `https://<tunnel-subdomain>.loca.lt/api/v1` in testing setups)
- **Content-Type**: `application/json`
- **Specification Standard**: OpenAPI 3.1 (via `drf-spectacular`)
- **Interactive schema**: `/api/v1/schema/` (raw), `/api/v1/schema/swagger/`, `/api/v1/schema/redoc/`
- **OAuth2 token endpoint**: `POST /o/token/`
- **Testing Header**: When querying the API via Localtunnel, requests must include `bypass-tunnel-reminder: true` to prevent HTML warning intercepts. The frontend's `apiFetch` sends this on every request.

---

## Authentication

- **Candidate Flows**: Bearer JWT (`djangorestframework-simplejwt`) / Session Auth.
- **Recruiter Service-to-Service**: OAuth2 client credentials (`django-oauth-toolkit`), scoped.

The frontend login request is:
```http
POST /api/v1/auth/login/
Content-Type: application/json

{"email": "demo@example.com", "password": "demo123"}
```

Create the local demo user before logging in with:
```bash
cd apps/api
source /home/lucky/Documents/projects/hiredright/.venv/bin/activate
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); u, created = User.objects.get_or_create(email='demo@example.com', defaults={'first_name': 'Demo', 'last_name': 'User'}); u.set_password('demo123'); u.save(); print(f'Created={created} Email={u.email}')"
```

The response returns an access token, which is then sent in the bearer header:
```http
Authorization: Bearer <access_token>
```

For local development the default database-backed demo login is:
- Email: `demo@example.com`
- Password: `demo123`


### User Registration

```http
POST /api/v1/auth/registration/
Content-Type: application/json

{
  "email": "user@example.com",
  "password1": "securepass123",
  "password2": "securepass123",
  "first_name": "Michael",
  "last_name": "Scott",
  "phone_number": "+14155552671"
}
```

- `first_name`, `last_name`, and `phone_number` are optional.

### Update Profile

```http
PUT /api/v1/auth/user/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "first_name": "Michael",
  "last_name": "Scott",
  "phone_number": "+14155552671"
}
```

- Updates the user's base profile details.

### Get Candidate Profile

```http
GET /api/v1/profile/
```
Returns `email`, `first_name`, `last_name`, `phone_number`, `is_recruiter`, the candidate's `roles`, resume proxy paths, and `claims`. Full schema below under [Fetch Global Candidate Profile](#3-fetch-global-candidate-profile).

### Recruiter access to search

`POST /api/v1/search/` is not open to ordinary candidate JWTs — it reads across
the whole candidate pool. Two credentials open it, and no third
(`HasRecruiterSearchScope | IsRecruiterUser`):

1. **Service-to-service** — an OAuth2 access token carrying the
   `candidates:search` scope. Register a confidential application (client type
   `confidential`, grant type `client-credentials`) in the admin, then:

   ```bash
   curl -X POST https://<host>/o/token/ \
     -u "<client_id>:<client_secret>" \
     -d grant_type=client_credentials \
     -d scope=candidates:search
   ```

2. **Browser dashboard** — a logged-in user whose `is_recruiter` flag is `True`.
   A confidential OAuth2 client cannot live in a single-page app, so the flag is
   what keeps this path narrow; being authenticated is not sufficient.

A candidate JWT, or a token without that scope, receives `403`, not `401`.

---

## Candidate Profile Builder Endpoints



### GET `/api/v1/roles/`
**Authentication**: Required

Fetches all active job roles available for candidate onboarding, ordered by `sort_order` then `label`. Cached for 24 hours; taxonomy model signals clear the cache on change.

#### Response

```json
[
  {
    "code": "statistical-programming",
    "label": "Statistical Programming",
    "description": "Clinical statistical programming across CDISC standards, TLF production, regulatory submission, and therapeutic-area analysis."
  },
  {
    "code": "clinical-research-associate",
    "label": "Clinical Research Associate",
    "description": "Site execution, trial monitoring, clinical operations logistics, and cross-functional site management."
  },
  {
    "code": "clinical-data-management",
    "label": "Clinical Data Management",
    "description": "Database architecture, edit check logic, medical coding, vendor reconciliation, and overall data governance."
  }
]
```

### 1. Fetch Builder Working Set

Retrieves the entire role taxonomy tree, current candidate claims, and builder progress in a single dense payload.

```http
GET /api/v1/builder/{role_code}/
```

#### Path Parameters
- `role_code` (string, required): Slug of the role (e.g. `statistical-programming`).

#### Response: `200 OK`
```json
{
  "role": {
    "code": "statistical-programming",
    "label": "Statistical Programming",
    "description": "Clinical statistical programming across CDISC standards...",
    "competency_areas": [
      {
        "code": "cdisc-sdtm",
        "label": "CDISC SDTM",
        "description": "Converting raw clinical data into standardised tabulation formats.",
        "activities": [
          {
            "code": "sdtm-implementation-guide",
            "label": "SDTM Implementation Guide versions",
            "help_text": "Select every version you have worked to.",
            "claim_type": "proficiency",
            "seniority_hint": "mid",
            "variants": ["3.1.2", "3.2", "3.3", "3.4"]
          },
          {
            "code": "sdtm-general-observation-classes",
            "label": "General observation classes",
            "help_text": "Interventions, Events, and Findings domains.",
            "claim_type": "activity",
            "seniority_hint": "mid",
            "variants": []
          }
        ]
      }
    ]
  },
  "claims": [
    {
      "activity_code": "sdtm-implementation-guide",
      "proficiency": 3,
      "years_experience": "4.5",
      "last_used_year": 2025,
      "variants": ["3.2", "3.3"],
      "is_ai_inferred": true
    }
  ],
  "progress": {
    "role_code": "statistical-programming",
    "completed_area_codes": ["core-programming"],
    "last_area_code": "cdisc-sdtm",
    "completed_at": null
  },
  "years_experience": "6.0"
}
```

---

### 2. Debounced Batch Claims Update

Performs an atomic batch synchronization of candidate activity claims. Supports upserts and removals.

```http
POST /api/v1/builder/claims/
```

#### Request Payload (`ClaimBatchSerializer`)
- `claims` (array of `ClaimWriteSerializer`, max 200 items):
  - `activity_code` (string, required): Slug of the activity. Must exist and be active.
  - `claimed` (boolean, optional, default: `true`): If `false`, deletes the claim.
  - `proficiency` (integer, optional, `1` to `4`): Proficiency rating.
  - `years_experience` (decimal, optional, `0.0` to `60.0`).
  - `last_used_year` (integer, optional, `1980` to current year).
  - `variants` (array of strings, optional, default: `[]`). Must be a subset of
    that activity's declared `variants`.

The endpoint rejects the whole batch with `400` rather than partially applying it
when a code is unknown/inactive, a variant is not offered by the activity, or a
code appears twice — a partial success would report `synced_count` while
silently dropping a candidate's answer.

```json
{
  "claims": [
    {
      "activity_code": "sdtm-implementation-guide",
      "claimed": true,
      "proficiency": 4,
      "years_experience": "5.0",
      "last_used_year": 2026,
      "variants": ["3.2", "3.3", "3.4"]
    },
    {
      "activity_code": "sdtm-custom-domains",
      "claimed": false
    }
  ]
}
```

#### Response: `200 OK`
```json
{
  "status": "success",
  "synced_count": 2
}
```

---

### 3. Update Builder Progress

Updates the candidate's wizard progress state so they can resume on another device.

```http
PUT /api/v1/builder/progress/
```

#### Request Payload (`BuilderProgressSerializer`)
- `role_code` (string, required): Which role's builder this progress belongs to.
- `completed_area_codes` (array of strings, optional).
- `last_area_code` (string, optional).

```json
{
  "role_code": "statistical-programming",
  "completed_area_codes": ["core-programming", "cdisc-sdtm"],
  "last_area_code": "cdisc-adam"
}
```

#### Response: `200 OK`
```json
{
  "role_code": "statistical-programming",
  "completed_area_codes": ["core-programming", "cdisc-sdtm"],
  "last_area_code": "cdisc-adam",
  "completed_at": null
}
```

A candidate has one progress row, so switching `role_code` moves the row
rather than creating a second one.

---


---

## Candidate Profile & Resume Parsing Endpoints

### 1. Upload Resume for AI Parsing

Uploads a PDF resume and triggers background Celery extraction via Gemini LLM.

```http
POST /api/v1/profile/resume/
```

#### Request Payload (Multipart Form Data)
- `resume` (file, required): The PDF resume.
- `roleCode` (string, required): The role taxonomy slug to guide the LLM context. Must match an active role, else `404`.

The file is stored twice — as a role-specific `CandidateResume` and on `CandidateProfile.resume` — under the generated name `<FirstName>_<LastName>_<role-code>_Resume.pdf` (falling back to `Candidate` when no name is set). Re-uploading for the same role replaces that role's record.

`GET` on this URL returns a short hint object rather than data; it exists so the endpoint is browsable.

#### Response: `202 Accepted`
```json
{
  "detail": "Resume uploaded successfully, processing started.",
  "task_id": "c3515991-a9b1-41b7-aae3-7ea21279c8c1"
}
```

- `400 Bad Request` when no `resume` file is present in the request.

---

### 2. Check Resume Parsing Status

Polls the background extraction status.

```http
GET /api/v1/profile/resume/status/{task_id}/
```

#### Path Parameters
- `task_id` (string, required): The Celery task ID returned by the upload endpoint.

#### Response: `200 OK`
```json
{
  "task_id": "c3515991-a9b1-41b7-aae3-7ea21279c8c1",
  "status": "SUCCESS",
  "result": null
}
```
*`status` is the raw Celery state (`PENDING`, `STARTED`, `SUCCESS`, `FAILURE`, …). `result` is the task's return value coerced to a string, or `null` — `parse_resume_task` returns nothing on success, so a completed parse reports `"status": "SUCCESS"` with `"result": null`; the claims it created are visible via `GET /api/v1/profile/`.*

---

### 3. Fetch Global Candidate Profile

Returns a read-only aggregation of the candidate's metadata, the roles they are building, and all claims across those roles.

```http
GET /api/v1/profile/
```

#### Response: `200 OK`
```json
{
  "email": "demo@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone_number": "+14155552671",
  "is_recruiter": false,
  "resume": "/api/v1/profile/resume/download/",
  "roles": [
    {
      "code": "statistical-programming",
      "label": "Statistical Programming",
      "resume": "/api/v1/profile/resume/download/statistical-programming/"
    }
  ],
  "claims": [
    {
      "activity_code": "sdtm-implementation-guide",
      "activity_label": "SDTM Implementation Guide",
      "proficiency": 3,
      "category": "CDISC SDTM",
      "category_sort_order": 1,
      "role_code": "statistical-programming",
      "is_ai_inferred": true,
      "years_experience": "4.5",
      "last_used_year": 2025
    }
  ]
}
```

`resume` and `roles[].resume` are **Django proxy paths, not storage URLs** — see the download endpoint below. Either may be absent when no resume has been uploaded. `roles` is assembled from the candidate's `BuilderProgress` rows and `CandidateResume` rows; a claim whose role is covered by neither still gets its parent role added so it is never orphaned. `claims` are emitted once per competency area the activity belongs to, each tagged with the owning `role_code`; an activity attached to no area is reported with `category: "General"` and `role_code: null`.

---

### 4. Download a Resume

Streams the stored PDF back through Django instead of exposing the MinIO/S3 URL, so an HTTPS frontend never issues a plain-HTTP request to object storage and trips browser Mixed Content blocking.

```http
GET /api/v1/profile/resume/download/
GET /api/v1/profile/resume/download/{role_code}/
```

#### Path Parameters
- `role_code` (string, optional): Returns that role's `CandidateResume`. Omitted, the endpoint returns `CandidateProfile.resume`.

#### Response: `200 OK`
The file bytes, with `Content-Type` taken from storage (defaulting to `application/pdf`) and `Content-Disposition: inline; filename="…"`. If the proxy fetch fails the endpoint falls back to a redirect to the underlying storage URL.

- `404` when the profile, the role's resume, or the file itself is missing.
- Requires the candidate's JWT; a candidate can only download their own resume.

Because the response is a file rather than JSON, the frontend fetches it with an explicit `Authorization` header and turns the response into a blob rather than using a plain `<a href>`.

---

## Recruiter Search & Matching Endpoints

### 1. Fetch Skill Vocabulary

Fetches the full searchable skill vocabulary, scoped to scorable claim types.

```http
GET /api/v1/skills/
```

#### Query Parameters
- `role` (string, optional): Role code to filter skills by.
- `q` (string, optional): Free-text match on label, code or help text.
- `include_traits` (boolean, optional): Include TRAIT items. Default is `false`.

#### Response: `200 OK`
```json
{
  "count": 1,
  "results": [
    {
      "code": "sdtm-implementation-guide",
      "label": "SDTM Implementation Guide",
      "help_text": "Select every version you have worked to.",
      "claim_type": "proficiency",
      "seniority_hint": "mid",
      "variants": ["3.1.2", "3.2", "3.3", "3.4"],
      "areas": [
        {
          "code": "cdisc-sdtm",
          "label": "CDISC SDTM",
          "sort_order": 1,
          "role_code": "statistical-programming",
          "role_label": "Statistical Programming"
        }
      ]
    }
  ]
}
```

Traits are excluded by default because a TRAIT code passed to search matches nobody — the pre-filter only counts scorable claim types — so offering them as chips would hand recruiters a guaranteed-empty query. `areas` is a list because activities are many-to-many with competency areas; passing `role` narrows both the results and each skill's reported areas. Responses are cached for 24 hours and invalidated by taxonomy model signals.

### 2. Search & Rank Candidates

Scores, ranks, and returns matching candidates against a structured query.

```http
POST /api/v1/search/
```

#### Request Payload
- `required_activity_codes` (array of strings): Mandatory activity codes.
- `optional_activity_codes` (array of strings): Preferred activity codes.
- `required_variants` (object): Map of `{ activity_code: [variants] }`. Keys must
  appear in `required_activity_codes` — a variant constraint on a code nobody
  searched for would be silently inert.
- `include_near_misses` (boolean, default: `false`): Include candidates missing variant or required codes.
- `limit` (integer, default: `50`, max: `100`).

At least one of `required_activity_codes` / `optional_activity_codes` must be
non-empty; an unconstrained search returns `400` rather than the entire pool
scored at zero.

```json
{
  "required_activity_codes": [
    "sdtm-implementation-guide",
    "adam-implementation-guide",
    "define-xml"
  ],
  "optional_activity_codes": [
    "p21-enterprise",
    "r-shiny"
  ],
  "required_variants": {
    "sdtm-implementation-guide": ["3.3"],
    "define-xml": ["2.1"]
  },
  "include_near_misses": true,
  "limit": 20
}
```

#### Response: `200 OK`

Each of `matched_required`, `missing_required`, `matched_optional` and `other_skills` is a list of **full skill objects** (the `/skills/` shape: `code`, `label`, `help_text`, `claim_type`, `seniority_hint`, `variants`, `areas`), enriched with the candidate's `proficiency`, `years_experience` and `last_used_year`. `missing_required` entries carry no claim metadata — by definition the candidate has no claim on them. `other_skills` lists scorable claims the candidate holds that the query did not ask about.

```json
{
  "count": 1,
  "results": [
    {
      "profile_id": 482,
      "score": 0.9425,
      "score_pct": 94,
      "meets_requirements": true,
      "matched_required": [
        {
          "code": "sdtm-implementation-guide",
          "label": "SDTM Implementation Guide",
          "help_text": "Select every version you have worked to.",
          "claim_type": "proficiency",
          "seniority_hint": "mid",
          "variants": ["3.1.2", "3.2", "3.3", "3.4"],
          "areas": [
            {
              "code": "cdisc-sdtm",
              "label": "CDISC SDTM",
              "sort_order": 1,
              "role_code": "statistical-programming",
              "role_label": "Statistical Programming"
            }
          ],
          "proficiency": 3,
          "years_experience": "4.5",
          "last_used_year": 2025
        }
      ],
      "missing_required": [],
      "matched_optional": [],
      "other_skills": []
    }
  ]
}
```

No candidate PII is returned — only `profile_id` and match diagnostics.

---

## Operational Endpoints

### Health Check

```http
GET /api/v1/health/
```

Unauthenticated (used by the Kubernetes readiness probe in `k8s/base/api-deployment.yaml`). Executes `SELECT 1` against the database.

- `200 OK` — `{"status": "ok", "database": "connected"}`
- `503 Service Unavailable` — `{"status": "error", "database": "disconnected", "details": "…"}`

---

## Error Handling & Status Codes

| Status Code | Meaning | Example Scenario |
| :--- | :--- | :--- |
| `200 OK` | Success | Query executed or claims synchronized. |
| `202 Accepted` | Queued | Resume uploaded; Celery parsing started. |
| `400 Bad Request` | Validation Error | Duplicate `activity_code` in batch, unknown activity code, variant not offered by the activity, `last_used_year` outside `1980..current_year`, a search with no activity codes, a `required_variants` key not in `required_activity_codes`, or a resume upload with no file. |
| `401 Unauthorized` | Authentication Missing | Missing or expired JWT / OAuth2 token. |
| `403 Forbidden` | Permission Denied | Search called with a candidate JWT, or a token lacking the `candidates:search` scope. |
| `404 Not Found` | Resource Missing | Invalid or inactive `role_code` on the builder or upload path; no resume on the download path. |
| `503 Service Unavailable` | Dependency Down | `/api/v1/health/` could not reach the database. |
