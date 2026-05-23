"""
gladia_server.py — Drop-in replacement for whisper_server.py using Gladia API
══════════════════════════════════════════════════════════════════════════════

SETUP:
  pip install flask flask-cors requests
  export GLADIA_API_KEY=your_key_here
  python gladia_server.py

GET YOUR FREE KEY:
  https://app.gladia.io  →  10 free hours/month, no credit card needed
"""

import os
import time
import json
import tempfile
import threading
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests as req_lib
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

GLADIA_API_KEY    = os.getenv("GLADIA_API_KEY", "")
GLADIA_UPLOAD     = "https://api.gladia.io/v2/upload"
GLADIA_TRANSCRIBE = "https://api.gladia.io/v2/pre-recorded"

# Call center calls always have 2 speakers: agent + customer
NUM_SPEAKERS  = int(os.getenv("NUM_SPEAKERS", "2"))
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "2.0"))
MAX_WAIT_SEC  = int(os.getenv("MAX_WAIT_SEC", "1800"))  # 30 min max


# ═══════════════════════════════════════════════════════════════════════════════
# GLADIA HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _headers():
    return {"x-gladia-key": GLADIA_API_KEY, "accept": "application/json"}


def upload_audio(file_path: str) -> str:
    """Upload local file to Gladia, return the audio_url."""
    print(f"   Uploading to Gladia...")
    with open(file_path, "rb") as f:
        resp = req_lib.post(
            GLADIA_UPLOAD,
            headers=_headers(),
files = {
    "audio": (
        os.path.basename(file_path),
        f,
        "audio/mpeg"  # or "audio/wav" depending on file
    )
}        )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Upload failed ({resp.status_code}): {resp.text}")
    audio_url = resp.json().get("audio_url")
    print(f"   Uploaded OK")
    return audio_url


def start_transcription(audio_url: str) -> str:
    """Submit transcription job, return result_url to poll."""
    payload = {
        "audio_url": audio_url,

        # Language: Urdu + English code-switching
        "detect_language": True,
        "enable_code_switching": True,
        "language_config": {
            "languages": ["ur", "en"],
        },

        # Diarization: agent vs customer, powered by pyannoteAI
        # No LLM needed - this is a dedicated speaker separation model
        "diarization": True,
        "diarization_config": {
            "number_of_speakers": NUM_SPEAKERS,
            "min_speakers": 1,
            "max_speakers": NUM_SPEAKERS,
        },

        # Quality improvements
        "sentences": True,
        "punctuation_enhanced": True,
        "custom_vocabulary": [
            "aap", "main", "theek", "shukriya", "haan", "nahi",
            "account", "payment", "invoice", "mujhe", "bohot",
            "accha", "zaroor", "bilkul", "kya", "problem",
        ],
    }

    resp = req_lib.post(
        GLADIA_TRANSCRIBE,
        headers={**_headers(), "Content-Type": "application/json"},
        json=payload,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Transcription start failed ({resp.status_code}): {resp.text}")

    data       = resp.json()
    job_id     = data.get("id", "")
    result_url = data.get("result_url", f"https://api.gladia.io/v2/pre-recorded/{job_id}")
    print(f"   Job started: {job_id}")
    return result_url


def poll_result(result_url: str, on_progress=None) -> dict:
    """Poll until done. Calls on_progress(pct) if provided."""
    start    = time.time()
    last_pct = -1

    while True:
        if time.time() - start > MAX_WAIT_SEC:
            raise TimeoutError(f"Gladia timed out after {MAX_WAIT_SEC}s")

        resp   = req_lib.get(result_url, headers=_headers())
        data   = resp.json()
        status = data.get("status", "")

        if status == "done":
            return data
        if status == "error":
            raise RuntimeError(f"Gladia job failed: {data}")

        pct = int(data.get("percent_complete") or 0)
        if on_progress and pct != last_pct:
            last_pct = pct
            on_progress(pct)

        time.sleep(POLL_INTERVAL)


def parse_result(data: dict) -> dict:
    """
    Parse Gladia result into the same response shape as whisper_server.py
    so Node.js transcriptionService.js needs zero changes.

    Extra fields (utterances, transcription_with_speakers) are bonus —
    save them to your DB if you want speaker-labeled analysis.
    """
    result         = data.get("result", {})
    stt            = result.get("transcription", {})
    utterances_raw = stt.get("utterances", [])
    full_text_raw  = stt.get("full_transcript", "")

    utterances    = []
    speaker_lines = []
    prev_speaker  = None

    for utt in utterances_raw:
        speaker = utt.get("speaker", 0)
        text    = (utt.get("text") or utt.get("transcript") or "").strip()
        if not text:
            continue

        label = f"Speaker {speaker + 1}"
        utterances.append({
            "speaker":  label,
            "text":     text,
            "start":    round(utt.get("start", 0), 2),
            "end":      round(utt.get("end", 0), 2),
            "language": utt.get("language", ""),
        })

        # Build readable labeled transcript
        if label != prev_speaker:
            speaker_lines.append(f"{label}: {text}")
            prev_speaker = label
        else:
            speaker_lines[-1] += f" {text}"

    plain_text               = " ".join(u["text"] for u in utterances) or full_text_raw
    transcript_with_speakers = "\n".join(speaker_lines)
    metadata                 = result.get("metadata", {})
    langs                    = list({u["language"] for u in utterances if u["language"]})

    return {
        # --- Same fields whisper_server.py returned (Node.js reads these) ---
        "success":          True,
        "transcription":    plain_text,
        "word_count":       len(plain_text.split()),
        "duration":         round(metadata.get("audio_duration", 0), 2),
        "language":         langs[0] if langs else "ur+en",
        "chunks_processed": len(utterances),
        "model":            "gladia-solaria",

        # --- Bonus diarization fields (save to DB if useful) ---
        "transcription_with_speakers": transcript_with_speakers,
        "utterances":                  utterances,
        "languages_detected":          langs,
        "diarization_enabled":         True,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "gladia server running",
        "model":  "gladia-solaria",
        "ready":  bool(GLADIA_API_KEY),
        "features": {
            "diarization":    True,
            "code_switching": True,
            "languages":      ["ur", "en"],
            "num_speakers":   NUM_SPEAKERS,
        },
    })


