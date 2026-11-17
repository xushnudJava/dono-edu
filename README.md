# Dono edu starter
React/Vite + Flask + PostgreSQL-ready. Local development:
1. `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp .env.example .env && python run.py`
2. New terminal: `cd frontend && npm install && cp .env.example .env && npm run dev`
Frontend: http://localhost:5173 | API: http://127.0.0.1:5000

Video: put MP4 files in `frontend/public/videos/`; filenames are configured in `frontend/src/data/topics.js`.
Questions: edit topic-specific files in `frontend/src/data/questions/`.
Wordwall: add the Wordwall Student Assignment embed URL in `topics.js`. This starter records a manual completion confirmation; Wordwall embed does not automatically send a score into this app.
Deploy: Vercel frontend (root `frontend`), Render backend (root `backend`, start `gunicorn run:app`). Set `VITE_API_URL`, `DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET_KEY`, `FRONTEND_ORIGIN`. Never upload `.env`.
