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
- **Recruiter Service-to-Service**: OAuth2 Tokens (`django-oauth-toolkit`).

Header format:
```http
Authorization: Bearer <access_token>
```

---

## Candidate Profile Builder Endpoints

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
      "variants": ["3.2", "3.3"]
    }
  ],
  "progress": {
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
  - `activity_code` (string, required): Slug of the activity.
  - `claimed` (boolean, optional, default: `true`): If `false`, deletes the claim.
  - `proficiency` (integer, optional, `1` to `4`): Proficiency rating.
  - `years_experience` (decimal, optional, `0.0` to `60.0`).
  - `last_used_year` (integer, optional, `1980` to current year).
  - `variants` (array of strings, optional, default: `[]`).

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
```json
{
  "completed_area_codes": ["core-programming", "cdisc-sdtm"],
  "last_area_code": "cdisc-adam"
}
```

#### Response: `200 OK`
```json
{
  "completed_area_codes": ["core-programming", "cdisc-sdtm"],
  "last_area_code": "cdisc-adam",
  "completed_at": null
}
```

---

## Recruiter Search & Matching Endpoints

### 1. Search & Rank Candidates

Scores, ranks, and returns matching candidates against a structured query.

```http
POST /api/v1/search/
```

#### Request Payload
- `required_activity_codes` (array of strings): Mandatory activity codes.
- `optional_activity_codes` (array of strings): Preferred activity codes.
- `required_variants` (object): Map of `{ activity_code: [variants] }`.
- `include_near_misses` (boolean, default: `false`): Include candidates missing variant or required codes.
- `limit` (integer, default: `50`, max: `100`).

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
| `400 Bad Request` | Validation Error | Duplicate `activity_code` in batch or invalid variant. |
| `401 Unauthorized` | Authentication Missing | Missing or expired JWT token. |
| `403 Forbidden` | Permission Denied | Recruiter attempting to access private profile. |
| `404 Not Found` | Resource Missing | Invalid `function_code` specified. |
| `422 Unprocessable` | Domain Constraint | `last_used_year` is outside allowed range `1980..current_year`. |
