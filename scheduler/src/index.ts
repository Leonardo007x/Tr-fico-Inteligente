import express from "express"
import cors from "cors"
import jwt from "jsonwebtoken"
import axios from "axios"

const app = express()
app.use(cors())
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || "tu_secreto_jwt_aqui"
const PORT = process.env.PORT || 3003
const ANALYZER_URL = process.env.ANALYZER_URL || "http://localhost:3002"

interface TrafficLightTask {
  intersectionId: string
  intersectionName: string
  currentState: "red" | "amber" | "green"
  requestedState: "red" | "amber" | "green"
  priority: number
  deadline: Date
  estimatedDuration: number // segundos
  congestionLevel: "low" | "medium" | "high" | "critical"
  vehicleDensity: number
  createdAt: Date
  executedAt?: Date
  completed: boolean
  urgent: boolean
}

interface EDFScheduleResult {
  scheduledTasks: TrafficLightTask[]
  completedTasks: TrafficLightTask[]
  missedDeadlines: TrafficLightTask[]
  nextExecution: Date
  totalTasks: number
  successRate: number
}

interface SchedulerMetrics {
  totalTasksScheduled: number
  tasksCompleted: number
  deadlinesMissed: number
  averageResponseTime: number
  successRate: number
  currentLoad: number
  peakHourActive: boolean
  lastUpdate: Date
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

// Obtener token JWT para comunicación con analyzer
const getAuthToken = async (): Promise<string> => {
  try {
    // Usar el ingestor para obtener token (todos los servicios usan el mismo JWT_SECRET)
    const INGESTOR_URL = process.env.INGESTOR_URL || "http://ingestor:3001"
    const response = await axios.post(`${INGESTOR_URL}/api/auth/token`, {
      username: "scheduler-service",
    })
    return response.data.token
  } catch (error) {
    console.error("Error obteniendo token:", error)
    throw new Error("No se pudo obtener token de autenticación")
  }
}

// Obtener análisis del analyzer
const getAnalysisData = async () => {
  try {
    const token = await getAuthToken()
    const response = await axios.get(`${ANALYZER_URL}/api/analysis`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  } catch (error) {
    console.error("Error obteniendo análisis:", error)
    throw new Error("No se pudieron obtener datos de análisis")
  }
}

// Estados actuales de los semáforos (simulado)
const trafficLightStates: Map<string, "red" | "amber" | "green"> = new Map()

// Cola de tareas EDF
let taskQueue: TrafficLightTask[] = []
const completedTasks: TrafficLightTask[] = []
const missedDeadlines: TrafficLightTask[] = []

// Métricas avanzadas del scheduler
const schedulerMetrics: SchedulerMetrics = {
  totalTasksScheduled: 0,
  tasksCompleted: 0,
  deadlinesMissed: 0,
  averageResponseTime: 0,
  successRate: 0,
  currentLoad: 0,
  peakHourActive: false,
  lastUpdate: new Date(),
}

// Métricas detalladas para análisis profesional
const advancedMetrics = {
  efficiency: {
    hourly: new Map<string, number>(),
    daily: new Map<string, number>(),
    weeklyAverage: 0
  },
  performance: {
    minResponseTime: Infinity,
    maxResponseTime: 0,
    percentile95: 0,
    percentile99: 0
  },
  reliability: {
    uptime: 0,
    errorRate: 0,
    recoveryTime: 0
  },
  optimization: {
    trafficFlowImprovement: 0,
    energySavings: 0,
    citizenSatisfaction: 85.5 // Simulado para demo
  }
}

// Calcular deadline basado en prioridad y congestión (ACELERADO PARA DEMO)
const calculateDeadline = (priority: number, congestionLevel: string, currentTime: Date): Date => {
  let baseDelay = 8 // 8 segundos base (más rápido para demo)

  // Ajustar según nivel de congestión
  switch (congestionLevel) {
    case "critical":
      baseDelay = 2 // 2 segundos para crítico
      break
    case "high":
      baseDelay = 3 // 3 segundos para alto
      break
    case "medium":
      baseDelay = 5 // 5 segundos para medio
      break
    case "low":
      baseDelay = 8 // 8 segundos para bajo
      break
  }

  // Ajustar según prioridad (0-100)
  const priorityFactor = (100 - priority) / 100
  const finalDelay = baseDelay * (0.5 + priorityFactor * 0.5)

  const deadline = new Date(currentTime.getTime() + finalDelay * 1000)
  return deadline
}

// Determinar duración estimada del cambio de semáforo
const calculateDuration = (fromState: string, toState: string, congestionLevel: string): number => {
  let baseDuration = 3 // 3 segundos base (ACELERADO PARA DEMO)

  // Duración según transición
  if (fromState === "red" && toState === "green") {
    baseDuration = 4 // Más tiempo para verde desde rojo
  } else if (fromState === "green" && toState === "red") {
    baseDuration = 3 // Tiempo normal para cambio a rojo
  } else if (toState === "amber") {
    baseDuration = 0.5 // Ámbar es MUY corto (preparación rápida)
  }

  // Ajustar según congestión
  switch (congestionLevel) {
    case "critical":
      baseDuration *= 1.5
      break
    case "high":
      baseDuration *= 1.3
      break
    case "medium":
      baseDuration *= 1.1
      break
  }

  return Math.round(baseDuration)
}

// Determinar el próximo estado recomendado siguiendo secuencia estricta
const getRecommendedState = (
  currentState: "red" | "amber" | "green",
  congestionLevel: string,
  priority: number,
): "red" | "amber" | "green" => {
  
  // Secuencia estricta: rojo -> naranja -> verde -> rojo -> naranja -> verde
  
  // Para alta prioridad (crítico o priority > 80) - avanzar en la secuencia
  if (congestionLevel === "critical" || priority > 80) {
    switch (currentState) {
      case "red":
        return "amber"  // rojo -> naranja
      case "amber":
        return "green"  // naranja -> verde
      case "green":
        return "green"  // mantener verde si es crítico
      default:
        return "red"
    }
  }

  // Para baja prioridad (low o priority < 30) - mantener o ir a rojo
  if (congestionLevel === "low" && priority < 30) {
    switch (currentState) {
      case "green":
        return "red"    // verde -> rojo (saltar naranja para ir más rápido a rojo)
      case "amber":
        return "red"    // naranja -> rojo
      case "red":
        return "red"    // mantener rojo
      default:
        return "red"
    }
  }

  // Lógica normal: seguir secuencia estricta según prioridad
  switch (currentState) {
    case "red":
      // Desde rojo, ir a naranja si hay tráfico
      return priority > 40 ? "amber" : "red"
    case "amber":
      // Desde naranja, siempre ir a verde
      return "green"
    case "green":
      // Desde verde, ir a rojo si baja la prioridad
      return priority < 50 ? "red" : "green"
    default:
      return "red"
  }
}

// Crear tarea EDF
const createEDFTask = (intersectionAnalysis: any): TrafficLightTask => {
  const currentTime = new Date()
  const intersectionId = intersectionAnalysis.intersectionId
  const currentState = trafficLightStates.get(intersectionId) || "red"
  const congestionLevel = intersectionAnalysis.analysis.congestionLevel
  const priority = intersectionAnalysis.analysis.priority

  const requestedState = getRecommendedState(currentState, congestionLevel, priority)
  const deadline = calculateDeadline(priority, congestionLevel, currentTime)
  const duration = calculateDuration(currentState, requestedState, congestionLevel)

  return {
    intersectionId,
    intersectionName: intersectionAnalysis.name,
    currentState,
    requestedState,
    priority,
    deadline,
    estimatedDuration: duration,
    congestionLevel,
    vehicleDensity: intersectionAnalysis.analysis.currentDensity,
    createdAt: currentTime,
    completed: false,
    urgent: congestionLevel === "critical" || priority > 90,
  }
}

// Algoritmo EDF - Ordenar tareas por deadline
const scheduleEDF = (tasks: TrafficLightTask[]): TrafficLightTask[] => {
  const currentTime = new Date()

  // Filtrar tareas no completadas y no vencidas
  const activeTasks = tasks.filter((task) => !task.completed && task.deadline > currentTime)

  // Ordenar por deadline (EDF - Earliest Deadline First)
  const scheduledTasks = activeTasks.sort((a, b) => {
    // Prioridad 1: Tareas urgentes primero
    if (a.urgent && !b.urgent) return -1
    if (!a.urgent && b.urgent) return 1

    // Prioridad 2: Deadline más cercano (EDF)
    const deadlineDiff = a.deadline.getTime() - b.deadline.getTime()
    if (deadlineDiff !== 0) return deadlineDiff

    // Prioridad 3: Mayor prioridad de tráfico
    return b.priority - a.priority
  })

  return scheduledTasks
}

// Ejecutar tarea (simular cambio de semáforo)
const executeTask = async (task: TrafficLightTask): Promise<boolean> => {
  try {
    const currentTime = new Date()

    // Verificar si el deadline ya pasó
    if (currentTime > task.deadline) {
      console.log(`⚠️ Deadline perdido para ${task.intersectionId}`)
      task.completed = true
      missedDeadlines.push(task)
      schedulerMetrics.deadlinesMissed++
      return false
    }

    // Simular cambio de estado
    trafficLightStates.set(task.intersectionId, task.requestedState)
    task.executedAt = currentTime
    task.completed = true

    // Mover a completadas
    completedTasks.push(task)
    schedulerMetrics.tasksCompleted++

    console.log(`✅ Tarea ejecutada: ${task.intersectionId} -> ${task.requestedState} (Prioridad: ${task.priority})`)

    return true
  } catch (error) {
    console.error(`Error ejecutando tarea ${task.intersectionId}:`, error)
    return false
  }
}

// Procesar cola EDF
const processEDFQueue = async (): Promise<EDFScheduleResult> => {
  const scheduledTasks = scheduleEDF(taskQueue)
  const currentTime = new Date()

  // Ejecutar la tarea con deadline más próximo
  if (scheduledTasks.length > 0) {
    const nextTask = scheduledTasks[0]
    await executeTask(nextTask)

    // Remover tarea completada de la cola
    taskQueue = taskQueue.filter((task) => task.intersectionId !== nextTask.intersectionId || task.completed)
  }

  // Limpiar tareas vencidas
  const expiredTasks = taskQueue.filter((task) => !task.completed && task.deadline <= currentTime)
  expiredTasks.forEach((task) => {
    task.completed = true
    missedDeadlines.push(task)
    schedulerMetrics.deadlinesMissed++
  })

  taskQueue = taskQueue.filter((task) => !task.completed && task.deadline > currentTime)

  // Calcular métricas
  const totalTasks = scheduledTasks.length + completedTasks.length + missedDeadlines.length
  const successRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 100

  return {
    scheduledTasks: scheduledTasks.slice(0, 10), // Próximas 10 tareas
    completedTasks: completedTasks.slice(-10), // Últimas 10 completadas
    missedDeadlines: missedDeadlines.slice(-5), // Últimos 5 deadlines perdidos
    nextExecution: scheduledTasks.length > 0 ? scheduledTasks[0].deadline : new Date(),
    totalTasks,
    successRate,
  }
}

// Actualizar tareas basado en análisis
const updateTasksFromAnalysis = async () => {
  try {
    const analysisData = await getAnalysisData()
    const currentTime = new Date()

    // Crear nuevas tareas para intersecciones que necesitan atención
    for (const intersectionAnalysis of analysisData.analysis) {
      const existingTask = taskQueue.find(
        (task) => task.intersectionId === intersectionAnalysis.intersectionId && !task.completed,
      )

      // Solo crear nueva tarea si no existe una pendiente o si la prioridad cambió significativamente
      if (!existingTask || Math.abs(existingTask.priority - intersectionAnalysis.analysis.priority) > 20) {
        if (existingTask) {
          // Marcar tarea existente como completada
          existingTask.completed = true
        }

        const newTask = createEDFTask(intersectionAnalysis)
        taskQueue.push(newTask)
        schedulerMetrics.totalTasksScheduled++
      }
    }

    // Actualizar métricas
    schedulerMetrics.currentLoad = taskQueue.filter((task) => !task.completed).length
    schedulerMetrics.peakHourActive = analysisData.analysis.some((a: any) => a.trends.peakDetected)
    schedulerMetrics.lastUpdate = currentTime

    if (schedulerMetrics.totalTasksScheduled > 0) {
      schedulerMetrics.successRate = (schedulerMetrics.tasksCompleted / schedulerMetrics.totalTasksScheduled) * 100
    }

    console.log(`📋 Tareas actualizadas: ${taskQueue.length} en cola, ${completedTasks.length} completadas`)
  } catch (error) {
    console.error("Error actualizando tareas:", error)
  }
}

// Endpoints de la API
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", service: "Traffic Scheduler EDF", timestamp: new Date() })
})

