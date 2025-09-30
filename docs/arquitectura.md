# Arquitectura del Sistema de Control de Tráfico Inteligente

## Visión General

El Sistema de Control de Tráfico Inteligente de Popayán utiliza una arquitectura de microservicios distribuida que implementa el algoritmo EDF (Earliest Deadline First) para optimizar el flujo vehicular en tiempo real.

## Diagrama de Arquitectura

\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI (Frontend) │    │   Ingestor      │    │   Analyzer      │
│   Port: 3000    │◄──►│   Port: 3001    │◄──►│   Port: 3002    │
│                 │    │                 │    │                 │
│ - Leaflet Map   │    │ - Data Gen      │    │ - Density Calc  │
│ - Real-time UI  │    │ - WebSocket     │    │ - Congestion    │
│ - Socket.IO     │    │ - JWT Auth      │    │ - Trends        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Controller    │    │   Scheduler     │    │   Docker        │
│   Port: 3004    │◄──►│   Port: 3003    │    │   Network       │
│                 │    │                 │    │                 │
│ - State Mgmt    │    │ - EDF Algorithm │    │ - Service Mesh  │
│ - Socket.IO     │    │ - Task Queue    │    │ - Load Balance  │
│ - Emergency     │    │ - Priorities    │    │ - Health Check  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
\`\`\`

## Componentes del Sistema

### 1. Ingestor de Datos (Puerto 3001)

**Responsabilidades:**
- Generar datos simulados de tráfico vehicular
- Simular patrones de tráfico realistas (horas pico, eventos especiales)
- Exponer API REST para consulta de datos
- Proporcionar WebSocket para datos en tiempo real
- Autenticación JWT para servicios

**Tecnologías:**
- Node.js + TypeScript
- Express.js
- WebSocket (ws)
- JWT para autenticación

**Endpoints Principales:**
- `GET /api/traffic-data` - Datos actuales de tráfico
- `GET /api/intersections` - Lista de intersecciones
- `POST /api/simulate-peak` - Simular hora pico
- `WebSocket /ws` - Datos en tiempo real

### 2. Analizador de Tráfico (Puerto 3002)

**Responsabilidades:**
- Procesar datos del ingestor
- Calcular densidad de tráfico por intersección
- Determinar niveles de congestión (bajo, medio, alto, crítico)
- Analizar tendencias históricas
- Generar recomendaciones inteligentes

**Algoritmos Implementados:**
- Cálculo de densidad vehicular
- Análisis de tendencias temporales
- Clasificación de congestión
- Estimación de tiempos de espera

**Métricas Calculadas:**
- Densidad actual vs promedio histórico
- Nivel de congestión (low/medium/high/critical)
- Prioridad basada en múltiples factores
- Tiempo estimado de espera

### 3. Scheduler EDF (Puerto 3003)

**Responsabilidades:**
- Implementar algoritmo Earliest Deadline First
- Gestionar cola de tareas de semáforos
- Calcular deadlines basados en prioridad y congestión
- Optimizar flujo vehicular global

**Algoritmo EDF:**
\`\`\`typescript
// Pseudocódigo del algoritmo EDF
function scheduleEDF(tasks: Task[]): Task[] {
  return tasks
    .filter(task => !task.completed && task.deadline > now())
    .sort((a, b) => {
      // 1. Tareas urgentes primero
      if (a.urgent && !b.urgent) return -1;
      
      // 2. Deadline más cercano (EDF core)
      if (a.deadline !== b.deadline) 
        return a.deadline - b.deadline;
      
      // 3. Mayor prioridad de tráfico
      return b.priority - a.priority;
    });
}
\`\`\`

**Cálculo de Deadlines:**
- Crítico: 10 segundos
- Alto: 20 segundos  
- Medio: 40 segundos
- Bajo: 80 segundos

### 4. Controlador de Semáforos (Puerto 3004)

**Responsabilidades:**
- Ejecutar decisiones del scheduler
- Mantener estado actual de semáforos
- Comunicación en tiempo real con UI
- Gestionar eventos de mantenimiento
- Proporcionar overrides de emergencia

**Estados de Semáforo:**
- `red` - Detenido
- `amber` - Precaución  
- `green` - Paso libre
- `maintenance` - Fuera de servicio

### 5. Interfaz de Usuario (Puerto 3000)

**Responsabilidades:**
- Visualizar mapa interactivo de Popayán
- Mostrar estados de semáforos en tiempo real
- Panel de métricas y estadísticas
- Cola de prioridades EDF
- Registro de actividad del sistema

**Tecnologías:**
- HTML5, CSS3, JavaScript (Vanilla)
- Leaflet.js para mapas
- Socket.IO para tiempo real
- OpenStreetMap como base cartográfica

## Flujo de Datos

### Flujo Principal (Cada 5 segundos):

1. **Ingestor** genera datos de tráfico simulados
2. **Analyzer** procesa datos y calcula métricas
3. **Scheduler** aplica algoritmo EDF y genera tareas
4. **Controller** ejecuta cambios de estado de semáforos
5. **UI** recibe actualizaciones vía Socket.IO

### Flujo de Comunicación:

\`\`\`
Ingestor → Analyzer → Scheduler → Controller → UI
   ↑                                            ↓
   └────────── WebSocket Updates ←──────────────┘
\`\`\`

## Patrones de Diseño Implementados

### 1. Microservicios
- Separación de responsabilidades
- Escalabilidad independiente
- Tolerancia a fallos

### 2. Event-Driven Architecture
- WebSocket para eventos en tiempo real
- Socket.IO para comunicación bidireccional
- Pub/Sub pattern para actualizaciones

### 3. Circuit Breaker
- Manejo de fallos entre servicios
- Timeouts y reintentos automáticos
- Degradación elegante

### 4. Observer Pattern
- UI se suscribe a cambios de estado
- Notificaciones automáticas
- Desacoplamiento de componentes

## Escalabilidad y Rendimiento

### Optimizaciones Implementadas:

1. **Cache de Análisis** (10 segundos TTL)
2. **Conexiones WebSocket persistentes**
3. **Procesamiento asíncrono**
4. **Límites de historial** (últimos 100 registros)
5. **Compresión de datos** en APIs

### Métricas de Rendimiento:

- **Latencia promedio**: < 100ms entre servicios
- **Throughput**: 1000+ requests/segundo por servicio
- **Tiempo de respuesta UI**: < 2 segundos
- **Actualización en tiempo real**: < 500ms

## Tolerancia a Fallos

### Estrategias Implementadas:

1. **Health Checks** en todos los servicios
2. **Reintentos automáticos** con backoff exponencial
3. **Timeouts configurables**
4. **Modo degradado** cuando servicios no están disponibles
5. **Logs estructurados** para debugging

### Recuperación ante Fallos:

- **Ingestor down**: UI muestra datos cached
- **Analyzer down**: Scheduler usa última configuración
- **Scheduler down**: Controller mantiene estados actuales
- **Controller down**: UI muestra estado de desconexión

## Monitoreo y Observabilidad

### Métricas Clave:

- Tiempo de respuesta por servicio
- Tasa de éxito de requests
- Uso de memoria y CPU
- Conexiones WebSocket activas
- Deadlines cumplidos vs perdidos

### Logs Estructurados:

\`\`\`json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "scheduler",
  "level": "info",
  "message": "EDF task executed",
  "metadata": {
    "intersectionId": "int_001",
    "priority": 85,
    "deadline": "2024-01-15T10:30:10Z",
    "responseTime": 45
  }
}
\`\`\`

## Seguridad

Ver [docs/seguridad.md](./seguridad.md) para detalles completos de seguridad.

## Pruebas

Ver [docs/pruebas.md](./pruebas.md) para guías de testing y validación.
