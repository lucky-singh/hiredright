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
- [Recruiter Search & Matching Endpoints](#recruiter-search--matching-endpoints)
  - [1. Search & Rank Candidates](#1-search--rank-candidates)
- [Error Handling & Status Codes](#error-handling--status-codes)

---

## Overview & Base URLs

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json`
- **Specification Standard**: OpenAPI 3.1 (via `drf-spectacular`)

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

### Recruiter tokens

`POST /api/v1/search/` is not open to candidate JWTs — it reads across the whole
candidate pool, so it requires an OAuth2 access token carrying the
`candidates:search` scope. Register a confidential application (client type
`confidential`, grant type `client-credentials`) in the admin, then:

```bash
curl -X POST https://<host>/o/token/ \
  -u "<client_id>:<client_secret>" \
  -d grant_type=client_credentials \
  -d scope=candidates:search
```

A token without that scope receives `403`, not `401`.

---

## Candidate Profile Builder Endpoints



### GET `/api/v1/functions/`
**Authentication**: Required

Fetches all active job functions available for candidate onboarding.

#### Response

```json
[
  {
    "code": "statistical-programming",
    "label": "Statistical Programming",
    "description": "Clinical statistical programming across CDISC standards..."
  },
  {
    "code": "clinical-operations",
    "label": "Clinical Operations",
    "description": "Clinical Research Associate (CRA) monitoring, site execution..."
  }
]
```

### 1. Fetch Builder Working Set

Retrieves the entire function taxonomy tree, current candidate claims, and builder progress in a single dense payload.

```http
GET /api/v1/builder/{function_code}/
```

#### Path Parameters
- `function_code` (string, required): Slug of the function (e.g. `statistical-programming`).

#### Response: `200 OK`
```json
{
  "function": {
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
    "function_code": "statistical-programming",
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
- `function_code` (string, required): Which function's builder this progress belongs to.
- `completed_area_codes` (array of strings, optional).
- `last_area_code` (string, optional).

```json
{
  "function_code": "statistical-programming",
  "completed_area_codes": ["core-programming", "cdisc-sdtm"],
  "last_area_code": "cdisc-adam"
}
```

#### Response: `200 OK`
```json
{
  "function_code": "statistical-programming",
  "completed_area_codes": ["core-programming", "cdisc-sdtm"],
  "last_area_code": "cdisc-adam",
  "completed_at": null
}
```

A candidate has one progress row, so switching `function_code` moves the row
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
- `functionCode` (string, required): The function taxonomy slug to guide the LLM context.

#### Response: `202 Accepted`
```json
{
  "detail": "Resume processing started in background.",
  "task_id": "c3515991-a9b1-41b7-aae3-7ea21279c8c1"
}
```

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
  "result": 12
}
```
*Note: `status` can be `PENDING`, `SUCCESS`, or `FAILURE`. `result` on success is the count of skills created.*

---

### 3. Fetch Global Candidate Profile

Returns read-only aggregation of the candidate's metadata and all verified claims.

```http
GET /api/v1/profile/
```

#### Response: `200 OK`
```json
{
  "email": "demo@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "resume": "http://localhost:9000/hiredright/resumes/Jane_Doe_CV.pdf",
  "claims": [
    {
      "activity_code": "sdtm-implementation-guide",
      "activity_label": "SDTM Implementation Guide",
      "proficiency": 3,
      "category": "CDISC SDTM",
      "category_sort_order": 1,
      "is_ai_inferred": true,
      "years_experience": "4.5",
      "last_used_year": 2025
    }
  ]
}
```

## Recruiter Search & Matching Endpoints

### 1. Search & Rank Candidates

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
        "adam-implementation-guide",
        "define-xml",
        "sdtm-implementation-guide"
      ],
      "missing_required": [],
      "matched_optional": [
        "p21-enterprise"
      ]
    }
  ]
}
```

---

## Error Handling & Status Codes

| Status Code | Meaning | Example Scenario |
| :--- | :--- | :--- |
| `200 OK` | Success | Query executed or claims synchronized. |
| `400 Bad Request` | Validation Error | Duplicate `activity_code` in batch, unknown activity code, variant not offered by the activity, `last_used_year` outside `1980..current_year`, or a search with no activity codes. |
| `401 Unauthorized` | Authentication Missing | Missing or expired JWT / OAuth2 token. |
| `403 Forbidden` | Permission Denied | Token lacks the `candidates:search` scope. |
| `404 Not Found` | Resource Missing | Invalid `function_code` on the builder path. |
