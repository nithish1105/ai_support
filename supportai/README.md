# SupportAI — AI-Powered Real-Time Customer Support & Human Escalation Platform

> **Smart Support. Faster Resolution. Human When Needed.**

SupportAI is a production-grade, full-stack customer support platform that blends real-time AI conversation handling, NLP sentiment and intent classification, automated knowledge-base troubleshooting, and seamless escalation to human agents with AI copilot assistance.

---

## 🌟 Key Features

1. **AI-First Support Engine**:
   - Automated NLP analysis of customer messages: **Sentiment Detection** (Positive/Neutral/Negative), **Zero-Shot Intent Categorization** (15 categories), and **Urgency Scoring** (Low/Medium/High/Critical).
   - Dynamic **Escalation Risk Index** (0-100%) based on customer frustration markers, repeated solution rejections, and keywords.

2. **Automated Solution Engine & Memory**:
   - Queries integrated Knowledge Base articles with step-by-step resolution guides.
   - Preserves solution attempt history and never repeats failed steps.

3. **Intelligent Escalation & Human Live Queue**:
   - Immediate human escalation on explicit customer requests or after reaching maximum AI attempts (`MAX_AI_ATTEMPTS = 3`).
   - Real-time priority queue for support agents with live waiting timers and sentiment indicators.

4. **Agent Console with AI Copilot & Handoff Briefing**:
   - Instant **AI Handoff Summary** summarizing the issue, customer sentiment, and prior troubleshooting attempts.
   - **Private AI Copilot** generating empathy-tailored response suggestions with one-click insertion and next action steps.
   - **Confidential Internal Notes** restricted to agent, supervisor, and admin staff.

5. **Customer Satisfaction & Ticket Lifecycle**:
   - Interactive satisfaction ratings (1-5 stars) and issue resolution confirmation.
   - Complete 12-state state machine: `CREATED`, `AI_ASSISTING`, `WAITING_FOR_CUSTOMER`, `CUSTOMER_NOT_SATISFIED`, `ESCALATION_REQUESTED`, `WAITING_FOR_AGENT`, `AGENT_ASSIGNED`, `HUMAN_AGENT_ACTIVE`, `AI_RESOLVED`, `RESOLVED`, `REOPENED`, `CLOSED`.

6. **Analytics & Performance Tracking**:
   - Real-time dashboard with Recharts showing AI vs. Human resolution rates, sentiment breakdown, category distribution, and CSAT scores.

7. **Strict Visual Identity**:
   - Enterprise palette: **WHITE** (#FFFFFF / #F8F8F8) + **ORANGE** (#F97316) + **GREEN** (#16A34A) + **BLACK** (#111111).

---

## 🏗 Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Axios, Lucide React, Recharts, WebSocket client, Zustand state management.
- **Backend**: Python 3.11, FastAPI, Uvicorn, WebSockets, Pydantic v2, SQLAlchemy 2.0 (Async ORM), SQLite (Dev) / PostgreSQL (Prod), Passlib / Bcrypt, Python-JOSE (JWT).
- **AI & NLP**: Hugging Face Transformers (`distilbert-base-uncased-finetuned-sst-2-english`, `facebook/bart-large-mnli`), PyTorch, rule-based fallbacks.
- **DevOps**: Docker, Docker Compose, Nginx.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Docker & Docker Compose (optional for containerized setup)

### 2. Environment Setup
```bash
# Clone the repository
git clone <repo-url>
cd supportai

# Copy environment template
cp .env.example .env
```

### 3. Running Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the FastAPI server (auto-seeds database on startup)
uvicorn app.main:app --reload --port 8000
```
Backend API will be live at `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.

### 4. Running Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend will be live at `http://localhost:5173`.

### 5. Running with Docker Compose
```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

---

## 👥 Demo Credentials

The database is pre-seeded with ready-to-test accounts across all roles:

| Role | Email | Password | Description |
| :--- | :--- | :--- | :--- |
| **Customer** | `sarah@demo.com` | `customer123` | Active customer with demo tickets |
| **Customer** | `michael@demo.com` | `customer123` | Customer with escalated ticket |
| **Agent** | `alex@supportai.com` | `agent123` | Support Agent (Alex Thompson) |
| **Agent** | `john@supportai.com` | `agent123` | Support Agent (John Martinez) |
| **Admin** | `admin@supportai.com` | `admin123` | Full administrative access |

---

## 🎬 Complete Demo Flow Scenario

Follow these steps to demonstrate the end-to-end lifecycle:

1. **Customer Login & Ticket Creation**:
   - Log in as `sarah@demo.com` / `customer123`.
   - Click **+ Create New Support Issue**.
   - Title: `Internet Connection Dropped`, Category: `Internet Problem`.
   - Description: `My internet connection stopped working. I already restarted the router but it still doesn't work.`
   - Click **Create Support Ticket** &rarr; Unique token generated (e.g. `SUP-2026-X7K2P9`).

2. **AI Real-Time Troubleshooting**:
   - Click **Start AI Support** to enter the live chat.
   - AI detects negative sentiment and identifies that router restart was already attempted, offering Step #2 (checking WAN cable).
   - Type `Still not working after checking the cable.`
   - AI records attempt #2 as failed and offers router factory reset.

3. **Human Escalation**:
   - Type `I want to speak to a human agent please.` (or click the escalation banner).
   - Ticket status changes to `WAITING_FOR_AGENT`.

4. **Agent Queue & Accept**:
   - In another browser tab/window, log in as `alex@supportai.com` / `agent123`.
   - Open **Live Queue** &rarr; see Sarah's escalated ticket at top priority with 95% escalation risk score.
   - Click **Accept Ticket** &rarr; agent joins Sarah's live chat session.

5. **AI Copilot & Resolution**:
   - Agent reviews the **AI Handoff Summary** showing attempted steps.
   - AI Copilot privately recommends a greeting and next action. Agent clicks **Use Response** and sends the message.
   - Agent clicks **Resolve Ticket** once completed.
   - Customer confirms resolution with 5-star rating &rarr; Ticket automatically transitions to `CLOSED`.

---

## 📊 API & WebSocket Endpoints

### Authentication
- `POST /api/auth/register` — Register a customer account
- `POST /api/auth/login` — JWT login
- `GET /api/auth/me` — Current authenticated user profile
- `POST /api/auth/logout` — Logout user

### Tickets & Workflow
- `POST /api/tickets` — Create ticket & generate unique `SUP-YYYY-XXXXXX` token
- `GET /api/tickets` — List tickets (filtered by user role)
- `GET /api/tickets/{id}` — Fetch ticket details
- `GET /api/tickets/token/{token}` — Public ticket lookup by token
- `POST /api/tickets/{id}/escalate` — Request human agent escalation
- `POST /api/tickets/{id}/assign` — Agent assigns and joins ticket
- `POST /api/tickets/{id}/resolve` — Agent marks ticket as resolved
- `POST /api/tickets/{id}/satisfaction` — Customer feedback submission
- `POST /api/tickets/{id}/notes` — Agent internal notes (private)

### Real-Time WebSocket
- `ws://localhost:8000/ws/tickets/{ticket_id}?token={jwt_token}`
  - Supported events: `customer_message`, `ai_message`, `agent_message`, `typing`, `ai_typing`, `copilot_update`, `handoff_summary`, `ticket_status`, `ticket_resolved`, `feedback`.

---

## 🧪 Testing

Run backend tests:
```bash
cd backend
pytest tests/ -v
```

Build frontend for production:
```bash
cd frontend
npm run build
```

---

## 📄 License
MIT License. Developed for SupportAI.
