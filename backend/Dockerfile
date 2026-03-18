FROM python:3.11-slim

# Dependencias del sistema (necesarias para WeasyPrint y lxml)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-xlib-2.0-0 \
    libffi-dev \
    shared-mime-info \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias primero (cacheado)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Crear directorio para certificados AFIP (se monta como volumen)
RUN mkdir -p /app/app/certs

EXPOSE 8000

# En producción usar 2 workers (ajustar según RAM del VPS: workers = CPU*2+1)
# Para VPS de 2GB RAM, 2 workers es suficiente.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
