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
├── backend/        # Planned FastAPI application and Pytest tests
└── frontend/       # Planned Vue application and Vitest tests
```

The `backend/` and `frontend/` directories have not been created yet.

## Current status

The local Git repository is initialized on `main`. Application initialization and the GitHub connection are upcoming steps; there are no application commands to run yet.

## Milestone 1: Project foundation

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

Vite serves the frontend during development and forwards `/api` requests to the backend. Vue then displays the returned data. Local setup commands and ports will be documented when the applications are initialized.

Activity management, time tracking, completion percentages, dashboards, progress history, and notes belong to future milestones.

## Working agreement

Changes should be small and reviewable, with relevant checks after each step. Boilerplate can be generated; learning-critical logic is implemented with guidance. Commits and pushes require explicit approval. See [AGENTS.md](AGENTS.md) for the full conventions.
