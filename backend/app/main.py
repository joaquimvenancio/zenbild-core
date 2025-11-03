import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import ensure_schema
from app.routers import auth_magic, projects

app = FastAPI(title="Zenbild API")


ensure_schema()


def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")


def _resolve_cors_origins() -> list[str]:
    configured = os.getenv("CORS_ALLOW_ORIGINS")
    if configured:
        return [_normalize_origin(origin) for origin in configured.split(",") if origin.strip()]

    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        return [_normalize_origin(frontend_url)]

    # fallback para ambientes locais comuns
    return [
        "http://localhost:3000",
        "http://localhost:5173",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_magic.router)
app.include_router(projects.router)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def read_root():
    return {"message": "Zenbild API is running 🚀"}


