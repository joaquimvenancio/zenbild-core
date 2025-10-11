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
from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

router = APIRouter(prefix="/auth/magic", tags=["auth-magic"])


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    is_guest: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class EmailLoginToken(Base):
    __tablename__ = "email_login_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, index=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL não configurada")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)


# --- Helpers -----------------------------------------------------------------
def _normalize_email(email: str) -> str:
    return email.strip().lower()


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
            user_id=user_id,
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
        return {"email": token.email, "user_id": token.user_id}


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
        return {"id": user.id, "email": user.email, "is_guest": user.is_guest}


def get_user_by_id(user_id: str):
    with Session(engine) as session:
        user: Optional[User] = session.query(User).filter(User.id == user_id).one_or_none()
        if not user:
            return None
        return {"id": user.id, "email": user.email, "is_guest": user.is_guest}


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
            return {"id": user.id, "email": user.email, "is_guest": user.is_guest}

        session.refresh(new_user)
        return {
            "id": new_user.id,
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
