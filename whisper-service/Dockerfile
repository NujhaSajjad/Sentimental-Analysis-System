FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hugging Face Spaces requires port 7860
ENV PORT=7860
ENV FLASK_ENV=production
EXPOSE 7860

CMD ["python", "whisper_server.py"]
