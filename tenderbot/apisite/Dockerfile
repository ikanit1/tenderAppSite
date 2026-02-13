FROM node:20-alpine AS frontend-build

WORKDIR /frontend
COPY apisite/react/package*.json ./
RUN npm install
COPY apisite/react/ ./
RUN npm run build

FROM python:3.11-slim

WORKDIR /app

# System deps for some Python packages (e.g. lxml/Pillow wheels fallback)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY apisite/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apisite/ ./
COPY --from=frontend-build /frontend/dist ./react/dist

RUN mkdir -p /app/data /app/images /app/portal_export

CMD ["python", "main.py"]
