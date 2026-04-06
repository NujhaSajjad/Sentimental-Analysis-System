---
description: Start the full Call Center AI stack (Gladia transcription service + Node.js backend + React frontend)
---

# Prerequisites
- Python 3.9+ with venv at `c:\Users\hp\Desktop\callCenterAI\.venv`
- Node.js 18+ installed
- PostgreSQL running locally
- `GLADIA_API_KEY` set in `whisper-service/.env`
- `OPENROUTER_API_KEY` set in `backend/.env`

---

## Step 1 — Start the Gladia transcription service (Python)

Open a terminal in the project root and run:

```powershell
cd c:\Users\hp\Desktop\callCenterAI
.venv\Scripts\python.exe whisper-service\whisper_server.py
```

Expected output:
```
====================================================
  Gladia Server  |  Urdu + English  |  Diarization
====================================================
  URL         : http://localhost:5000
  Diarization : pyannoteAI (agent vs customer)
  Languages   : Urdu + English (code-switching)
  Speakers    : 2
  API Key     : ****xxxx
====================================================
```

Health check (optional, in a new terminal):
```powershell
curl http://localhost:5000/health
```

---

## Step 2 — Start the Node.js backend

```powershell
cd c:\Users\hp\Desktop\callCenterAI\backend
npm run dev
```

Or if no dev script:
```powershell
node server.js
```

Expected output:
```
╔══════════════════════════════════════════════════════╗
║   ✅ Avanza Solutions Backend is Running!            ║
║   📡 Port: 3000                                      ║
║   🗄️  DB Status: ✅ Connected                        ║
║   🤖 AI Config: ✅ OpenRouter Key Found              ║
╚══════════════════════════════════════════════════════╝
```

---

## Step 3 — Start the React frontend

```powershell
cd c:\Users\hp\Desktop\callCenterAI\avanza-frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

---

## Upload & Processing Flow

When a user uploads audio via the UI:

1. **Upload** → `POST /api/calls/upload` → audio saved to `backend/uploads/`
2. **Transcribe** → `POST /api/analysis/transcribe/:callId`
   - Sends audio to Gladia Python service (`http://localhost:5000/transcribe`)
   - Gladia uploads to cloud, transcribes with diarization (Urdu + English)
   - Returns `transcription`, `utterances[]`, `transcription_with_speakers`
   - Node saves transcription + diarization turns to DB in one step
3. **Intent** → `POST /api/analysis/extract-intent/:callId` (OpenRouter AI)
4. **Analyze** → `POST /api/analysis/analyze/:callId` (OpenRouter AI)
5. **Diarization** → Already saved from Gladia in step 2. LLM diarize is only used as fallback.

All steps are chained automatically via `POST /api/analysis/process-complete/:callId`.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `Gladia service is not running` | Start Python service (Step 1) |
| `GLADIA_API_KEY not set` | Add key to `whisper-service/.env` |
| `OPENROUTER_API_KEY not configured` | Add key to `backend/.env` |
| `Database connection failed` | Ensure PostgreSQL is running on port 5432 |
| `Audio file not found on disk` | Check `backend/uploads/` directory exists |
| Upload timeout | Increase `GLADIA_TIMEOUT_MS` in `backend/.env` (default: 600000ms) |

---

## Environment Variables Reference

### `whisper-service/.env`
```
GLADIA_API_KEY=your_key_here     # Get free key at https://app.gladia.io
NUM_SPEAKERS=2                    # Agent + Customer
POLL_INTERVAL=2.0                 # Seconds between status checks
MAX_WAIT_SEC=1800                 # Max transcription wait (30 min)
```

### `backend/.env`
```
WHISPER_SERVICE_URL=http://localhost:5000   # Points to Gladia Python service
GLADIA_TIMEOUT_MS=600000                    # 10 min axios timeout
OPENROUTER_API_KEY=...                      # For AI analysis
PORT=3000
```
