# Dockerfile optimizado para Controlador de Semáforos
FROM node:18-alpine

# Metadata profesional
LABEL maintainer="Sistema Control Tráfico Popayán <dev@traffic-popayan.gov.co>"
LABEL version="1.0.0"
LABEL description="Controlador de Semáforos en Tiempo Real"

# Crear usuario no-root
RUN addgroup -g 1001 -S trafficgroup && \
    adduser -S trafficuser -u 1001 -G trafficgroup

# Dependencias del sistema
RUN apk add --no-cache curl tzdata && \
    rm -rf /var/cache/apk/*

# Zona horaria Colombia
ENV TZ=America/Bogota
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# Optimización de cache
COPY --chown=trafficuser:trafficgroup package*.json ./
RUN npm install && npm cache clean --force

COPY --chown=trafficuser:trafficgroup . .
RUN npm run build

# Limpiar dependencias de desarrollo después del build
RUN npm prune --omit=dev

USER trafficuser

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3004

EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3004/api/health || exit 1

CMD ["node", "dist/index.js"]
