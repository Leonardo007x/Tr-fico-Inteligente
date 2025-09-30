# Configuración de Seguridad del Sistema

## Visión General de Seguridad

El Sistema de Control de Tráfico Inteligente implementa múltiples capas de seguridad para proteger la comunicación entre microservicios y prevenir accesos no autorizados.

## Autenticación JWT

### Implementación

Todos los microservicios utilizan JSON Web Tokens (JWT) para autenticación:

\`\`\`typescript
// Generación de token
const token = jwt.sign(
  { username: 'service-name' }, 
  JWT_SECRET, 
  { expiresIn: '24h' }
);

// Verificación de token
jwt.verify(token, JWT_SECRET, (err, user) => {
  if (err) return res.sendStatus(403);
  req.user = user;
  next();
});
\`\`\`

### Configuración de Tokens

- **Algoritmo**: HS256 (HMAC SHA-256)
- **Expiración**: 24 horas
- **Secret**: Variable de entorno `JWT_SECRET`
- **Renovación**: Automática antes de expiración

### Endpoints Protegidos

Todos los endpoints de API requieren autenticación JWT excepto:
- `/api/health` - Health checks
- `/api/auth/token` - Generación de tokens
- `/api/intersections` - Información pública de intersecciones

## Variables de Entorno

### Configuración Requerida

\`\`\`bash
# JWT Secret (OBLIGATORIO - cambiar en producción)
JWT_SECRET=tu_secreto_jwt_super_seguro_aqui_2024

# URLs de servicios (para Docker Compose)
INGESTOR_URL=http://ingestor:3001
ANALYZER_URL=http://analyzer:3002
SCHEDULER_URL=http://scheduler:3003
CONTROLLER_URL=http://controller:3004

# Configuración de entorno
NODE_ENV=production
\`\`\`

### Generación de JWT Secret Seguro

\`\`\`bash
# Generar secret aleatorio de 256 bits
openssl rand -base64 32

# O usando Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
\`\`\`

## Configuración de AppArmor (Linux)

### Instalación de AppArmor

\`\`\`bash
# Ubuntu/Debian
sudo apt update
sudo apt install apparmor-utils apparmor-profiles

# Verificar estado
sudo systemctl status apparmor
\`\`\`

### Perfil AppArmor para Node.js

Crear archivo `/etc/apparmor.d/usr.bin.node`:

\`\`\`bash
#include <tunables/global>

/usr/bin/node {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  #include <abstractions/user-tmp>

  # Permitir ejecución de Node.js
  /usr/bin/node mr,
  
  # Permitir acceso a librerías del sistema
  /lib/x86_64-linux-gnu/** mr,
  /usr/lib/x86_64-linux-gnu/** mr,
  
  # Permitir acceso a archivos de la aplicación
  /app/** r,
  /app/dist/** r,
  /app/node_modules/** r,
  
  # Permitir escritura en logs
  /app/logs/** rw,
  
  # Permitir acceso a /tmp para operaciones temporales
  /tmp/** rw,
  
  # Permitir conexiones de red
  network inet tcp,
  network inet udp,
  
  # Permitir acceso a /proc para métricas del sistema
  @{PROC}/sys/kernel/random/uuid r,
  @{PROC}/meminfo r,
  @{PROC}/stat r,
  
  # Denegar acceso a archivos sensibles del sistema
  deny /etc/shadow r,
  deny /etc/passwd w,
  deny /root/** rw,
  deny /home/*/.ssh/** rw,
  
  # Denegar ejecución de comandos del sistema
  deny /bin/** x,
  deny /sbin/** x,
  deny /usr/bin/** x,
  deny /usr/sbin/** x,
  
  # Permitir solo node
  /usr/bin/node ix,
}
\`\`\`

### Perfil Específico para Servicios de Tráfico

Crear archivo `/etc/apparmor.d/traffic-control-service`:

\`\`\`bash
#include <tunables/global>

profile traffic-control-service /usr/bin/node {
  #include <abstractions/base>
  #include <abstractions/nameservice>

  # Ejecutables permitidos
  /usr/bin/node mr,
  
  # Archivos de la aplicación
  /app/** r,
  /app/dist/** r,
  /app/node_modules/** mr,
  
  # Configuración y logs
  /app/.env r,
  /app/logs/** rw,
  
  # Archivos temporales
  /tmp/traffic-control-** rw,
  
  # Red - solo puertos específicos
  network inet tcp,
  network inet udp,
  
  # Procesos del sistema (solo lectura)
  @{PROC}/sys/kernel/random/uuid r,
  @{PROC}/meminfo r,
  @{PROC}/loadavg r,
  @{PROC}/uptime r,
  
  # Denegar acceso a archivos críticos
  deny /etc/shadow rw,
  deny /etc/passwd w,
  deny /etc/sudoers rw,
  deny /root/** rw,
  deny /home/*/.ssh/** rw,
  deny /var/log/auth.log rw,
  
  # Denegar ejecución de comandos peligrosos
  deny /bin/sh x,
  deny /bin/bash x,
  deny /usr/bin/sudo x,
  deny /usr/bin/su x,
  
  # Denegar acceso a dispositivos
  deny /dev/sd* rw,
  deny /dev/hd* rw,
  deny /sys/class/net/*/address r,
}
\`\`\`

### Activación de Perfiles AppArmor

\`\`\`bash
# Cargar perfil en modo complain (testing)
sudo apparmor_parser -r -W /etc/apparmor.d/traffic-control-service

# Verificar estado del perfil
sudo apparmor_status | grep traffic-control

# Cambiar a modo enforce (producción)
sudo aa-enforce /etc/apparmor.d/traffic-control-service

# Ver logs de AppArmor
sudo dmesg | grep apparmor
sudo journalctl -f | grep apparmor
\`\`\`

## Configuración de Firewall

### UFW (Ubuntu Firewall)

\`\`\`bash
# Habilitar UFW
sudo ufw enable

# Permitir solo puertos necesarios
sudo ufw allow 3000/tcp  # UI
sudo ufw allow 3001/tcp  # Ingestor
sudo ufw allow 3002/tcp  # Analyzer
sudo ufw allow 3003/tcp  # Scheduler
sudo ufw allow 3004/tcp  # Controller

# Permitir SSH (cambiar puerto si es necesario)
sudo ufw allow 22/tcp

# Denegar todo lo demás
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Ver estado
sudo ufw status verbose
\`\`\`

### iptables (Alternativa)

\`\`\`bash
#!/bin/bash
# Script de configuración de iptables

# Limpiar reglas existentes
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X

# Política por defecto
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Permitir loopback
iptables -A INPUT -i lo -j ACCEPT

# Permitir conexiones establecidas
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Permitir puertos de la aplicación
iptables -A INPUT -p tcp --dport 3000 -j ACCEPT  # UI
iptables -A INPUT -p tcp --dport 3001 -j ACCEPT  # Ingestor
iptables -A INPUT -p tcp --dport 3002 -j ACCEPT  # Analyzer
iptables -A INPUT -p tcp --dport 3003 -j ACCEPT  # Scheduler
iptables -A INPUT -p tcp --dport 3004 -j ACCEPT  # Controller

# Permitir SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Guardar reglas
iptables-save > /etc/iptables/rules.v4
\`\`\`

## Configuración Docker Segura

### Dockerfile Seguro

\`\`\`dockerfile
FROM node:18-alpine

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S traffic -u 1001

# Configurar directorio de trabajo
WORKDIR /app

# Copiar archivos con permisos correctos
COPY --chown=traffic:nodejs package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --chown=traffic:nodejs . .
RUN npm run build

# Cambiar a usuario no-root
USER traffic

# Exponer puerto
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["npm", "start"]
\`\`\`

### Docker Compose Seguro

\`\`\`yaml
version: '3.8'

services:
  ingestor:
    build: ./ingestor
    container_name: traffic-ingestor
    restart: unless-stopped
    
    # Configuración de seguridad
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
    
    # Límites de recursos
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    
    # Variables de entorno desde archivo
    env_file:
      - .env.production
    
    # Red interna
    networks:
      - traffic-network
    
    # Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  traffic-network:
    driver: bridge
    internal: false  # Cambiar a true para red completamente interna
    ipam:
      config:
        - subnet: 172.20.0.0/16
\`\`\`

## Monitoreo de Seguridad

### Logs de Seguridad

\`\`\`typescript
// Logger de seguridad
const securityLogger = {
  logAuthAttempt: (ip: string, success: boolean, username?: string) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'auth_attempt',
      ip,
      success,
      username,
      severity: success ? 'info' : 'warning'
    }));
  },
  
  logSuspiciousActivity: (ip: string, activity: string) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'suspicious_activity',
      ip,
      activity,
      severity: 'critical'
    }));
  }
};
\`\`\`

### Rate Limiting

\`\`\`typescript
import rateLimit from 'express-rate-limit';

// Rate limiting para APIs
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: 'Demasiadas solicitudes, intente más tarde',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting más estricto para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // máximo 5 intentos de login por ventana
  skipSuccessfulRequests: true,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
\`\`\`

## Checklist de Seguridad

### Antes del Despliegue

- [ ] JWT_SECRET configurado con valor seguro (32+ caracteres)
- [ ] Variables de entorno configuradas correctamente
- [ ] Perfiles AppArmor creados y activados
- [ ] Firewall configurado (solo puertos necesarios)
- [ ] Contenedores ejecutándose como usuario no-root
- [ ] Health checks configurados
- [ ] Rate limiting implementado
- [ ] Logs de seguridad funcionando

### Mantenimiento Regular

- [ ] Rotar JWT secrets cada 90 días
- [ ] Revisar logs de seguridad semanalmente
- [ ] Actualizar dependencias mensualmente
- [ ] Verificar perfiles AppArmor
- [ ] Monitorear métricas de seguridad
- [ ] Backup de configuraciones

### Respuesta a Incidentes

1. **Detectar**: Monitoreo automático de logs
2. **Contener**: Aislar servicios comprometidos
3. **Erradicar**: Eliminar amenazas identificadas
4. **Recuperar**: Restaurar servicios seguros
5. **Aprender**: Actualizar medidas preventivas

## Contacto de Seguridad

Para reportar vulnerabilidades de seguridad:
- Email: security@traffic-control.local
- Tiempo de respuesta: 24 horas
- Divulgación responsable requerida
