# Contributing & Development Guide

Welcome to the HiredRight development guide! This document outlines everything you need to know to get the project running locally, seed the database, and run the test suites.

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
   *This starts the Vite dev server on `http://localhost:3000` (set explicitly in `vite.config.ts`). Vite proxies `/api` to `http://localhost:8000`, so no CORS configuration is needed in dev. Setting `VITE_API_URL` in `apps/web/.env.local` overrides that and points the SPA at an absolute backend URL instead.*

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


### Database Management & Backups

If you are running the backend in Docker and need to safely backup or snapshot the database (e.g., before pruning taxonomy codes), use Django's `dumpdata` command from inside the container. This exports the data to a database-agnostic JSON file.

**To create a backup:**
```bash
docker compose exec api bash -c "python manage.py dumpdata > /app/hiredright_docker_db_backup_$(date +%Y%m%d_%H%M%S).json"
```
*Note: Because the `/app` directory is mounted via a volume, the resulting `.json` file will safely appear on your host machine in the `apps/api` folder.*

**To restore from a backup:**
```bash
docker compose exec api python manage.py loaddata /app/hiredright_docker_db_backup_XXXXXX_XXXXXX.json
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

