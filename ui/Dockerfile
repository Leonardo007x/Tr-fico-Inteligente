# Dockerfile optimizado para UI del Sistema
FROM nginx:alpine

# Metadata profesional
LABEL maintainer="Sistema Control Tráfico Popayán <dev@traffic-popayan.gov.co>"
LABEL version="1.0.0"
LABEL description="Interfaz Web - Mapa Interactivo de Popayán"

# Instalar dependencias y limpiar cache
RUN apk add --no-cache curl tzdata && \
    rm -rf /var/cache/apk/*

# Zona horaria Colombia
ENV TZ=America/Bogota
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Copiar archivos de la aplicación
COPY . /usr/share/nginx/html

# Configuración de nginx optimizada para puerto 3000
RUN echo 'server { \
    listen 3000; \
    server_name localhost; \
    \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Headers de seguridad \
    add_header X-Frame-Options "DENY"; \
    add_header X-Content-Type-Options "nosniff"; \
    add_header X-XSS-Protection "1; mode=block"; \
    \
    # Compresión \
    gzip on; \
    gzip_types text/css application/javascript application/json text/html; \
    \
    # Servir archivos estáticos \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Cache para assets estáticos \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # Health check \
    location /health { \
        access_log off; \
        return 200 "healthy\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
