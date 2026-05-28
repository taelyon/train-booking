# ==========================================
# Stage 1: React 프론트엔드 빌드
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# 의존성 복사 및 설치
COPY package*.json ./
RUN npm ci

# 소스 복사 및 빌드 실행 (dist 폴더 생성)
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Flask 백엔드 서빙 및 실행
# ==========================================
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# 타임존 설정 (한국 표준시)
ENV TZ=Asia/Seoul
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 백엔드 의존성 복사 및 설치
COPY api/requirements.txt ./api/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r api/requirements.txt

# 1단계에서 빌드된 React 정적 파일(dist) 복사
COPY --from=frontend-builder /app/dist ./dist

# Python API 코드 복사
COPY api/ ./api/

# 외부 포트 5001 노출
EXPOSE 5001

# 앱 실행
CMD ["python", "api/app.py"]
