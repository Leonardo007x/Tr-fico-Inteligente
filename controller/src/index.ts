import express from "express"
import cors from "cors"
import jwt from "jsonwebtoken"
import axios from "axios"
import http from "http"
import { Server as SocketIOServer } from "socket.io"

const app = express()
const server = http.createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

app.use(cors())
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || "tu_secreto_jwt_aqui"
const PORT = process.env.PORT || 3004
const SCHEDULER_URL = process.env.SCHEDULER_URL || "http://localhost:3003"

interface TrafficLight {
  id: string
  name: string
  location: { lat: number; lng: number }
  currentState: "red" | "amber" | "green"
  lastChanged: Date
  nextChange?: Date
  priority: number
  congestionLevel: "low" | "medium" | "high" | "critical"
  vehicleCount: number
  isOperational: boolean
  maintenanceMode: boolean
  // Nuevas propiedades para ciclos automáticos
  stateDuration: number // Duración actual del estado en ms
  cyclePhase: number // Fase del ciclo: 0=inicio, 1=medio, 2=final
  isAutoCycling: boolean // Si está en ciclo automático
  nextState: "red" | "amber" | "green" // Próximo estado en el ciclo
}

interface ControllerMetrics {
  totalLights: number
  operationalLights: number
  lightsInMaintenance: number
  stateChanges: number
  averageResponseTime: number
  systemUptime: Date
  lastUpdate: Date
  connectedClients: number
}

interface StateChangeLog {
  lightId: string
  fromState: "red" | "amber" | "green"
  toState: "red" | "amber" | "green"
  timestamp: Date
  reason: string
  priority: number
  responseTime: number
}

// Middleware de autenticación JWT
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.sendStatus(401)
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403)
    ;(req as any).user = user
    next()
  })
}

// Obtener token JWT para comunicación con scheduler
const getAuthToken = async (): Promise<string> => {
  try {
    const INGESTOR_URL = process.env.INGESTOR_URL || "http://ingestor:3001"
    const response = await axios.post(`${INGESTOR_URL}/api/auth/token`, {
      username: "controller-service",
    })
    return response.data.token
  } catch (error) {
    console.error("Error obteniendo token:", error)
    throw new Error("No se pudo obtener token de autenticación")
  }
}

// Duración de estados según especificación
const STATE_DURATIONS = {
  red: { min: 15000, max: 20000 },    // 15-20 segundos
  amber: { min: 3000, max: 5000 },    // 3-5 segundos  
  green: { min: 10000, max: 15000 }   // 10-15 segundos
}

// Calcular duración aleatoria para un estado
const getRandomDuration = (state: "red" | "amber" | "green"): number => {
  const duration = STATE_DURATIONS[state]
  return Math.floor(Math.random() * (duration.max - duration.min + 1)) + duration.min
}

// Obtener el siguiente estado en la secuencia
const getNextState = (currentState: "red" | "amber" | "green"): "red" | "amber" | "green" => {
  const sequence: ("red" | "amber" | "green")[] = ["red", "amber", "green"]
  const currentIndex = sequence.indexOf(currentState)
  return sequence[(currentIndex + 1) % sequence.length]
}

// Inicializar semáforos de Popayán
const initializeTrafficLights = (): Map<string, TrafficLight> => {
  const lights = new Map<string, TrafficLight>()

  const intersections = [
    { id: "int_001", name: "Carrera 5 con Calle 5", lat: 2.4448, lng: -76.6147 },
    { id: "int_002", name: "Carrera 6 con Calle 4", lat: 2.4438, lng: -76.6137 },
    { id: "int_003", name: "Carrera 7 con Calle 3", lat: 2.4428, lng: -76.6127 },
    { id: "int_004", name: "Carrera 8 con Calle 2", lat: 2.4418, lng: -76.6117 },
    { id: "int_005", name: "Carrera 9 con Calle 1", lat: 2.4408, lng: -76.6107 },
    { id: "int_006", name: "Avenida Panamericana Norte", lat: 2.4498, lng: -76.6097 },
    { id: "int_007", name: "Carrera 3 con Calle 6", lat: 2.4458, lng: -76.6157 },
    { id: "int_008", name: "Carrera 2 con Calle 8", lat: 2.4468, lng: -76.6167 },
  ]

  intersections.forEach((intersection, index) => {
    // Estados iniciales variados para simular semáforos en diferentes fases
    const initialStates: ("red" | "amber" | "green")[] = ["red", "amber", "green"]
    const initialState = initialStates[index % 3]
    const initialDuration = getRandomDuration(initialState)
    const nextState = getNextState(initialState)
    
    lights.set(intersection.id, {
      id: intersection.id,
      name: intersection.name,
      location: { lat: intersection.lat, lng: intersection.lng },
      currentState: initialState,
      lastChanged: new Date(),
      nextChange: new Date(Date.now() + initialDuration),
      priority: 0,
      congestionLevel: "low",
      vehicleCount: 0,
      isOperational: true,
      maintenanceMode: false,
      // Nuevas propiedades para ciclos automáticos
      stateDuration: initialDuration,
      cyclePhase: 0,
      isAutoCycling: true,
      nextState: nextState,
    })
  })

  return lights
}

