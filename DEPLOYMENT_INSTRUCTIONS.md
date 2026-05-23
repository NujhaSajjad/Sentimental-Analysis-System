# 🚀 Call Center AI Deployment Checklist & Guide

This document contains step-by-step instructions for deploying to a cloud Provider (Render/Railway/Vercel or an EC2 Instance).

## Pre-Flight Checklist
- [ ] **API Keys Rotated**: If your repository was ever public, ensure you have gone to OpenRouter and Gladia to revoke the keys found in the old `.env` files and regenerate new ones.
- [ ] **Generate JWT Secret**: Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` in your terminal to generate a secure secret.
- [ ] **Copy Environment Template**: You have a `backend/.env.example`. This is what you will use to populate the cloud environment variables.

---

## ☁️ Deployment Strategy: Render + Vercel
This is the recommended easiest, most secure path that requires no Docker/PM2 management.

### Part 1: PostgreSQL Database (Render or Supabase)
1. In your cloud provider, spin up a **Managed PostgreSQL DB**.
2. Copy the `DATABASE_URL` string they provide (`postgresql://user:pass@host/db`).
3. (Important): Ensure `DB_SSL=true` is set in the backend environment variables if prompted, as managed databases require SSL.

### Part 2: Python Gladia Service (Render)
Waitress is installed and implemented conditionally for production WSGI.
1. Create a new **Web Service** on Render and point it to the repository.
2. Set Root Directory to `whisper-service`.
3. Set Language to **Python 3**.
4. Set Build Command: `pip install -r requirements.txt` (Make sure `waitress` and `flask` are listed here if they aren't).
5. Set Start Command: `python whisper_server.py`
6. Add Environment Variables:
   - `GLADIA_API_KEY`: `<your_new_gladia_key>`
   - `FLASK_ENV`: `production`
7. Note down the public URL Render gives this service (e.g., `https://whisper-service.onrender.com`).

### Part 3: Node.js Backend (Render)
The backend is now protected with Helmet and Rate-Limiting. Loopback API calls are removed.
1. Create another **Web Service** on Render.
2. Set Root Directory to `backend`.
3. Set Language to **Node**.
4. Set Build Command: `npm install`
5. Set Start Command: `node server.js`
6. Add Environment Variables (From your `.env.example`):
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
   - `DB_USER`, `DB_HOST`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` (or `DATABASE_URL`)
   - `JWT_SECRET`: `<your_secure_64_char_key>`
   - `OPENROUTER_API_KEY`: `<your_new_openrouter_key>`
   - `WHISPER_SERVICE_URL`: `<The URL from Part 2>`
   - `FRONTEND_URL`: Leave blank for a moment, we will grab this from Vercel.
7. Deploy the service. Note down the URL (e.g., `https://backend-api.onrender.com`).

### Part 4: React Frontend (Vercel)
Vercel is the easiest place to host a React Create-React-App frontend.
1. Import the repository into **Vercel**.
2. Set Root Directory to `avanza-frontend`.
3. Framework Preset: **Create React App**.
4. Environment Variables:
   - `REACT_APP_API_URL`: `<The URL from Part 3>`
5. Deploy the application. Note down the Vercel URL (e.g., `https://avanza-frontend.vercel.app`).

### Part 5: Final CORS Configuration
1. Go back to your Node.js Backend on Render.
2. Add the Vercel URL to the Environment Variables under `FRONTEND_URL`. Do not include trailing slashes. 
   *(Example: `FRONTEND_URL=https://avanza-frontend.vercel.app`)*
3. Redeploy the Backend to apply the secure CORS policy.

---
## Fallback: EC2 / Droplet (PM2)
If you prefer deploying entirely on a single Ubuntu VM:
1. Clone the repository to the server.
2. Install Node.js, Python 3, Postgres (`sudo apt install postgresql`).
3. Configure PostgreSQL locally (create db/user). 
4. Run `npm install pm2 -g`
5. Python: `cd whisper-service && pip install -r requirements.txt && export FLASK_ENV=production && pm2 start "python whisper_server.py" --name whisper`
6. Backend: `cd backend && npm i && pm2 start server.js --name backend`
7. Frontend: `cd avanza-frontend && npm i && npm run build`. Run a static server or proxy via Nginx. 
8. Use **Certbot & Let's Encrypt** on Nginx for HTTPS.
