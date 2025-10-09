# Zenbild Core

**AI-native backend and orchestrator powering daily tracking, financial planning, and on-site automation for home construction.**

Zenbild is an **AI copilot for residential construction** — built to turn homebuilding into a predictable, transparent, and stress-free experience.  
It connects field activity, finances, and decisions through intelligent AI agents that automate progress tracking, risk detection, and daily reporting.

---

## Overview

This repository contains the **core platform** for Zenbild — including backend, frontend, and AI agents.

**Main modules:**
- **AI Daily Tracker** – Monitors construction progress via photos, chat, and voice updates.
- **AI Financial Planner** – Tracks purchases, payments, and cost deviations.
- **AI Change Order Manager** – Detects design or budget changes and updates stakeholders automatically.
- **Vision Inspector (coming soon)** – Uses on-site photos to validate progress and detect anomalies.

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | [Next.js 14](https://nextjs.org/) + [pnpm](https://pnpm.io/) |
| Backend | [FastAPI](https://fastapi.tiangolo.com/) + [Poetry](https://python-poetry.org/) |
| Database | [PostgreSQL](https://www.postgresql.org/) + [Neon](https://neon.tech/) |
| AI Orchestration | [LangChain](https://www.langchain.com/) + [OpenAI GPT models](https://platform.openai.com/) |
| Data Processing | [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) + [CLIP](https://github.com/openai/CLIP) |
| Hosting | [Vercel](https://vercel.com/) (frontend) + [Render](https://render.com/) (backend) |
| Version Control | GitHub (private monorepo) |

---

## Structure

```
zenbild-core/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── services/
│   │   └── agents/
│   │       ├── daily_tracker/
│   │       ├── finance_planner/
│   │       └── change_order_manager/
│   ├── pyproject.toml
│   └── README.md
│
├── frontend/
│   ├── nextjs-app/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── package.json
│   └── README.md
│
├── shared/
│   ├── schemas/
│   ├── utils/
│   └── types/
│
├── .github/
│   └── workflows/
│
└── README.md
```

---

## Setup

### Prerequisites
- **Python 3.11+** (via [pyenv](https://github.com/pyenv/pyenv))
- **Poetry** (for Python dependencies)
- **Node.js 20 LTS** (via [nvm](https://github.com/nvm-sh/nvm))
- **pnpm** (for JS workspaces)

### Backend
```bash
cd backend
poetry install
poetry shell
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend/nextjs-app
pnpm install
pnpm dev
```

App runs at:  
`http://localhost:3000`

---

## Roadmap (MVP → Beyond)

- [x] AI Daily Tracker MVP
- [ ] AI Financial Planner
- [ ] AI Change Order Manager
- [ ] Vision Inspector (image-based progress tracking)
- [ ] AI Transparency Dashboard

---

## Team

**Zenbild Founders**  
- Joaquim Venancio — CEO / Product  
- To Be Defined — CTO / Engineering  

---

## License
Private © Zenbild, 2025. All rights reserved.

---

> _Built with love, dust, and machine learning._
