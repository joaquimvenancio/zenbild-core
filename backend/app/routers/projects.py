import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import engine
from app.models import (
    DailyLog,
    Message,
    MessageType,
    Milestone,
    MilestoneStatus,
    Participant,
    Payment,
    PaymentProvider,
    PaymentStatus,
    Project,
    ProjectStatus,
)

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    title: str
    address: Optional[str] = None
    currency: str = Field(min_length=1)
    owner_id: uuid.UUID
    status: ProjectStatus = ProjectStatus.PLANNING


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    address: Optional[str] = None
    currency: Optional[str] = Field(default=None, min_length=1)
    status: Optional[ProjectStatus] = None


class ProjectRead(BaseModel):
    id: uuid.UUID
    title: str
    address: Optional[str]
    currency: str
    owner_id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ParticipantCreate(BaseModel):
    role: str
    name: str
    phone: Optional[str] = None
    can_post: bool = False


class ParticipantRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    role: str
    name: str
    phone: Optional[str]
    can_post: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    sender_id: Optional[uuid.UUID] = None
    type: MessageType
    url: Optional[str] = None
    transcript: Optional[str] = None


class MessageRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    sender_id: Optional[uuid.UUID]
    type: str
    url: Optional[str]
    transcript: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class DailyLogCreate(BaseModel):
    date: date
    summary_text: Optional[str] = None
    score_schedule: int = Field(ge=0, le=100)
    score_budget: int = Field(ge=0, le=100)


class DailyLogRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    date: date
    summary_text: Optional[str]
    score_schedule: int
    score_budget: int

    model_config = {"from_attributes": True}


class MilestoneCreate(BaseModel):
    name: str
    amount: Optional[float] = None
    criteria: Optional[str] = None
    status: MilestoneStatus = MilestoneStatus.PENDING
    due_date: Optional[date] = None


class MilestoneRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    amount: Optional[float]
    criteria: Optional[str]
    status: str
    due_date: Optional[date]

    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    milestone_id: uuid.UUID
    provider: PaymentProvider
    link: Optional[str] = None
    status: PaymentStatus = PaymentStatus.PENDING
    paid_at: Optional[datetime] = None


class PaymentRead(BaseModel):
    id: uuid.UUID
    milestone_id: uuid.UUID
    provider: str
    link: Optional[str]
    status: str
    paid_at: Optional[datetime]

    model_config = {"from_attributes": True}


def _get_project(session: Session, project_id: uuid.UUID) -> Project:
    stmt = select(Project).where(Project.id == project_id)
    project = session.scalars(stmt).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return project


def _get_participant(session: Session, participant_id: uuid.UUID, project_id: uuid.UUID) -> Participant:
    stmt = select(Participant).where(
        Participant.id == participant_id, Participant.project_id == project_id
    )
    participant = session.scalars(stmt).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participante não encontrado")
    return participant


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(payload: ProjectCreate):
    with Session(engine) as session:
        project = Project(
            title=payload.title,
            address=payload.address,
            currency=payload.currency,
            owner_id=payload.owner_id,
            status=payload.status.value,
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        return project


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: uuid.UUID, payload: ProjectUpdate):
    with Session(engine) as session:
        project = _get_project(session, project_id)
        data = payload.model_dump(exclude_unset=True)
        if "status" in data and data["status"] is not None:
            data["status"] = data["status"].value
        for key, value in data.items():
            setattr(project, key, value)
        session.commit()
        session.refresh(project)
        return project


@router.post("/{project_id}/participants", response_model=ParticipantRead, status_code=201)
def add_participant(project_id: uuid.UUID, payload: ParticipantCreate):
    with Session(engine) as session:
        _get_project(session, project_id)
        participant = Participant(
            project_id=project_id,
            role=payload.role,
            name=payload.name,
            phone=payload.phone,
            can_post=payload.can_post,
        )
        session.add(participant)
        session.commit()
        session.refresh(participant)
        return participant


@router.post("/{project_id}/messages", response_model=MessageRead, status_code=201)
def post_message(project_id: uuid.UUID, payload: MessageCreate):
    with Session(engine) as session:
        _get_project(session, project_id)
        sender_id = payload.sender_id
        if sender_id is not None:
            _get_participant(session, sender_id, project_id)
        message = Message(
            project_id=project_id,
            sender_id=sender_id,
            type=payload.type.value,
            url=payload.url,
            transcript=payload.transcript,
        )
        session.add(message)
        session.commit()
        session.refresh(message)
        return message


@router.post("/{project_id}/daily-logs", response_model=DailyLogRead, status_code=201)
def register_daily_log(project_id: uuid.UUID, payload: DailyLogCreate):
    with Session(engine) as session:
        _get_project(session, project_id)
        daily_log = DailyLog(
            project_id=project_id,
            date=payload.date,
            summary_text=payload.summary_text,
            score_schedule=payload.score_schedule,
            score_budget=payload.score_budget,
        )
        session.add(daily_log)
        session.commit()
        session.refresh(daily_log)
        return daily_log


@router.post("/{project_id}/milestones", response_model=MilestoneRead, status_code=201)
def create_milestone(project_id: uuid.UUID, payload: MilestoneCreate):
    with Session(engine) as session:
        _get_project(session, project_id)
        milestone = Milestone(
            project_id=project_id,
            name=payload.name,
            amount=payload.amount,
            criteria=payload.criteria,
            status=payload.status.value,
            due_date=payload.due_date,
        )
        session.add(milestone)
        session.commit()
        session.refresh(milestone)
        return milestone


@router.post("/{project_id}/payments", response_model=PaymentRead, status_code=201)
def register_payment(project_id: uuid.UUID, payload: PaymentCreate):
    with Session(engine) as session:
        milestone = session.get(Milestone, payload.milestone_id)
        if not milestone or milestone.project_id != project_id:
            raise HTTPException(status_code=404, detail="Marco não encontrado para o projeto")
        payment = Payment(
            milestone_id=payload.milestone_id,
            provider=payload.provider.value,
            link=payload.link,
            status=payload.status.value,
            paid_at=payload.paid_at,
        )
        session.add(payment)
        session.commit()
        session.refresh(payment)
        return payment
