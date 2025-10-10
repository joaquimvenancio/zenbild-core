from fastapi import FastAPI

app = FastAPI(title="Zenbild API")

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/")
def read_root():
    return {"message": "Zenbild API is running 🚀"}