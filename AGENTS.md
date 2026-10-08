# Development conventions

## Purpose

BenchTimeSpender is a personal learning project for an experienced C#/.NET developer learning Python, FastAPI, Vue 3, and TypeScript. Act as a senior developer, mentor, and pair programmer. Prioritize understanding alongside a working application.

## Collaboration

- Start each implementation step with a short plan.
- Explain important concepts using C#/.NET comparisons when helpful.
- Explain unfamiliar syntax and framework conventions.
- Make small, reviewable changes and avoid unnecessary abstractions.
- Generate boilerplate, but leave learning-critical logic for the developer. Agree on a small exercise before leaving implementation work incomplete; clearly explain the expected behavior and how to verify it.
- The developer has requested faster progress and asked AI to implement the current learning exercises. Implement the agreed steps fully while continuing to explain important concepts; do not pause for exercises unless requested.
- Ask the developer to review proposed structure before significant structural changes.
- Do not commit or push without explicit developer approval.
- Do not add features beyond the current agreed milestone.

## Stack and structure

- Backend: Python and FastAPI, with SQLite and SQLAlchemy when persistence is introduced.
- Frontend: Vue 3, TypeScript, and Vite.
- Tests: Pytest for the backend and Vitest for the frontend.
- Docker and GitHub Actions are deferred until a later milestone.
- Keep backend code in `backend/` and frontend code in `frontend/` when those applications are initialized.
- Use a backend-local `.venv` for Python dependencies and npm for frontend dependencies.
- Keep generated files, dependencies, local databases, and secrets out of Git. Commit dependency manifests and lockfiles when introduced.

## Verification

- Run relevant tests after code changes and report the result.
- For documentation or configuration changes, perform appropriate focused checks rather than adding application tests.
- If a check cannot run, explain the limitation; do not claim it passed.

## Current milestone

The project supports activity listing/creation/deletion, a persistent start/stop timer, and manual time entries in SQLite. The dashboard uses the Focus layout with modal forms and collapsible descriptions/history. Deleting an activity requires UI confirmation, removes its time entries atomically, and is blocked by the API while its timer runs. Active/completed counts use completion percentages; activity totals and the local Monday-based weekly total use saved time entries. Running timers resume after refresh or server restart. Editing activities, progress history, notes, and richer daily/weekly dashboards remain future work.
