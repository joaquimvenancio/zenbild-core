import os
import secrets
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import engine
from app.models import EmailLoginToken, User

router = APIRouter(prefix="/auth/magic", tags=["auth-magic"])


# --- Helpers -----------------------------------------------------------------
def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _to_uuid(value: Optional[str | uuid.UUID]) -> Optional[uuid.UUID]:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def save_token(
    email: str,
    token_hash: str,
    expires_at: datetime,
    ip: Optional[str],
    ua: str,
    user_id: str,
):
    with Session(engine) as session:
        token = EmailLoginToken(
            email=_normalize_email(email),
            token_hash=token_hash,
            expires_at=expires_at,
            ip=ip,
            user_agent=ua,
            user_id=_to_uuid(user_id),
        )
        session.add(token)
        session.commit()


def find_valid_token(token_hash: str):
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        token = (
            session.query(EmailLoginToken)
            .filter(
                EmailLoginToken.token_hash == token_hash,
                EmailLoginToken.consumed_at.is_(None),
                EmailLoginToken.expires_at > now,
            )
            .order_by(EmailLoginToken.id.desc())
            .first()
        )
        if not token:
            return None
        return {
            "email": token.email,
            "user_id": str(token.user_id) if token.user_id else None,
        }


def consume_token(token_hash: str) -> bool:
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        updated = (
            session.query(EmailLoginToken)
            .filter(
                EmailLoginToken.token_hash == token_hash,
                EmailLoginToken.consumed_at.is_(None),
            )
            .update({EmailLoginToken.consumed_at: now}, synchronize_session=False)
        )
        session.commit()
        return updated == 1


def get_user_by_email(email: str):
    normalized = _normalize_email(email)
    with Session(engine) as session:
        user: Optional[User] = (
            session.query(User)
            .filter(func.lower(User.email) == normalized)
            .one_or_none()
        )
        if not user:
            return None
        return {
            "id": str(user.id),
            "email": user.email,
            "is_guest": user.is_guest,
        }


def get_user_by_id(user_id: str | uuid.UUID):
    with Session(engine) as session:
        user_uuid = _to_uuid(user_id)
        user: Optional[User] = (
            session.query(User).filter(User.id == user_uuid).one_or_none()
        )
        if not user:
            return None
        return {
            "id": str(user.id),
            "email": user.email,
            "is_guest": user.is_guest,
        }


def create_user(email: str):
    normalized = _normalize_email(email)
    with Session(engine) as session:
        new_user = User(email=normalized, is_guest=False)
        session.add(new_user)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            user = (
                session.query(User)
                .filter(func.lower(User.email) == normalized)
                .one()
            )
            return {
                "id": str(user.id),
                "email": user.email,
                "is_guest": user.is_guest,
            }

        session.refresh(new_user)
        return {
            "id": str(new_user.id),
            "email": new_user.email,
            "is_guest": new_user.is_guest,
        }


def get_or_create_user_by_email(email: str):
    existing = get_user_by_email(email)
    if existing:
        return existing
    return create_user(email)


def issue_jwt(user_id: str, is_guest: bool = False) -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET não configurado")

    expires_days = int(os.getenv("JWT_EXPIRES_DAYS", "7"))
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "is_guest": is_guest,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=expires_days)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")

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


async def send_magic_email(to_email: str, link: str):
    if os.getenv("RESEND_API_KEY"):
        return await send_magic_email_resend(to_email, link)

# --- Schemas -----------------------------------------------------------------
class MagicRequest(BaseModel):
    email: EmailStr
    create_if_missing: bool = False

# --- Endpoints ----------------------------------------------------------------
@router.post("/request")
async def magic_request(payload: MagicRequest, request: Request):
    client_ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "")
    email = payload.email.strip().lower()
    create_if_missing = payload.create_if_missing

    existing_user = get_user_by_email(email)
    user_existed = existing_user is not None
    if not existing_user and not create_if_missing:
        return {"ok": False, "reason": "user_not_found"}

    user = existing_user or get_or_create_user_by_email(email)

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

    frontend_url = os.getenv("FRONTEND_URL")
    if not frontend_url:
        raise HTTPException(status_code=500, detail="FRONTEND_URL não configurada")

    # Persistir
    save_token(
        email=email,
        token_hash=token_hash,
        expires_at=expires_at,
        ip=client_ip,
        ua=ua,
        user_id=user["id"],
    )

    link = f"{frontend_url}/auth/callback?token={raw_token}"

    # Enviar
    try:
        await send_magic_email(email, link)
    except Exception:
        raise HTTPException(status_code=400, detail="Erro no envio.")
        # Não vaze erro de envio; logue no Sentry no futuro
        #pass

    # Sempre 200 para não vazar existência
    return {"ok": True, "created": not user_existed}

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
    user = None
    if record.get("user_id"):
        user = get_user_by_id(record["user_id"])
    if not user:
        user = get_or_create_user_by_email(record["email"])

    # TODO (opcional): merge de guest -> user usando um header/claim
    jwt = issue_jwt(user_id=user["id"], is_guest=False)
    set_auth_cookie(response, jwt)
    return {"ok": True}