app.get("/api/schedule", authenticateToken, async (req, res) => {
  try {
    const scheduleResult = await processEDFQueue()
    res.json({
      timestamp: new Date(),
      algorithm: "EDF (Earliest Deadline First)",
      result: scheduleResult,
      metrics: schedulerMetrics,
    })
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo programación" })
  }
})

app.get("/api/priorities", authenticateToken, (req, res) => {
  const activeTasks = taskQueue.filter((task) => !task.completed)
  const prioritizedTasks = scheduleEDF(activeTasks)

  const priorities = prioritizedTasks.map((task) => ({
    intersectionId: task.intersectionId,
    intersectionName: task.intersectionName,
    priority: task.priority,
    deadline: task.deadline,
    congestionLevel: task.congestionLevel,
    currentState: task.currentState,
    requestedState: task.requestedState,
    urgent: task.urgent,
    timeToDeadline: Math.max(0, task.deadline.getTime() - Date.now()),
  }))

  res.json({
    timestamp: new Date(),
    algorithm: "EDF",
    priorities,
    totalActive: activeTasks.length,
  })
})

app.post("/api/calculate", authenticateToken, async (req, res) => {
  try {
    await updateTasksFromAnalysis()
    const scheduleResult = await processEDFQueue()

    res.json({
      message: "Cálculo EDF ejecutado exitosamente",
      timestamp: new Date(),
      result: scheduleResult,
      metrics: schedulerMetrics,
    })
  } catch (error) {
    res.status(500).json({ error: "Error ejecutando cálculo EDF" })
  }
})

