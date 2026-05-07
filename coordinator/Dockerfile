FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

COPY pyproject.toml ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
RUN pip install .

# Railway / Fly / Render assign $PORT dynamically; default to 8000 for
# local docker run.
ENV PORT=8000
EXPOSE 8000

# Run alembic on every boot (idempotent — `upgrade head` is a no-op
# when already at head) before handing off to uvicorn. `exec` replaces
# the shell so SIGTERM reaches uvicorn cleanly.
CMD ["sh", "-c", "echo \"[startup] running alembic upgrade head\" && alembic upgrade head && echo \"[startup] starting uvicorn on port ${PORT}\" && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