@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    """Standard endpoint — waits for Gladia to finish, returns full result."""
    if not GLADIA_API_KEY:
        return jsonify({"error": "GLADIA_API_KEY not set"}), 500
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    suffix     = os.path.splitext(audio_file.filename or "audio")[1] or ".wav"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        audio_file.save(tmp.name)
        temp_path = tmp.name

    try:
        print(f"\nReceived: {audio_file.filename}")
        t_start = time.time()

        audio_url  = upload_audio(temp_path)
        result_url = start_transcription(audio_url)

        print(f"   Waiting for Gladia...")
        raw    = poll_result(result_url)
        parsed = parse_result(raw)

        elapsed  = time.time() - t_start
        speakers = len(set(u["speaker"] for u in parsed["utterances"]))
        print(f"   Done in {elapsed:.1f}s | {parsed['word_count']} words | {speakers} speakers")

        return jsonify({**parsed, "processing_time": round(elapsed, 2)})

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500

    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@app.route("/transcribe/stream", methods=["POST"])
def transcribe_stream():
    """SSE streaming — emits progress events then final result."""
    if not GLADIA_API_KEY:
        def _err():
            yield f"data: {json.dumps({'event': 'error', 'error': 'GLADIA_API_KEY not set'})}\n\n"
        return Response(_err(), mimetype="text/event-stream")

    if "audio" not in request.files:
        def _err():
            yield f"data: {json.dumps({'event': 'error', 'error': 'No audio file'})}\n\n"
        return Response(_err(), mimetype="text/event-stream")

    audio_file = request.files["audio"]
    suffix     = os.path.splitext(audio_file.filename or "audio")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        audio_file.save(tmp.name)
        temp_path = tmp.name

    def generate():
        try:
            yield f"data: {json.dumps({'event': 'start', 'message': 'Uploading...'})}\n\n"

            audio_url  = upload_audio(temp_path)
            result_url = start_transcription(audio_url)

            yield f"data: {json.dumps({'event': 'processing', 'message': 'Gladia is transcribing...'})}\n\n"

            # Poll in background thread, stream progress to client
            result_holder = [None]
            error_holder  = [None]
            progress_q    = []
            lock          = threading.Lock()

            def on_progress(pct):
                with lock:
                    progress_q.append(pct)

            def poll_worker():
                try:
                    result_holder[0] = poll_result(result_url, on_progress)
                except Exception as ex:
                    error_holder[0] = str(ex)

            t = threading.Thread(target=poll_worker, daemon=True)
            t.start()

            while t.is_alive():
                time.sleep(1.5)
                with lock:
                    while progress_q:
                        pct = progress_q.pop(0)
                        yield f"data: {json.dumps({'event': 'progress', 'percent': pct})}\n\n"

            t.join()

            if error_holder[0]:
                yield f"data: {json.dumps({'event': 'error', 'error': error_holder[0]})}\n\n"
                return

            parsed = parse_result(result_holder[0])

            # Emit each utterance as a chunk event
            total = len(parsed["utterances"])
            for i, utt in enumerate(parsed["utterances"]):
                yield f"data: {json.dumps({'event': 'chunk', 'chunk_index': i, 'total_chunks': total, 'text': utt['text'], 'speaker': utt['speaker'], 'language': utt['language'], 'start': utt['start'], 'end': utt['end']})}\n\n"

            yield f"data: {json.dumps({'event': 'complete', **parsed})}\n\n"

        except Exception as e:
            import traceback; traceback.print_exc()
            yield f"data: {json.dumps({'event': 'error', 'error': str(e)})}\n\n"
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "=" * 52)
    print("  Gladia Server  |  Urdu + English  |  Diarization")
    print("=" * 52)
    print(f"  URL         : http://localhost:5000")
    print(f"  Diarization : pyannoteAI (agent vs customer)")
    print(f"  Languages   : Urdu + English (code-switching)")
    print(f"  Speakers    : {NUM_SPEAKERS}")
    if not GLADIA_API_KEY:
        print(f"\n  WARNING: GLADIA_API_KEY not set!")
        print(f"  export GLADIA_API_KEY=your_key_here")
        print(f"  Free key: https://app.gladia.io")
    else:
        print(f"  API Key     : ****{GLADIA_API_KEY[-4:]}")
    print("=" * 52 + "\n")

    env = os.environ.get("FLASK_ENV", "development")
    if env == "production":
        print("  Starting with Waitress WSGI Server (Production Mode)...")
        from waitress import serve
        serve(app, host="0.0.0.0", port=5000)
    else:
        print("  Starting with Flask Dev Server (Development Mode)...")
        app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)