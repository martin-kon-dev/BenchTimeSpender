# BenchTimeSpender

A personal application for tracking time spent between outsourcing projects, built through guided AI-assisted development.

The project also serves as a practical introduction to Python, FastAPI, Vue 3, and TypeScript for an experienced C#/.NET developer.

## Planned stack

- Backend: Python, FastAPI, SQLite, and SQLAlchemy
- Frontend: Vue 3, TypeScript, and Vite
- Testing: Pytest and Vitest
- Later: Docker and GitHub Actions

## Repository structure

The backend and frontend will live in one repository and run as separate applications, similar to an ASP.NET Core API and a client project in one solution.

```text
BenchTimeSpender/
├── AGENTS.md       # Development and mentoring conventions
├── README.md       # Project overview and setup instructions
├── .gitignore      # Files excluded from version control
├── backend/        # FastAPI application and Pytest tests
└── frontend/       # Vue application and Vitest tests
```

The backend stores activities, time entries, and the running timer in SQLite using SQLAlchemy. The Vue dashboard provides activity creation, a start/stop timer, manual time entry, progress bars, activity time totals, and a weekly recorded-time summary. A live backend check is also available.

## Current status

The Git repository is connected to GitHub as `origin`. The application supports activity listing/creation and time tracking. Activity editing, progress history, notes, and richer daily/weekly productivity dashboards are upcoming work.

## Backend setup (PowerShell)

Install Python 3.14, then run these commands from the repository root:

```powershell
cd backend
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If your installation provides `python` instead of `py`, use `python -m venv .venv` after confirming `python --version` reports Python 3.14.

Using the environment's executable directly avoids needing to activate it or change PowerShell's execution policy. The editable install (`-e`) allows source changes to take effect without reinstalling the project; `[dev]` also installs the test dependencies declared in `pyproject.toml`.

Open http://127.0.0.1:8000/api/health to see `{"status":"ok","message":"BenchTimeSpender API is ready."}`, or http://127.0.0.1:8000/docs for the generated interactive API documentation. Stop the server with Ctrl+C.

`app.main:app` means "import the `app` object from the `app.main` Python module." Uvicorn hosts FastAPI, similar to Kestrel hosting an ASP.NET Core application. `--reload` restarts the development server when source files change.

After dependency changes, stop the server, rerun the editable install command, then restart it.

## Activities and persistence

- `GET /api/activities` lists activities in creation order.
- `POST /api/activities` creates an activity and returns HTTP 201 with its generated ID.
- Title and category are required and trimmed, with limits of 200 and 100 characters. Description is optional and limited to 2,000 characters. Completion percentage must be an integer from 0 through 100 and defaults to 0. Invalid requests return HTTP 422.
- The database starts empty and is created at `backend/benchtime.db` on server startup. This file is ignored by Git. Data survives refreshes and server restarts.
- Use **New activity** in the dashboard, complete the form, and click **Save activity**. Refresh the page to confirm it reloads from SQLite.
- Active means completion below 100%; completed means 100%. Completion percentage is independent of time recorded.

`models.py` defines database mappings, similar to EF Core entities. `schemas.py` defines validated HTTP request/response models, similar to DTOs. A SQLAlchemy `Session` tracks changes and `commit()` writes them, similar to `DbContext.SaveChanges()`. FastAPI injects a session per request through `Depends`; `yield` lets the dependency close it afterward.

`create_app()` accepts a database URL so tests use temporary databases instead of personal data. Table creation at startup is sufficient for this first schema; migrations will be introduced when existing tables need changes.

## Timer and manual time entries

1. Choose an activity under **Time tracking** and click **Build timer**.
2. The timer continues across page refreshes and server restarts, using its persisted server start time. Only one timer can run at a time across browser tabs.
3. Click **Stop & save** to record its duration. A stop lasting less than a second records one second. The elapsed display is based on timestamps rather than counting interval ticks.
4. For past work, click **Manual entry**, select an activity, enter a local start date/time and hours/minutes, then click **Save time entry**. The UI supports durations from one minute to 24 hours; the API accepts one second to 24 hours. Entries must finish in the past.

The browser converts manual start times to UTC. The database stores UTC epoch seconds; the UI displays dates in the browser's local timezone. Recent entries show the last five records. Activity totals include all saved entries. The weekly total counts the part of each saved entry between local Monday midnight and now; it excludes a timer that is still running. Overlapping entries are allowed and summed independently.

API routes:

- `GET /api/timer`: current timer or `null`.
- `POST /api/timer/start`: takes `activity_id`; returns HTTP 201, or HTTP 409 if a timer already exists.
- `POST /api/timer/{id}/stop`: saves a time entry and clears the matching timer atomically. Repeated stops return HTTP 404 and do not duplicate time.
- `GET /api/time-entries`: recorded time, newest start first.
- `POST /api/time-entries`: takes `activity_id`, a timezone-aware `started_at`, and integer `duration_seconds`; returns HTTP 201.

Restart the backend after updating the code; startup creates the new tables without changing existing activities. No new dependencies are required for this step.

## Frontend setup (second PowerShell)

Keep FastAPI running on port 8000. From the repository root, run:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173 and click **Check backend**. The page should display **Backend status: ok**. Stop FastAPI and try again to see an error; restart it and retry to recover. Stop either server with Ctrl+C in its terminal.

The browser sends `/api/health` to Vite on port 5173. Vite forwards it unchanged to FastAPI on port 8000 and returns the JSON response. This keeps browser requests on the frontend's origin during development. The proxy is for development only; production hosting is deferred.

To verify the frontend:

```powershell
npm test
npm run build
```

The tests mock HTTP requests to exercise the component independently of FastAPI. The build command also checks TypeScript types. `package-lock.json` records the installed dependency versions; `npm ci` installs those versions.

### Reading the first Vue component

- `src/main.ts` mounts the root `App.vue` component into the HTML element with ID `app`.
- `<script setup lang="ts">` declares component logic using TypeScript; its top-level declarations are available to the template.
- `ref(...)` stores reactive state. Update it using `.value` in TypeScript; Vue unwraps refs automatically in templates.
- `@click` binds an event handler, `:disabled` binds a property, and `v-if` conditionally renders content.
- `fetch` performs HTTP requests; `await` waits for the response and JSON body. Check `response.ok` because HTTP error responses do not automatically reject the promise.
- `HealthResponse` describes the JSON shape for TypeScript tooling. Type annotations do not validate JSON at runtime.

The connection example also displays the `message` returned by FastAPI. Its TypeScript response type and the backend and frontend tests describe the same response contract.

## Milestone 1 sequence

1. Establish repository documentation and development conventions.
2. Review and approve the initial commit.
3. Create a GitHub repository and connect it as `origin`.
4. Initialize FastAPI and Vue 3 with TypeScript.
5. Run both applications locally and verify a simple API communication example.

The first example will use this request flow:

```text
Vue → fetch("/api/health") → Vite development proxy → FastAPI
Vue ← JSON response      ← Vite development proxy ← FastAPI
```

Vite serves the frontend during development and forwards `/api` requests to the backend. Vue then displays the returned data.

Later milestones will add activity editing, progress history, notes, and richer daily/weekly productivity dashboards.

## Working agreement

Changes should be small and reviewable, with relevant checks after each step. AI currently implements the agreed steps fully at the developer's request, while explaining unfamiliar concepts. Commits and pushes require explicit approval. See [AGENTS.md](AGENTS.md) for the full conventions.
