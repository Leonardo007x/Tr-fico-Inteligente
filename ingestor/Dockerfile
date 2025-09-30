# Dockerfile optimizado para Ingestor de Tráfico
# Usa imagen Alpine para menor tamaño y mejor seguridad
FROM node:18-alpine

# Metadata para identificación profesional
LABEL maintainer="Sistema Control Tráfico Popayán <dev@traffic-popayan.gov.co>"
LABEL version="1.0.0"
LABEL description="Servicio Ingestor de Datos de Tráfico Vehicular"

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S trafficgroup && \
    adduser -S trafficuser -u 1001 -G trafficgroup

# Instalar dependencias del sistema y limpiar cache
RUN apk add --no-cache curl tzdata && \
    rm -rf /var/cache/apk/*

# Configurar zona horaria para Colombia
ENV TZ=America/Bogota
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Configurar directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (mejor cache)
COPY --chown=trafficuser:trafficgroup package*.json ./

# Instalar todas las dependencias (incluyendo dev para build)
RUN npm install && \
    npm cache clean --force

# Copiar código fuente
COPY --chown=trafficuser:trafficgroup . .

# Compilar aplicación TypeScript
RUN npm run build

# Limpiar dependencias de desarrollo después del build
RUN npm prune --omit=dev

# Cambiar a usuario no-root
USER trafficuser

# Configurar variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001

# Exponer puerto
EXPOSE 3001

# Health check mejorado
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Comando de inicio con manejo de señales
CMD ["node", "dist/index.js"]
