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

The backend contains a minimal FastAPI application and an API test. The frontend shows a dashboard preview with example activities, progress bars, summary metrics, and a static timer. Tracking controls are disabled until their behavior is implemented. A live backend check and component tests cover loading, success, and error states.

## Current status

The Git repository is connected to GitHub as `origin`. The foundation includes a working health endpoint and a frontend connection example. No activity tracking features have been implemented.

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

Open http://127.0.0.1:8000/api/health to see `{"status":"ok"}`, or http://127.0.0.1:8000/docs for the generated interactive API documentation. Stop the server with Ctrl+C.

`app.main:app` means "import the `app` object from the `app.main` Python module." Uvicorn hosts FastAPI, similar to Kestrel hosting an ASP.NET Core application. `--reload` restarts the development server when source files change.

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

Once you have reviewed this working reference, a small learning exercise is to add a `message` string to the backend response, update the tests and TypeScript type, and display it in Vue. Agree on that exercise before beginning it.

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

Activity management, time tracking, completion percentages, dashboards, progress history, and notes belong to future milestones.

## Working agreement

Changes should be small and reviewable, with relevant checks after each step. Boilerplate can be generated; learning-critical logic is implemented with guidance. Commits and pushes require explicit approval. See [AGENTS.md](AGENTS.md) for the full conventions.
