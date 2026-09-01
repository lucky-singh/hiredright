# Taxonomy Authoring & Seed Guide

> Guide for defining, maintaining, validating, and seeding clinical and pharmaceutical domain taxonomies in HireRight.

---

## Table of Contents

- [Taxonomy Architecture](#taxonomy-architecture)
- [YAML Seed File Format](#yaml-seed-file-format)
  - [Role Specification](#role-specification)
  - [Competency Area Specification](#competency-area-specification)
  - [Activity Specification](#activity-specification)
- [Activity Field Semantics](#activity-field-semantics)
  - [`claim_type`](#claim_type)
  - [`seniority_hint`](#seniority_hint)
  - [`variants`](#variants)
  - [`source_ref`](#source_ref)
- [Reference Breakdown: Statistical Programming](#reference-breakdown-statistical-programming)
- [Adding a New Domain Role](#adding-a-new-domain-role)
- [Seeding & Validation Lifecycle](#seeding--validation-lifecycle)
  - [Seeding Command](#seeding-command)
  - [Validation Rules](#validation-rules)
  - [Pruning & Soft-Deactivation](#pruning--soft-deactivation)

---

## Taxonomy Architecture

HireRight structures professional domains into a three-tier hierarchy:

$$\text{Role} \longleftrightarrow \text{CompetencyArea} \longleftrightarrow \text{Activity}$$

1. **Role**: Top-level job specialization (e.g. `statistical-programming`, `clinical-operations`).
2. **CompetencyArea**: Thematic step in the candidate builder flow, typically containing 8–15 activities (e.g. `cdisc-sdtm`, `site-visit-execution`).
3. **Activity**: The atomic, scorable skill, deliverable, or tool proficiency that candidates claim and recruiters query. Activities are connected via a **Many-to-Many** relationship, meaning a single activity (e.g. "ICH-GCP Compliance") can be reused across multiple competency areas and roles without data duplication.

---

## YAML Seed File Format

Taxonomy definitions are stored in `apps/api/taxonomy/seed/<role_code>.yaml`.

### Complete Example Structure

```yaml
role:
  code: statistical-programming
  label: Statistical Programming
  description: >
    Clinical statistical programming across CDISC standards, TLF production,
    regulatory submission, and therapeutic-area analysis.

competency_areas:
  - code: core-programming
    label: Core Programming & Language Proficiency
    description: Foundation in the primary tools used to manipulate clinical data.
    activities:
      - code: base-sas
        source_ref: 1
        claim_type: proficiency
        seniority_hint: junior
        label: "Base SAS"
        help_text: "DATA step processing, arrays, and core roles."

      - code: sdtm-implementation-guide
        source_ref: 15
        claim_type: proficiency
        seniority_hint: mid
        label: "SDTM Implementation Guide versions"
        help_text: "Select every version you have worked to."
        variants: ["3.1.2", "3.2", "3.3", "3.4"]

      - code: scope-management
        source_ref: 105
        claim_type: trait
        seniority_hint: senior
        label: "Scope management"
        help_text: "Pushing back professionally on ad-hoc, out-of-scope requests."
```

---

## Activity Field Semantics

### `claim_type`

Specifies how the item is treated in the candidate builder and matching engine:

| `claim_type` | Description | Contributes to Score? | Example |
| :--- | :--- | :---: | :--- |
| `activity` | A concrete, verifiable task or deliverable completed. | **Yes** | *Authored ADRG*, *Double programming* |
| `proficiency` | Fluency in a programming language, library, or system. | **Yes** | *Base SAS*, *R Tidyverse*, *Pinnacle 21* |
| `trait` | Self-reported soft skill or work disposition. | **No** | *Quality mindset*, *Attention to detail* |

> **Why Trait Items Are Excluded From Scoring**: Almost 100% of candidates claim positive traits. Including traits in mathematical scoring flattens score distributions and creates unhelpful noise. Traits are captured solely for recruiters to read during manual review.

### `seniority_hint`

Drives the interactive candidate builder suggestions:
- Values: `junior`, `mid`, `senior`, `lead`.
- When a candidate selects their total years of experience, activities matching their seniority level receive visual "Suggested" prompt chips.
- **Safety Guarantee**: Seniority hints *never* auto-check items without explicit user confirmation.

### `variants`

A list of strings representing version numbers or standard sub-specifications:
- Example: `["3.1.2", "3.2", "3.3", "3.4"]` for SDTM IG or `["2.0", "2.1"]` for Define-XML.
- In the builder, activities with variants render as multi-select option pills.
- In the matching engine, variant requirements require non-empty set overlap between candidate claims and query specifications.

### `source_ref`

An optional integer preserving traceability to the original domain specification breakdown (e.g. items 1 to 107 in the client-provided Statistical Programming breakdown).

---

## Reference Breakdowns

### Statistical Programming
The Statistical Programming taxonomy (`statistical_programming.yaml`) contains **122 items** across 14 competency areas, covering core SAS/R, CDISC, complex therapeutics, Cloud/HPC, and AI workflows.

### Clinical Operations (CRA)
The Clinical Operations taxonomy (`clinical_operations.yaml`) contains **150 items** across 14 competency areas, covering site visit execution, risk-based quality management (RBQM), audit readiness, core GCP compliance, and therapeutic expertise.

### Clinical Data Management (CDM)
The Clinical Data Management taxonomy (`clinical_data_management.yaml`) contains **150 items** across 14 competency areas, focusing on database architecture, edit check logic, medical coding, vendor reconciliation, and overall data governance. This taxonomy natively shares 20 activities with Statistical Programming and Clinical Operations.

---

## Adding a New Domain Role

Adding a new discipline (e.g. `clinical-data-management.yaml` or `medical-writing.yaml`) requires **zero schema migrations or UI deployments**:

1. Create a new YAML file: `apps/api/taxonomy/seed/clinical_data_management.yaml`.
2. Define the `role`, `competency_areas`, and `activities`.
3. Run the seed command:
   ```bash
   python manage.py seed_taxonomy clinical-data-management
   ```
4. The new role instantly appears in the `GET /api/v1/roles/` endpoint, and the React frontend's `RoleSelectionPage` will dynamically render a new card for users to select.

---

## Seeding & Validation Lifecycle

### Seeding Command

```bash
# Seed or update
python manage.py seed_taxonomy <role_code> [--path <path>] [--prune] [--dry-run]
```

### Validation Rules

The `seed_taxonomy` command executes strict validation before opening a transaction:
1. Validates top-level keys `role` and `competency_areas`.
2. Asserts uniqueness of all activity `code` slugs across the entire role.
3. Enforces valid `claim_type` (`activity`, `proficiency`, `trait`).
4. Enforces valid `seniority_hint` (`junior`, `mid`, `senior`, `lead`, or omitted).
5. Asserts `variants` is a valid list of non-empty strings.

### Pruning & Soft-Deactivation

When an activity is removed from a seed YAML, passing `--prune` deactivates it:

```bash
python manage.py seed_taxonomy statistical-programming --prune
```

- Activities removed from the seed file have `is_active` set to `False`.
- Inactive activities are excluded from new builder sessions and search queries.
- Existing candidate `ActivityClaim` records remain intact, preserving historical data integrity.

## Django Admin Interface

The HireRight Django backend is equipped with a rich admin panel (`/admin/`) customized for managing both the taxonomy and candidate claims.

### Taxonomy Admin (`taxonomy.models`)
- **Roles, Competency Areas, and Activities**: Fully exposed with relational lookups.
- **Read-Only Fields**: Key structural fields like `code`, `claim_type`, and `variants` should generally be managed via the YAML seed files rather than manual database edits to prevent drift between the source-of-truth seed file and the DB.
- **Deactivation/Visibility**: You can manually toggle `is_active` in the admin to immediately pull an activity from the builder without needing to deploy a new seed file.

### Profile & Claims Admin (`profiles.models`)
- **Candidate Profiles**: View profiles, searchable by User email or UUID. Displays their `is_searchable` and `open_to_opportunities` statuses.
- **Activity Claims**: An inline view allows admins to inspect precisely what a candidate has claimed (proficiencies, variants, last used years). Useful for debugging search matching issues when a candidate complains they weren't surfaced in a query.
