# ---------- Stage 1: Build the Next.js static frontend ----------
FROM node:20-slim AS frontend

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Stage 2: Python + Gunicorn serves everything ----------
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy the static frontend build from stage 1
COPY --from=frontend /app/out ./out

# Railway injects PORT as an env var (default 8080)
ENV PORT=8080

EXPOSE ${PORT}

WORKDIR /app/backend
CMD ["sh", "-c", "gunicorn -w 4 --threads 4 -b 0.0.0.0:${PORT} --timeout 120 --access-logfile - --error-logfile - api:app"]
