# Pruebas de Seguridad - Sistema de Control de Tráfico

Este directorio contiene scripts automatizados para simular ataques y verificar las respuestas de seguridad del sistema.

## 🚀 Inicio Rápido

### 1. Preparar el Sistema
```bash
# Levantar todos los servicios
docker-compose up -d

# Esperar 30 segundos para que se inicialicen
sleep 30
```

### 2. Ejecutar Todas las Pruebas
```bash
cd tests
./run-security-tests.sh
```

## 🧪 Tipos de Pruebas

### 1. Autenticación JWT
- ✅ Acceso sin token (debe devolver 401)
- ✅ Token inválido (debe devolver 403)  
- ✅ Token válido (debe devolver 200)

### 2. Rate Limiting
- ✅ 20 requests rápidos al endpoint de autenticación
- ✅ Verificar que algunos requests sean limitados (429)
- ✅ Medir tiempo de respuesta

### 3. Inyección SQL
- ✅ Payloads maliciosos en parámetros URL
- ✅ Payloads maliciosos en body de requests
- ✅ Verificar que no se ejecuten comandos SQL

### 4. Estrés WebSocket
- ✅ 50 conexiones simultáneas
- ✅ Medir mensajes recibidos vs errores
- ✅ Verificar tasa de éxito > 90%

### 5. Health Checks
- ✅ Verificar que todos los servicios respondan
- ✅ Validar endpoints de salud

## 📋 Uso Detallado

### Ejecutar Pruebas Específicas
```bash
# Solo autenticación
./run-security-tests.sh auth

# Solo rate limiting
./run-security-tests.sh rate

# Solo inyección SQL
./run-security-tests.sh injection

# Solo estrés WebSocket
./run-security-tests.sh websocket

# Solo health checks
./run-security-tests.sh health
```

### Usar Node.js Directamente
```bash
# Instalar dependencias
npm install

# Ejecutar todas las pruebas
npm test

# Ejecutar prueba específica
npm run test:auth
npm run test:rate
npm run test:injection
npm run test:websocket
npm run test:health
```

## 📊 Interpretación de Resultados

### Códigos de Salida
- `0`: Todas las pruebas pasaron
- `1`: Una o más pruebas fallaron

### Métricas Esperadas
- **Autenticación**: 100% de endpoints protegidos
- **Rate Limiting**: Algunos requests limitados (429)
- **Inyección SQL**: 100% de payloads bloqueados
- **WebSocket**: >90% tasa de éxito con 50 conexiones
- **Health Checks**: 100% de servicios disponibles

## 🔧 Configuración

### Variables de Entorno
```bash
# URLs de los servicios (por defecto localhost)
export INGESTOR_URL=http://localhost:3001
export ANALYZER_URL=http://localhost:3002
export SCHEDULER_URL=http://localhost:3003
export CONTROLLER_URL=http://localhost:3004
```

### Personalizar Pruebas
Edita `security-tests.js` para:
- Cambiar número de conexiones WebSocket
- Modificar payloads de inyección SQL
- Ajustar límites de rate limiting
- Personalizar timeouts

## 🐛 Solución de Problemas

### Error: "Docker no está ejecutándose"
```bash
# Iniciar Docker Desktop
# En Windows: Abrir Docker Desktop
# En Linux: sudo systemctl start docker
```

### Error: "Servicios no disponibles"
```bash
# Verificar que los servicios estén ejecutándose
docker-compose ps

# Reiniciar servicios
docker-compose down
docker-compose up -d

# Esperar inicialización
sleep 30
```

### Error: "Dependencias no encontradas"
```bash
cd tests
npm install
```

### Error: "Permisos denegados" (Linux/Mac)
```bash
chmod +x run-security-tests.sh
```

## 📈 Reportes

### Logs Detallados
Los scripts generan logs con:
- ✅ Pruebas exitosas (verde)
- ❌ Pruebas fallidas (rojo)
- 📊 Métricas de rendimiento
- ⏱️ Tiempos de ejecución

### Ejemplo de Salida
```
🚀 INICIANDO PRUEBAS DE SEGURIDAD
=====================================

🔐 PRUEBA 1: Autenticación JWT
✅ Test 1.1 PASÓ: Acceso denegado sin token (401)
✅ Test 1.2 PASÓ: Acceso denegado con token inválido (403)
✅ Test 1.3 PASÓ: Acceso permitido con token válido (200)

⚡ PRUEBA 2: Rate Limiting
📊 Resultados Rate Limiting:
   - Requests exitosos: 5
   - Requests limitados (429): 15
   - Otros errores: 0
   - Tiempo total: 1250.50ms
✅ Test 2 PASÓ: Rate limiting funcionando correctamente

📋 RESUMEN DE PRUEBAS
====================
✅ Pruebas exitosas: 5
❌ Pruebas fallidas: 0
📊 Total de pruebas: 5
⏱️  Tiempo total: 15.23 segundos
🎯 Tasa de éxito: 100.0%

🎉 ¡TODAS LAS PRUEBAS DE SEGURIDAD PASARON!
```

## 🔒 Seguridad

### Consideraciones Importantes
- ⚠️ Estas pruebas simulan ataques reales
- 🔒 Solo ejecutar en entornos de desarrollo/pruebas
- 🚫 NO ejecutar en sistemas de producción
- 📝 Revisar logs de seguridad después de las pruebas

### Limpieza Post-Pruebas
```bash
# Detener servicios
docker-compose down

# Limpiar logs si es necesario
docker system prune -f
```

## 📚 Referencias

- [Documentación de Seguridad](../docs/seguridad.md)
- [Guía de Pruebas](../docs/pruebas.md)
- [Arquitectura del Sistema](../docs/arquitectura.md)