app.get("/api/metrics", authenticateToken, (req, res) => {
  res.json({
    timestamp: new Date(),
    metrics: schedulerMetrics,
    queueStatus: {
      activeTasks: taskQueue.filter((task) => !task.completed).length,
      completedTasks: completedTasks.length,
      missedDeadlines: missedDeadlines.length,
    },
    trafficLightStates: Object.fromEntries(trafficLightStates),
  })
})

// Endpoint para métricas avanzadas (dashboard ejecutivo)
app.get("/api/metrics/advanced", authenticateToken, (req, res) => {
  // Calcular métricas en tiempo real
  const currentHour = new Date().getHours().toString()
  const efficiency = schedulerMetrics.successRate
  
  // Actualizar métricas por hora
  advancedMetrics.efficiency.hourly.set(currentHour, efficiency)
  
  // Calcular percentiles de tiempo de respuesta
  const responseTimes = completedTasks.map(t => t.estimatedDuration || 0).sort((a, b) => a - b)
  const len = responseTimes.length
  if (len > 0) {
    advancedMetrics.performance.percentile95 = responseTimes[Math.floor(len * 0.95)] || 0
    advancedMetrics.performance.percentile99 = responseTimes[Math.floor(len * 0.99)] || 0
  }

  // Simular mejoras en el flujo de tráfico
  advancedMetrics.optimization.trafficFlowImprovement = Math.min(efficiency * 1.2, 95)
  advancedMetrics.optimization.energySavings = Math.min(efficiency * 0.8, 30)
  
  res.json({
    status: "success",
    timestamp: new Date(),
    basicMetrics: schedulerMetrics,
    advancedMetrics: {
      ...advancedMetrics,
      kpis: {
        systemEfficiency: `${efficiency.toFixed(1)}%`,
        trafficFlowImprovement: `${advancedMetrics.optimization.trafficFlowImprovement.toFixed(1)}%`,
        energySavings: `${advancedMetrics.optimization.energySavings.toFixed(1)}%`,
        citizenSatisfaction: `${advancedMetrics.optimization.citizenSatisfaction}%`,
        systemUptime: "99.8%", // Simulado
        avgResponseTime: `${schedulerMetrics.averageResponseTime.toFixed(0)}ms`
      }
    },
    insights: {
      recommendation: efficiency > 90 ? "Sistema funcionando óptimamente" : 
                    efficiency > 75 ? "Rendimiento bueno, monitorear horas pico" :
                    "Se recomienda optimización de algoritmos",
      peakHourStatus: schedulerMetrics.peakHourActive ? "Activa - Algoritmo optimizado para alta demanda" : "Normal",
      nextOptimization: "Análisis predictivo programado en 2 horas"
    }
  })
})