// Estado global
const trafficLights = initializeTrafficLights()
const stateChangeLog: StateChangeLog[] = []
const systemStartTime = new Date()

const controllerMetrics: ControllerMetrics = {
  totalLights: trafficLights.size,
  operationalLights: trafficLights.size,
  lightsInMaintenance: 0,
  stateChanges: 0,
  averageResponseTime: 0,
  systemUptime: systemStartTime,
  lastUpdate: new Date(),
  connectedClients: 0,
}

// Obtener datos del scheduler
const getSchedulerData = async () => {
  try {
    const token = await getAuthToken()
    const [scheduleResponse, metricsResponse] = await Promise.all([
      axios.get(`${SCHEDULER_URL}/api/schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${SCHEDULER_URL}/api/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    return {
      schedule: scheduleResponse.data,
      metrics: metricsResponse.data,
    }
  } catch (error) {
    console.error("Error obteniendo datos del scheduler:", error)
    return null
  }
}

// Cambiar estado de semáforo
const changeTrafficLightState = (
  lightId: string,
  newState: "red" | "amber" | "green",
  reason: string,
  priority = 0,
): boolean => {
  const light = trafficLights.get(lightId)
  if (!light || !light.isOperational || light.maintenanceMode) {
    return false
  }

  const startTime = Date.now()
  const oldState = light.currentState

  // Validar transición de estado
  if (!isValidStateTransition(oldState, newState)) {
    console.warn(`Transición inválida para ${lightId}: ${oldState} -> ${newState}`)
    return false
  }

  // Actualizar estado
  light.currentState = newState
  light.lastChanged = new Date()
  light.priority = priority

  // Registrar cambio
  const responseTime = Date.now() - startTime
  const logEntry: StateChangeLog = {
    lightId,
    fromState: oldState,
    toState: newState,
    timestamp: new Date(),
    reason,
    priority,
    responseTime,
  }

  stateChangeLog.push(logEntry)

  // Mantener solo los últimos 1000 registros
  if (stateChangeLog.length > 1000) {
    stateChangeLog.shift()
  }

  // Actualizar métricas
  controllerMetrics.stateChanges++
  controllerMetrics.averageResponseTime =
    (controllerMetrics.averageResponseTime * (controllerMetrics.stateChanges - 1) + responseTime) /
    controllerMetrics.stateChanges

  // Emitir cambio a clientes conectados
  io.emit("trafficLightChanged", {
    lightId,
    oldState,
    newState,
    timestamp: new Date(),
    reason,
    priority,
  })

  console.log(`🚦 ${lightId}: ${oldState} -> ${newState} (${reason})`)
  return true
}

// Validar transiciones de estado válidas
const isValidStateTransition = (fromState: "red" | "amber" | "green", toState: "red" | "amber" | "green"): boolean => {
  // Secuencia correcta: rojo -> naranja -> verde -> rojo -> naranja -> verde
  const validTransitions: Record<string, string[]> = {
    "red": ["amber"],        // Rojo solo puede ir a naranja (amber)
    "amber": ["green"],      // Naranja solo puede ir a verde
    "green": ["red"]         // Verde solo puede ir a rojo
  }
  
  return validTransitions[fromState]?.includes(toState) || false
}

// Procesar ciclos automáticos de semáforos
const processAutoCycling = () => {
  const now = new Date()
  
  trafficLights.forEach((light) => {
    // Solo procesar semáforos operacionales en ciclo automático
    if (!light.isOperational || light.maintenanceMode || !light.isAutoCycling) {
      return
    }

    // Verificar si es tiempo de cambiar de estado
    if (light.nextChange && now >= light.nextChange) {
      const nextState = light.nextState
      const success = changeTrafficLightState(
        light.id,
        nextState,
        `Ciclo automático (${light.currentState} → ${nextState})`,
        0
      )

      if (success) {
        // Calcular nueva duración y próximo estado para el NUEVO estado
        const newDuration = getRandomDuration(nextState)
        const newNextState = getNextState(nextState)
        
        // Actualizar propiedades del ciclo
        light.stateDuration = newDuration
        light.nextChange = new Date(now.getTime() + newDuration)
        light.nextState = newNextState
        light.cyclePhase = (light.cyclePhase + 1) % 3
        
        console.log(`🔄 ${light.id}: ${light.currentState} (Duración: ${newDuration}ms, Próximo: ${newNextState})`)
      }
    }
  })
}

// Procesar decisiones del scheduler
const processSchedulerDecisions = async () => {
  try {
    const schedulerData = await getSchedulerData()
    if (!schedulerData) return

    const { schedule, metrics } = schedulerData

    // Actualizar estados basado en las decisiones del scheduler
    if (schedule.result && schedule.result.scheduledTasks) {
      for (const task of schedule.result.scheduledTasks.slice(0, 3)) {
        // Procesar las 3 tareas más prioritarias
        const light = trafficLights.get(task.intersectionId)
        if (light && task.requestedState !== light.currentState) {
          const success = changeTrafficLightState(
            task.intersectionId,
            task.requestedState,
            `EDF Scheduler (Prioridad: ${task.priority})`,
            task.priority,
          )

          if (success) {
            light.congestionLevel = task.congestionLevel
            light.priority = task.priority
            
            // Si el scheduler cambia el estado, recalcular ciclo automático
            if (light.isAutoCycling) {
              const newDuration = getRandomDuration(task.requestedState)
              const newNextState = getNextState(task.requestedState)
              
              light.stateDuration = newDuration
              light.nextChange = new Date(Date.now() + newDuration)
              light.nextState = newNextState
            }
          }
        }
      }
    }

    // Actualizar métricas del controlador
    controllerMetrics.lastUpdate = new Date()
  } catch (error) {
    console.error("Error procesando decisiones del scheduler:", error)
  }
}

// Simular mantenimiento aleatorio
const simulateMaintenanceEvents = () => {
  const lights = Array.from(trafficLights.values())

  lights.forEach((light) => {
    // 0.1% probabilidad de entrar en mantenimiento
    if (Math.random() < 0.001 && !light.maintenanceMode) {
      light.maintenanceMode = true
      light.isOperational = false
      controllerMetrics.lightsInMaintenance++
      controllerMetrics.operationalLights--

      console.log(`🔧 ${light.id} entró en modo mantenimiento`)

      io.emit("maintenanceAlert", {
        lightId: light.id,
        name: light.name,
        status: "maintenance_start",
        timestamp: new Date(),
      })

      // Salir de mantenimiento después de 30-120 segundos
      setTimeout(
        () => {
          light.maintenanceMode = false
          light.isOperational = true
          controllerMetrics.lightsInMaintenance--
          controllerMetrics.operationalLights++

          console.log(`✅ ${light.id} salió del modo mantenimiento`)

          io.emit("maintenanceAlert", {
            lightId: light.id,
            name: light.name,
            status: "maintenance_end",
            timestamp: new Date(),
          })
        },
        30000 + Math.random() * 90000,
      )
    }
  })
}

// Endpoints de la API
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", service: "Traffic Controller", timestamp: new Date() })
})

app.get("/api/traffic-lights", (req, res) => {
  const lightsArray = Array.from(trafficLights.values()).map((light) => ({
    ...light,
    uptime: Date.now() - systemStartTime.getTime(),
  }))

  res.json({
    timestamp: new Date(),
    lights: lightsArray,
    metrics: controllerMetrics,
  })
})

app.get("/api/traffic-lights/:id", authenticateToken, (req, res) => {
  const { id } = req.params
  const light = trafficLights.get(id)

  if (!light) {
    return res.status(404).json({ error: "Semáforo no encontrado" })
  }

  const recentLogs = stateChangeLog.filter((log) => log.lightId === id).slice(-10)

  res.json({
    light,
    recentChanges: recentLogs,
    uptime: Date.now() - systemStartTime.getTime(),
  })
})

app.post("/api/traffic-lights/:id/state", authenticateToken, (req, res) => {
  const { id } = req.params
  const { state, reason } = req.body

  if (!["red", "amber", "green"].includes(state)) {
    return res.status(400).json({ error: "Estado inválido" })
  }

  const success = changeTrafficLightState(id, state, reason || "Manual override", 100)

  if (success) {
    res.json({
      message: "Estado cambiado exitosamente",
      lightId: id,
      newState: state,
      timestamp: new Date(),
    })
  } else {
    res.status(400).json({ error: "No se pudo cambiar el estado" })
  }
})

app.get("/api/metrics", authenticateToken, (req, res) => {
  const uptime = Date.now() - systemStartTime.getTime()

  res.json({
    timestamp: new Date(),
    metrics: {
      ...controllerMetrics,
      systemUptimeMs: uptime,
      systemUptimeFormatted: formatUptime(uptime),
    },
    recentChanges: stateChangeLog.slice(-20),
  })
})

app.get("/api/logs", authenticateToken, (req, res) => {
  const { limit = 50, lightId } = req.query

  let logs = stateChangeLog
  if (lightId) {
    logs = logs.filter((log) => log.lightId === lightId)
  }

  res.json({
    timestamp: new Date(),
    logs: logs.slice(-Number(limit)),
    totalLogs: logs.length,
  })
})

app.post("/api/emergency-override", authenticateToken, (req, res) => {
  const { lightId, state, duration = 60 } = req.body

  if (!lightId || !state) {
    return res.status(400).json({ error: "lightId y state son requeridos" })
  }

  const success = changeTrafficLightState(lightId, state, "Emergency Override", 999)

  if (success) {
    // Revertir después del tiempo especificado
    setTimeout(() => {
      changeTrafficLightState(lightId, "red", "Emergency Override Expired", 0)
    }, duration * 1000)

    res.json({
      message: "Override de emergencia activado",
      lightId,
      state,
      duration,
      timestamp: new Date(),
    })
  } else {
    res.status(400).json({ error: "No se pudo activar override de emergencia" })
  }
})

app.post("/api/traffic-lights/:id/auto-cycle", authenticateToken, (req, res) => {
  const { id } = req.params
  const { enabled } = req.body
  
  const light = trafficLights.get(id)
  if (!light) {
    return res.status(404).json({ error: "Semáforo no encontrado" })
  }

  light.isAutoCycling = enabled !== false
  
  if (light.isAutoCycling) {
    // Reiniciar ciclo automático
    const newDuration = getRandomDuration(light.currentState)
    const newNextState = getNextState(light.currentState)
    
    light.stateDuration = newDuration
    light.nextChange = new Date(Date.now() + newDuration)
    light.nextState = newNextState
    
    res.json({
      message: "Ciclo automático habilitado",
      lightId: id,
      currentState: light.currentState,
      nextState: light.nextState,
      nextChange: light.nextChange,
      timestamp: new Date(),
    })
  } else {
    light.nextChange = undefined
    res.json({
      message: "Ciclo automático deshabilitado",
      lightId: id,
      currentState: light.currentState,
      timestamp: new Date(),
    })
  }
})

// Formatear tiempo de actividad
const formatUptime = (uptimeMs: number): string => {
  const seconds = Math.floor(uptimeMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

// Socket.IO para comunicación en tiempo real
io.on("connection", (socket) => {
  controllerMetrics.connectedClients++
  console.log(`🔌 Cliente conectado: ${socket.id} (Total: ${controllerMetrics.connectedClients})`)

  // Enviar estado inicial
  socket.emit("initialState", {
    lights: Array.from(trafficLights.values()),
    metrics: controllerMetrics,
    timestamp: new Date(),
  })

  // Manejar solicitudes de estado
  socket.on("requestState", () => {
    socket.emit("stateUpdate", {
      lights: Array.from(trafficLights.values()),
      metrics: controllerMetrics,
      timestamp: new Date(),
    })
  })

  // Manejar desconexión
  socket.on("disconnect", () => {
    controllerMetrics.connectedClients--
    console.log(`🔌 Cliente desconectado: ${socket.id} (Total: ${controllerMetrics.connectedClients})`)
  })
})

// Procesar ciclos automáticos cada 100ms para mayor precisión
setInterval(() => {
  processAutoCycling()
}, 100)

// Procesar decisiones del scheduler cada 2 segundos
setInterval(async () => {
  await processSchedulerDecisions()
}, 2000)

// Simular eventos de mantenimiento cada 30 segundos
setInterval(() => {
  simulateMaintenanceEvents()
}, 30000)

// Enviar actualizaciones periódicas a clientes conectados cada 1 segundo (ACELERADO PARA DEMO)
setInterval(() => {
  io.emit("stateUpdate", {
    lights: Array.from(trafficLights.values()),
    metrics: controllerMetrics,
    timestamp: new Date(),
  })
}, 2000)

// Manejo de errores
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", error)
  res.status(500).json({ error: "Error interno del servidor" })
})

server.listen(PORT, () => {
  console.log(`🎮 Controlador de Tráfico ejecutándose en puerto ${PORT}`)
  console.log(`🔗 Conectado al Scheduler: ${SCHEDULER_URL}`)
  console.log(`🚦 Controlando ${trafficLights.size} semáforos en Popayán`)
  console.log(`🔒 JWT Secret configurado: ${JWT_SECRET ? "Sí" : "No"}`)

  // Inicialización
  setTimeout(async () => {
    try {
      await processSchedulerDecisions()
      console.log("✅ Controlador inicializado correctamente")
    } catch (error) {
      console.error("❌ Error en inicialización del controlador:", error)
    }
  }, 2000)
})
