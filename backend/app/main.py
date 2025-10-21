import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth_magic

app = FastAPI(title="Zenbild API")


def _resolve_cors_origins() -> list[str]:
    configured = os.getenv("CORS_ALLOW_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        return [frontend_url]

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

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def read_root():
    return {"message": "Zenbild API is running 🚀"}


