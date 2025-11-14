# backend/Dockerfile (Phiên bản tối ưu)

# ===================================================
#  Stage 1: Builder - Cài đặt dependencies
# ===================================================
FROM python:3.11-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on

# Cài đặt các gói cần thiết để build (ví dụ: mysqlclient)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Tạo các file wheel (đã được biên dịch) cho dependencies
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# ===================================================
#  Stage 2: Final - Image chạy ứng dụng
# ===================================================
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    DJANGO_SETTINGS_MODULE=code_battle_api.settings

WORKDIR /app

# Tạo user và group không phải root
RUN addgroup --system app && adduser --system --group app

# Cài đặt runtime dependency cho mysqlclient (nhỏ hơn dev package)
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt các Python dependencies đã được build từ stage trước
COPY --from=builder /wheels /wheels
COPY config /config

# COPY requirements.txt . # Không cần copy lại nếu chỉ cài từ wheels
RUN pip install --no-cache /wheels/*

# Copy source code và đổi chủ sở hữu
COPY . .
RUN chown -R app:app /app

# Chuyển sang user không phải root
USER app

# Expose port
EXPOSE 8000

# Default command (sẽ bị override bởi docker-compose cho worker)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "code_battle_api.asgi:application"]