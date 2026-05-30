# 🚀 Call Center AI Deployment Checklist & Guide (100% Free & Cardless)

This document contains step-by-step instructions for deploying to a secure, enterprise-grade cloud environment using **Supabase + Hugging Face Spaces + Vercel**. This entire stack is **100% free and does not require entering any credit card details**.

---

## 📋 Pre-Flight Checklist
- [ ] **Push dynamic PORT and Docker settings**: Ensure you have pushed the latest commit with Dockerfiles and dynamic PORT updates so Hugging Face Spaces can build your containers flawlessly.
  ```bash
  git add .
  git commit -m "Add Docker and port settings for Hugging Face Spaces deployment"
  git push
  ```
- [ ] **Generate JWT Secret**: Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` in your terminal to generate a secure secret.
- [ ] **Prepare API Keys**: Have your **Gladia API Key** and **OpenRouter API Key** ready.

---

## ☁️ Deployment Strategy: Supabase + Hugging Face Spaces + Vercel

### Part 1: PostgreSQL Database (Supabase)
Supabase provides a standard, robust PostgreSQL instance that never expires on the free tier.
1. Sign up on [Supabase.com](https://supabase.com) using your GitHub account (**No card required**).
2. Create a **New Project** (e.g., `call-center-ai`).
3. Choose a secure database password and choose the closest hosting region.
4. Go to **Project Settings** (gear icon) → **Database** → **Connection string** → **URI**.
5. Copy the connection string. It will look like this:
   `postgresql://postgres.[your-id]:[your-password]@aws-0-[region].pooler.supabase.com:6543/postgres`
6. Replace `[your-password]` with your actual database password. This is your unified `DATABASE_URL`.

---

### Part 2: Python Gladia Service (Hugging Face Spaces)
Hugging Face Spaces allows you to run full Docker containers 24/7 for free without any execution timeouts or credit card verification.
1. Sign up/log in on [Hugging Face](https://huggingface.co/).
2. Go to **Spaces** → click **Create new Space**.
3. Configure the Space settings:
   * **Space Name**: `whisper-service` (or any custom name).
   * **License**: `mit` (or any).
   * **SDK**: Select **Docker**.
   * **Docker Template**: Select **Blank**.
   * **Space Hardware**: **CPU basic • 2 vCPU • 16 GB • Free**.
   * **Visibility**: **Public** (required so the Node.js backend can reach it).
4. Clone your new Hugging Face Space repository locally, copy all files from your local `whisper-service/` folder (including `Dockerfile`, `whisper_server.py`, and `requirements.txt`) into it, and push them.
   *(Alternatively, use the Hugging Face web UI under the "Files" tab to upload these files directly).*
5. Go to the Space's **Settings** tab:
   * Scroll down to **Variables and Secrets** → **New Secret**.
   * Add `GLADIA_API_KEY` with your Gladia API key.
   * Add `FLASK_ENV` with value `production`.
6. Once built, note down the direct URL of your Space. It will be:
   `https://<your-username>-whisper-service.hf.space`

---

### Part 3: Node.js Backend (Hugging Face Spaces)
Our backend code has been optimized to handle unified database connection strings, custom CORS policies, and standard production security.
1. Create another new Space on **Hugging Face**.
2. Configure the Space settings:
   * **Space Name**: `call-center-backend` (or any custom name).
   * **SDK**: Select **Docker**.
   * **Docker Template**: Select **Blank**.
   * **Space Hardware**: **CPU basic • 2 vCPU • 16 GB • Free**.
   * **Visibility**: **Public** (required so the React frontend can reach the APIs).
3. Clone this Space repository, copy all files from your local `backend/` folder (including `Dockerfile`, `package.json`, `server.js`, `database.js`, etc. — do NOT copy `node_modules` or `.env` files) into it, and push them.
   *(Alternatively, upload these files via the web UI).*
4. Go to the Space's **Settings** tab → **Variables and Secrets** → **New Secret**:
   * Add `NODE_ENV` with value `production`.
   * Add `DATABASE_URL` with your Supabase connection URI string from Part 1.
   * Add `JWT_SECRET` with your secure 64-character key.
   * Add `OPENROUTER_API_KEY` with your OpenRouter API Key.
   * Add `WHISPER_SERVICE_URL` with your Python service URL from Part 2 (`https://<username>-whisper-service.hf.space`).
   * Add `FRONTEND_URL` (leave blank for a moment, we will grab it from Vercel).
5. Once built, note down the direct URL of this backend Space:
   `https://<your-username>-call-center-backend.hf.space`

---

### Part 4: React Frontend (Vercel)
Vercel is the ultimate hosting provider for compiled React frontends.
1. Sign up/log in to [Vercel.com](https://vercel.com) using your GitHub account (**No card required**).
2. Click **Add New** → **Project** and import your repository.
3. Configure the project:
   * **Root Directory**: `avanza-frontend`
   * **Framework Preset**: **Create React App**
4. **Environment Variables**:
   * `REACT_APP_API_URL`: `<Your Node.js backend Space URL from Part 3>`
5. Click **Deploy**. Note down your live Vercel URL (e.g., `https://avanza-frontend.vercel.app`).

---

### Part 5: Final CORS Configuration
To secure the setup, prevent unauthorized access, and avoid browser CORS errors:
1. Go back to your **Node.js Backend** Space on Hugging Face.
2. Go to **Settings** → **Variables and Secrets**.
3. Under secrets, edit/add `FRONTEND_URL` and set its value to your Vercel frontend URL. Do not include trailing slashes.
   *(Example: `FRONTEND_URL=https://avanza-frontend.vercel.app`)*
4. The Space will automatically rebuild and apply the secure CORS policy.

Your production Call Center AI system is now fully live, secure, connected, and completely free!
