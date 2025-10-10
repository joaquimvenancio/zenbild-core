from fastapi import FastAPI
from app.routers import auth_magic

app = FastAPI(title="Zenbild API")
app.include_router(auth_magic.router)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def read_root():
    return {"message": "Zenbild API is running 🚀"}


