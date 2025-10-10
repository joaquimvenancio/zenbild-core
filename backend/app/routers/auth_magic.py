from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
import os, secrets, hashlib
import httpx

router = APIRouter(prefix="/auth/magic", tags=["auth-magic"])

# --- Helpers (substitua por suas funções/ORM) --------------------------------
def save_token(email: str, token_hash: str, expires_at: datetime, ip: str, ua: str):
    # INSERT em email_login_tokens
    ...

def find_valid_token(token_hash: str):
    # SELECT * FROM email_login_tokens WHERE token_hash=? AND consumed_at IS NULL AND expires_at > now()
    # retorna { email, ... } ou None
    ...

def consume_token(token_hash: str):
    # UPDATE email_login_tokens SET consumed_at=now() WHERE token_hash=? AND consumed_at IS NULL
    # retorne True se atualizou 1 linha
    ...

def get_or_create_user_by_email(email: str):
    # SELECT * FROM users WHERE email=email
    # se não existir -> INSERT users(email,is_guest=false)
    # return { "id": "...", "email": email }
    ...

def issue_jwt(user_id: str, is_guest: bool = False) -> str:
    # HS256 com exp = now + JWT_EXPIRES_DAYS
    ...

def set_auth_cookie(resp: Response, jwt: str):
    resp.set_cookie(
        key="zenbild_token",
        value=jwt,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * int(os.getenv("JWT_EXPIRES_DAYS", "7")),
        path="/",
    )

def rate_limit_ok(kind: str, key: str) -> bool:
    # use Upstash Redis se disponível; para MVP, retornar True
    return True

# --- E-mail (Resend por padrão; Postmark alternativo) ------------------------
async def send_magic_email_resend(to_email: str, link: str):
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY ausente")
    payload = {
        "from": "Zenbild <login@notifications.zenbild.com>",
        "to": [to_email],
        "subject": "Seu acesso ao Zenbild",
        "text": f"Use este link para entrar (expira em {os.getenv('MAGIC_LINK_TTL_MINUTES','15')} min): {link}",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post("https://api.resend.com/emails", json=payload, headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        })
        if r.status_code >= 300:
            raise RuntimeError(f"Falha ao enviar e-mail: {r.text}")

async def send_magic_email_postmark(to_email: str, link: str):
    token = os.getenv("POSTMARK_SERVER_TOKEN")
    if not token:
        raise RuntimeError("POSTMARK_SERVER_TOKEN ausente")
    payload = {
        "From": "Zenbild <login@notifications.zenbild.com>",
        "To": to_email,
        "Subject": "Seu acesso ao Zenbild",
        "TextBody": f"Use este link para entrar (expira em {os.getenv('MAGIC_LINK_TTL_MINUTES','15')} min): {link}",
        "MessageStream": "outbound"
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post("https://api.postmarkapp.com/email", json=payload, headers={
            "X-Postmark-Server-Token": token,
            "Content-Type": "application/json",
        })
        if r.status_code >= 300:
            raise RuntimeError(f"Falha ao enviar e-mail: {r.text}")

async def send_magic_email(to_email: str, link: str):
    if os.getenv("RESEND_API_KEY"):
        return await send_magic_email_resend(to_email, link)
    return await send_magic_email_postmark(to_email, link)

# --- Schemas -----------------------------------------------------------------
class MagicRequest(BaseModel):
    email: EmailStr

# --- Endpoints ----------------------------------------------------------------
@router.post("/request")
async def magic_request(payload: MagicRequest, request: Request):
    client_ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "")
    email = payload.email.strip().lower()

    # Rate limit
    if not rate_limit_ok("magic_request_ip", client_ip or "unknown"):
        raise HTTPException(status_code=429, detail="Tente novamente em instantes.")
    if not rate_limit_ok("magic_request_email", email):
        raise HTTPException(status_code=429, detail="Tente novamente em instantes.")

    # Token aleatório e hash
    raw_token = secrets.token_urlsafe(32)  # ~256 bits
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    ttl_min = int(os.getenv("MAGIC_LINK_TTL_MINUTES", "15"))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_min)

    # Persistir
    save_token(email=email, token_hash=token_hash, expires_at=expires_at, ip=client_ip, ua=ua)

    # Link (frente)
    link = f"{os.getenv('FRONTEND_URL')}/auth/callback?token={raw_token}"

    # Enviar
    try:
        await send_magic_email(email, link)
    except Exception:
        # Não vaze erro de envio; logue no Sentry no futuro
        pass

    # Sempre 200 para não vazar existência
    return {"ok": True}

@router.post("/consume")
async def magic_consume(token: str, response: Response, request: Request):
    if not token:
        raise HTTPException(status_code=400, detail="Token ausente.")
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    record = find_valid_token(token_hash)
    if not record:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

    # Single-use
    if not consume_token(token_hash):
        raise HTTPException(status_code=400, detail="Token já utilizado.")

    # Upsert user
    user = get_or_create_user_by_email(record["email"])

    # TODO (opcional): merge de guest -> user usando um header/claim
    jwt = issue_jwt(user_id=user["id"], is_guest=False)
    set_auth_cookie(response, jwt)
    return {"ok": True}
