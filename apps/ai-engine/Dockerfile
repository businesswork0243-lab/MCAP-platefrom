# ═══════════════════════════════════════════════════════════
# M-CAP AI Engine - Production Dockerfile
# Build Context: apps/ai-engine/ (or repo root)
# ═══════════════════════════════════════════════════════════

# ─── Stage 1: Base ─────────────────────────────────────────
FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ─── Stage 2: Dependencies ─────────────────────────────────
FROM base AS deps

# Copy requirements first (for caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ─── Stage 3: Runner (Production) ──────────────────────────
FROM base AS runner

ENV ENVIRONMENT=production

# Create non-root user
RUN groupadd --system --gid 1001 aigroup && \
    useradd --system --uid 1001 --gid aigroup --create-home aiuser

# Copy installed dependencies from deps stage
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=aiuser:aigroup . .

USER aiuser

# Railway dynamically assigns PORT
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Use shell form to expand $PORT env variable
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1