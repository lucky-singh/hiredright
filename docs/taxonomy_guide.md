# Taxonomy Authoring & Seed Guide

> Guide for defining, maintaining, validating, and seeding clinical and pharmaceutical domain taxonomies in HireRight.

---

## Table of Contents

- [Taxonomy Architecture](#taxonomy-architecture)
- [YAML Seed File Format](#yaml-seed-file-format)
  - [Function Specification](#function-specification)
  - [Competency Area Specification](#competency-area-specification)
  - [Activity Specification](#activity-specification)
- [Activity Field Semantics](#activity-field-semantics)
  - [`claim_type`](#claim_type)
  - [`seniority_hint`](#seniority_hint)
  - [`variants`](#variants)
  - [`source_ref`](#source_ref)
- [Reference Breakdown: Statistical Programming](#reference-breakdown-statistical-programming)
- [Adding a New Domain Function](#adding-a-new-domain-function)
- [Seeding & Validation Lifecycle](#seeding--validation-lifecycle)
  - [Seeding Command](#seeding-command)
  - [Validation Rules](#validation-rules)
  - [Pruning & Soft-Deactivation](#pruning--soft-deactivation)

---

## Taxonomy Architecture

HireRight structures professional domains into a three-tier hierarchy:

$$\text{Function} \longrightarrow \text{CompetencyArea} \longrightarrow \text{Activity}$$

1. **Function**: Top-level job specialization (e.g. `statistical-programming`, `clinical-data-management`, `medical-writing`).
2. **CompetencyArea**: Thematic step in the candidate builder flow, typically containing 8–15 activities (e.g. `cdisc-sdtm`, `tlf-biostatistics`).
3. **Activity**: The atomic, scorable skill, deliverable, or tool proficiency that candidates claim and recruiters query.

---

## YAML Seed File Format

Taxonomy definitions are stored in `apps/api/taxonomy/seed/<function_code>.yaml`.

### Complete Example Structure

```yaml
function:
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
        help_text: "DATA step processing, arrays, and core functions."

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

## Reference Breakdown: Statistical Programming

The Statistical Programming taxonomy (`statistical_programming.yaml`) contains **107 items** across 9 competency areas:

```
Statistical Programming (107 Total Items)
├── 1. Core Programming & Language Proficiency (14 items)
│      SAS (Base, Macro, SQL, STAT, GRAPH, Hash, ODS), R (Base, Tidyverse, Shiny), Python
├── 2. CDISC SDTM (13 items)
│      SDTM IG (3.1.2–3.4), Observation Classes, Trial Design, SUPPQUAL/RELREC, aCRF, ISO 8601
├── 3. CDISC ADaM (13 items)
│      ADaM IG (1.0–1.3), ADSL, BDS, OCCDS, MedDRA, WHODrug, Baseline, Windowing, Imputations
├── 4. TLF & Biostatistics (12 items)
│      SAP interpretation, Tables (Demog, AE, Disp, Efficacy), Listings, Figures, Double Prog
├── 5. Regulatory Submissions & Validation (12 items)
│      Pinnacle 21 (Community, Enterprise, Issues), Define-XML (2.0/2.1), SDRG, ADRG, BIMO, eCTD
├── 6. Therapeutic Area Expertise (12 items)
│      Solid Tumor, Heme-Onc, Immuno-Onc, Vaccines, Cardio, CNS, Rare Diseases, PK/PD
├── 7. Integrated Summaries & Complex Trials (8 items)
│      ISS Safety, ISE Efficacy, Harmonisation, Interim Analysis, DMC/DSMB, Adaptive Designs
├── 8. Tools, Systems & Automation (10 items)
│      Git, Macro Libraries, MDR (Formedix), EDC (Rave/Veeva), Jira, Linux, LLM/AI Tools
└── 9. Leadership, Oversight & Stakeholder Management (13 items)
       Lead Programmer, CRO Oversight, Resourcing, Timelines, Mentorship, SOPs, Traits
```

---

## Adding a New Domain Function

Adding a new discipline (e.g. `clinical-data-management.yaml` or `medical-writing.yaml`) requires **zero schema migrations**:

1. Create a new YAML file: `apps/api/taxonomy/seed/clinical_data_management.yaml`.
2. Define the `function`, `competency_areas`, and `activities`.
3. Run the seed command:
   ```bash
   python manage.py seed_taxonomy clinical-data-management
   ```
4. The new function and its tree immediately become available to the profile builder API.

---

## Seeding & Validation Lifecycle

### Seeding Command

```bash
# Seed or update
python manage.py seed_taxonomy <function_code> [--path <path>] [--prune] [--dry-run]
```

### Validation Rules

The `seed_taxonomy` command executes strict validation before opening a transaction:
1. Validates top-level keys `function` and `competency_areas`.
2. Asserts uniqueness of all activity `code` slugs across the entire function.
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
