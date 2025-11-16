# ================================
# Stage 1: Builder
# ================================
FROM python:3.11-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Build wheels
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# ================================
# Stage 2: Final image
# ================================
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=code_battle_api.settings

WORKDIR /app

# Tạo user không phải root
RUN addgroup --system app && adduser --system --group app

# Cài runtime dependency cho MySQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels & install
COPY --from=builder /wheels /wheels
RUN pip install --no-cache /wheels/*
RUN apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-vie
# copy config đúng cách
COPY ./config /config

# Copy toàn bộ source code backend
COPY . .

# Quyền
RUN chown -R app:app /app /config

USER app

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "code_battle_api.asgi:application"]
