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

The backend stores activities, categories, time entries, and the running timer in SQLite using SQLAlchemy. The Vue dashboard has search/category filters, Active and Completed views, and expandable activity cards. Each card shows Today, This week, and Overall totals; expand it to time a session, record past work, edit, complete, reopen, or delete the activity. Search matches titles and descriptions and combines with category and status filters.

The header's moon/sun toggle switches the entire page and dialogs. It follows the system theme until you choose a theme, then remembers your choice in this browser's local storage.

Saved time uses readable minutes/hours, such as `12 min` or `1h 20m`; a saved session shorter than a minute shows `<1 min`. Only the running timer displays seconds. **Saved this week** includes recorded time since local Monday; it excludes the active timer.

## Current status

The Git repository is connected to GitHub as `origin`. The application supports activity creation/editing/completion/deletion, category management, persistent timers, and manual entries with optional notes. Progress history and richer productivity dashboards remain future work.

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
- `DELETE /api/activities/{id}` permanently removes an activity and its saved time entries in one transaction; returns HTTP 204, HTTP 404 for an unknown activity, or HTTP 409 while that activity has a running timer. Another activity can be deleted while the timer runs. Deletion reduces recorded totals.
- Title is required and trimmed, up to 200 characters. Category is optional; `category_id: null` means Uncategorized. The legacy category-name create field remains accepted. Description is optional and limited to 2,000 characters. Completion percentage must be an integer from 0 through 100 and defaults to 0. Invalid requests return HTTP 422.
- The database starts empty and is created at `backend/benchtime.db` on server startup. This file is ignored by Git. Data survives refreshes and server restarts.
- Use **New activity**, enter a title, optionally select a category/add a description, then click **Create activity**. Expand the saved card to edit it or mark it completed. Reopen completed activities from the Completed view.
- Use **Delete** on an activity and review the confirmation before deleting. Stop and save its running timer first. Cancel or Escape closes a dialog while idle; dialogs stay open while a request is being saved.
- Active means completion below 100%; completed means 100%. Completion percentage is independent of time recorded.

`models.py` defines database mappings, similar to EF Core entities. `schemas.py` defines validated HTTP request/response models, similar to DTOs. A SQLAlchemy `Session` tracks changes and `commit()` writes them, similar to `DbContext.SaveChanges()`. FastAPI injects a session per request through `Depends`; `yield` lets the dependency close it afterward.

`create_app()` accepts a database URL so tests use temporary databases instead of personal data. Startup runs the versioned migration described below.

## Timer and manual time entries

1. Expand an active activity card and click **Start timer**.
2. The timer continues across page refreshes and server restarts, using its persisted server start time. Only one timer can run at a time across browser tabs.
3. Click **Stop & save** to record its duration. A stop lasting less than a second records one second. The elapsed display is based on timestamps rather than counting interval ticks.
4. For past work, use the card's inline **Add manual entry** form: local start date/time, hours/minutes, and an optional note. Click **Add entry**. A fresh form defaults to a 30-minute session starting 30 minutes ago. Drafts survive collapsing, filtering, and switching views until saved or the page is refreshed. The UI supports durations from one minute to 24 hours; the API accepts one second to 24 hours. Entries must finish in the past. Invalid fields show an associated error and receive keyboard focus.

The browser converts manual start times to UTC. The database stores UTC epoch seconds. Card totals include saved intervals and elapsed running time, allocated by overlap across local midnight/Monday boundaries (including daylight-saving changes). Overall retains the full saved durations. **Saved this week** retains its previous saved-only definition. Overlapping entries are allowed and summed independently. All historical records remain available through `GET /api/time-entries`; the recent-entry list has been replaced by the three card totals.

The running-session banner stays visible when its activity is filtered out. Starting another activity asks you to stop/save the current session first. Completing or deleting a running activity is blocked until its timer stops. Refreshing or backgrounding does not reset elapsed time.

API routes:

- `GET /api/timer`: current timer or `null`.
- `POST /api/timer/start`: takes `activity_id`; returns HTTP 201, or HTTP 409 if a timer already exists.
- `POST /api/timer/{id}/stop`: saves a time entry and clears the matching timer atomically. Repeated stops return HTTP 404 and do not duplicate time.
- `GET /api/time-entries`: recorded time, newest start first.
- `POST /api/time-entries`: takes `activity_id`, a timezone-aware `started_at`, integer `duration_seconds`, and optional `note`; returns HTTP 201.

Restart the backend after updating the code. No new dependencies are required for this redesign.

## Categories and migration

**Manage categories** creates/edits named categories with colors and assigned-activity counts. Names are trimmed and case-insensitively unique; Uncategorized is a protected null fallback. Renaming retains the category ID and current filter. Deleting requires an explicit destination category or Uncategorized; reassignment and deletion happen atomically, preserving activity IDs, timers, history, and notes. Version/count checks reject stale confirmations from other tabs. Browsers supporting customizable native selects display colored dots in the category dropdown; other browsers retain the native labeled options.

API: `GET/POST /api/categories`, `PUT/DELETE /api/categories/{id}`, and `PATCH /api/activities/{id}`. Category updates require `expected_version`; deletion requires that version, `expected_activity_count`, and explicit `reassign_to` (an ID or null).

On the first startup against a legacy database, migration v1 saves `backend/benchtime.db.pre-redesign-v1.bak` using SQLite's backup API. It adds categories/category IDs and optional entry notes without changing historical IDs, timestamps, completion percentages, or durations. Case variants of an existing category share one ID. `schema_versions` records completion; subsequent starts do not reapply it. No demonstration activities are inserted.

To restore the pre-redesign snapshot, stop FastAPI, preserve the current database, restore the backup, and use the earlier backend code before restarting. Restoring the snapshot omits records created after that backup; keep the current copy if you need those records:

```powershell
Copy-Item -LiteralPath backend/benchtime.db -Destination backend/benchtime.redesign-current.db
Copy-Item -LiteralPath backend/benchtime.db.pre-redesign-v1.bak -Destination backend/benchtime.db -Force
```

Running the new backend on the restored legacy file will migrate it again. Keep database files/backups out of Git.

## Frontend setup (second PowerShell)

Keep FastAPI running on port 8000. From the repository root, run:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Create an activity, select it, and start a timer to verify the API connection. If FastAPI is stopped, the dashboard displays loading errors with retry buttons. Stop either server with Ctrl+C in its terminal.

The browser sends `/api` requests to Vite on port 5173. Vite forwards them unchanged to FastAPI on port 8000 and returns the JSON response. This keeps browser requests on the frontend's origin during development. The proxy is for development only; production hosting is deferred. The health endpoint remains available at `/api/health` for diagnostics.

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
- TypeScript types describe JSON shapes for tooling; they do not validate JSON at runtime.

`AppDialog.vue` wraps the native HTML `dialog` element, traps keyboard focus, restores the trigger, and warns before discarding dirty forms. Vue `defineEmits` declares typed component events, much like a C# event contract. `useTracker()` shares one timer/entry state across cards, similar to a scoped state service; cards use `v-show` to preserve drafts while hidden. `timeTotals()` is the single tested function for interval allocation.

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

Later milestones will add progress history and richer daily/weekly productivity dashboards.

## Working agreement

Changes should be small and reviewable, with relevant checks after each step. AI currently implements the agreed steps fully at the developer's request, while explaining unfamiliar concepts. Commits and pushes require explicit approval. See [AGENTS.md](AGENTS.md) for the full conventions.
