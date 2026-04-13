FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 5055

# Порт по умолчанию совпадает с docker-compose (5055); для bridge-сети можно переопределить.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5055"]
