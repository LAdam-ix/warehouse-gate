FROM python:3.12-slim

WORKDIR /app

# Pillow needs these
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Use PDM only to export a flat requirements list, then install with pip
COPY pyproject.toml pdm.lock ./
RUN pip install --no-cache-dir pdm \
    && pdm export --no-hashes -o /tmp/requirements.txt \
    && pip install --no-cache-dir -r /tmp/requirements.txt gunicorn

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
