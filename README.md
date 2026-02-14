# DocuBot AI

> Upload documents. Create AI chatbots. Embed anywhere.

A production-ready SaaS application that lets users upload documents (PDF, DOCX, XLSX, CSV, TXT) and generate AI chatbots powered by **RAG (Retrieval Augmented Generation)**. Chatbots can be embedded on websites and connected to WhatsApp and Telegram.

---

## Tech Stack

| Layer        | Technology                 |
| ------------ | -------------------------- |
| Frontend     | Next.js 14 + TypeScript + TailwindCSS |
| Backend      | FastAPI (Python)           |
| Database     | PostgreSQL + pgvector      |
| LLM Provider | OpenRouter (OpenAI-compatible) |
| Embeddings   | OpenAI text-embedding-3-small |
| Auth         | JWT (access + refresh tokens) |

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL** with [pgvector extension](https://github.com/pgvector/pgvector)
- **OpenRouter API Key** — [https://openrouter.ai](https://openrouter.ai)
- **OpenAI API Key** (for embeddings) — [https://platform.openai.com](https://platform.openai.com)

### 1. Clone & Setup Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your database URL, API keys, and secrets
```

```bash
# Frontend
cd frontend
cp .env.example .env.local
```

### 2. Setup PostgreSQL

```sql
CREATE DATABASE docubot;
-- pgvector extension is auto-created on app startup
```

### 3. Start Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## 📁 Project Structure

```
Docubot-ai/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Settings (env vars)
│   │   ├── database.py          # Async SQLAlchemy + pgvector
│   │   ├── models/              # ORM models (7 tables)
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── routers/             # API endpoints
│   │   │   ├── auth.py          # /api/auth/*
│   │   │   ├── chatbots.py      # /api/chatbots/*
│   │   │   ├── documents.py     # /api/chatbots/{id}/documents/*
│   │   │   ├── chat.py          # /api/chatbots/{id}/chat/*
│   │   │   ├── widget.py        # /api/widget/* (public)
│   │   │   ├── webhooks.py      # /api/webhooks/*
│   │   │   └── dashboard.py     # /api/dashboard/*
│   │   ├── services/            # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── document_service.py
│   │   │   ├── embedding_service.py
│   │   │   ├── llm_service.py       # OpenRouter integration
│   │   │   ├── rag_service.py       # RAG orchestration
│   │   │   ├── whatsapp_service.py
│   │   │   └── telegram_service.py
│   │   ├── middleware/
│   │   │   ├── auth_middleware.py    # JWT validation
│   │   │   └── rate_limiter.py
│   │   └── utils/
│   │       ├── file_parser.py       # PDF/DOCX/XLSX/CSV/TXT
│   │       ├── text_chunker.py      # tiktoken-based chunking
│   │       └── sanitizer.py         # Input sanitization
│   ├── uploads/                 # Local file storage
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── page.tsx         # Landing page
│   │   │   ├── login/           # Auth pages
│   │   │   ├── register/
│   │   │   └── dashboard/       # Protected dashboard
│   │   │       ├── page.tsx     # Stats overview
│   │   │       └── bots/[id]/   # Chat + settings
│   │   ├── components/          # React components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ChatArea.tsx
│   │   │   ├── DocumentUpload.tsx
│   │   │   └── SettingsPanel.tsx
│   │   └── lib/
│   │       ├── api.ts           # API client + SSE streaming
│   │       └── types.ts
│   ├── public/
│   │   └── widget.js            # Embeddable chat widget
│   └── .env.example
└── README.md
```

---

## 🔗 API Documentation

Visit `http://localhost:8000/docs` for the full interactive API documentation (Swagger UI).

### Key Endpoints

| Method | Endpoint                                     | Description              |
| ------ | -------------------------------------------- | ------------------------ |
| POST   | `/api/auth/register`                         | Register new user        |
| POST   | `/api/auth/login`                            | Login                    |
| POST   | `/api/auth/refresh`                          | Refresh JWT tokens       |
| GET    | `/api/chatbots/`                             | List user's chatbots     |
| POST   | `/api/chatbots/`                             | Create chatbot           |
| PATCH  | `/api/chatbots/{id}`                         | Update chatbot           |
| DELETE | `/api/chatbots/{id}`                         | Delete chatbot           |
| POST   | `/api/chatbots/{id}/documents/upload`        | Upload document          |
| GET    | `/api/chatbots/{id}/documents/`              | List documents           |
| POST   | `/api/chatbots/{id}/chat/`                   | Send chat message        |
| POST   | `/api/chatbots/{id}/chat/stream`             | Stream chat (SSE)        |
| POST   | `/api/widget/{bot_id}/chat`                  | Widget chat (public)     |
| GET    | `/api/dashboard/stats`                       | Usage statistics         |

---

## 🌐 Website Embed Widget

Add this script tag to any website:

```html
<script src="https://your-domain.com/widget.js" data-bot-id="YOUR_BOT_ID"></script>
```

The widget creates a floating chat bubble with isolated styling (Shadow DOM). No authentication required for website visitors.

---

## 📱 WhatsApp Setup

1. Create a **Meta Business** account at [business.facebook.com](https://business.facebook.com)
2. Go to **Meta for Developers** → Create App → Add **WhatsApp** product
3. Get your **Phone Number ID** and **Permanent Token**
4. Add to `.env`:
   ```
   WHATSAPP_TOKEN=your-token
   WHATSAPP_PHONE_NUMBER_ID=your-phone-id
   WHATSAPP_VERIFY_TOKEN=any-secret-string
   ```
5. Set webhook URL in Meta Dashboard:
   ```
   https://your-backend-domain.com/api/webhooks/whatsapp
   ```
6. Subscribe to **messages** webhook field

---

## 🤖 Telegram Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot`
2. Copy the **Bot Token**
3. Add to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your-bot-token
   ```
4. Set webhook (run once):
   ```bash
   curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://your-backend-domain.com/api/webhooks/telegram/YOUR_TOKEN"
   ```
5. Create an integration record in the database linking the bot token to a chatbot.

---

## 🔒 Security

- All API routes protected via JWT middleware (except auth & webhook endpoints)
- File type whitelist: PDF, DOCX, XLSX, CSV, TXT only
- Max file size: 10MB
- Input sanitization on all user inputs
- Prompt injection detection
- Tenant isolation: all DB queries filtered by `user_id`
- Rate limiting per user (30 messages/min, 10 uploads/min, 5 auth attempts/min)

---

## 🏗️ Environment Variables

See `backend/.env.example` and `frontend/.env.example` for all required environment variables.

---

## License

MIT