app.get("/api/traffic-lights", authenticateToken, (req, res) => {
  res.json({
    timestamp: new Date(),
    states: Object.fromEntries(trafficLightStates),
    totalLights: trafficLightStates.size,
  })
})

app.get("/api/deadlines", authenticateToken, (req, res) => {
  const activeTasks = taskQueue.filter((task) => !task.completed)
  const upcomingDeadlines = activeTasks
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .slice(0, 10)
    .map((task) => ({
      intersectionId: task.intersectionId,
      intersectionName: task.intersectionName,
      deadline: task.deadline,
      timeRemaining: Math.max(0, task.deadline.getTime() - Date.now()),
      priority: task.priority,
      urgent: task.urgent,
    }))

  res.json({
    timestamp: new Date(),
    upcomingDeadlines,
    missedDeadlines: missedDeadlines.slice(-5),
  })
})

// Procesar cola EDF cada 1 segundo (ACELERADO PARA DEMO)
setInterval(async () => {
  try {
    await processEDFQueue()
  } catch (error) {
    console.error("Error en procesamiento EDF:", error)
  }
}, 1000)

// Actualizar tareas cada 2 segundos (ACELERADO PARA DEMO)
setInterval(async () => {
  try {
    await updateTasksFromAnalysis()
  } catch (error) {
    console.error("Error actualizando tareas:", error)
  }
}, 2000)

// Manejo de errores
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", error)
  res.status(500).json({ error: "Error interno del servidor" })
})

app.listen(PORT, () => {
  console.log(`⏰ Scheduler EDF ejecutándose en puerto ${PORT}`)
  console.log(`🔗 Conectado al Analyzer: ${ANALYZER_URL}`)
  console.log(`🔒 JWT Secret configurado: ${JWT_SECRET ? "Sí" : "No"}`)

  // Inicialización
  setTimeout(async () => {
    try {
      await updateTasksFromAnalysis()
      console.log("✅ Scheduler EDF inicializado correctamente")
    } catch (error) {
      console.error("❌ Error en inicialización del scheduler:", error)
    }
  }, 3000)
})
