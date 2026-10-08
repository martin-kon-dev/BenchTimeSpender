from fastapi import FastAPI

app = FastAPI(title="BenchTimeSpender")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
