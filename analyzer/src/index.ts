import express from "express"
import cors from "cors"
import jwt from "jsonwebtoken"
import axios from "axios"

const app = express()
app.use(cors())
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || "tu_secreto_jwt_aqui"
const PORT = process.env.PORT || 3002
const INGESTOR_URL = process.env.INGESTOR_URL || "http://localhost:3001"

interface TrafficData {
  intersectionId: string
  vehicleCount: number
  timestamp: Date
  density: number
  peakHour: boolean
}

interface AnalysisResult {
  intersectionId: string
  currentDensity: number
  averageDensity: number
  congestionLevel: "low" | "medium" | "high" | "critical"
  recommendation: string
  priority: number
  estimatedWaitTime: number
  timestamp: Date
}

interface IntersectionAnalysis {
  intersectionId: string
  name: string
  location: { lat: number; lng: number }
  analysis: AnalysisResult
  historicalData: TrafficData[]
  trends: {
    increasing: boolean
    peakDetected: boolean
    averageGrowth: number
  }
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

// Obtener token JWT para comunicación con ingestor
const getAuthToken = async (): Promise<string> => {
  try {
    const response = await axios.post(`${INGESTOR_URL}/api/auth/token`, {
      username: "analyzer-service",
    })
    return response.data.token
  } catch (error) {
    console.error("Error obteniendo token:", error)
    throw new Error("No se pudo obtener token de autenticación")
  }
}

// Obtener datos del ingestor
const getTrafficData = async (): Promise<TrafficData[]> => {
  try {
    const token = await getAuthToken()
    const response = await axios.get(`${INGESTOR_URL}/api/traffic-data`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data.data
  } catch (error) {
    console.error("Error obteniendo datos de tráfico:", error)
    throw new Error("No se pudieron obtener datos de tráfico")
  }
}

// Obtener datos históricos de una intersección
const getHistoricalData = async (intersectionId: string): Promise<TrafficData[]> => {
  try {
    const token = await getAuthToken()
    const response = await axios.get(`${INGESTOR_URL}/api/traffic-history/${intersectionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data.history
  } catch (error) {
    console.error(`Error obteniendo historial para ${intersectionId}:`, error)
    return []
  }
}

// Obtener información de intersecciones
const getIntersections = async () => {
  try {
    const response = await axios.get(`${INGESTOR_URL}/api/intersections`)
    return response.data
  } catch (error) {
    console.error("Error obteniendo intersecciones:", error)
    return []
  }
}

// Calcular nivel de congestión
const calculateCongestionLevel = (density: number): "low" | "medium" | "high" | "critical" => {
  if (density < 0.3) return "low"
  if (density < 0.6) return "medium"
  if (density < 0.8) return "high"
  return "critical"
}

// Calcular prioridad basada en densidad y tendencias
const calculatePriority = (density: number, trend: number, peakHour: boolean): number => {
  let priority = density * 100

  // Aumentar prioridad si hay tendencia creciente
  if (trend > 0.1) priority += 20
  if (trend > 0.2) priority += 30

  // Aumentar prioridad en horas pico
  if (peakHour) priority += 15

  // Prioridad crítica para densidades muy altas
  if (density > 0.9) priority += 50

  return Math.min(100, Math.round(priority))
}

// Estimar tiempo de espera basado en densidad
const estimateWaitTime = (density: number, congestionLevel: string): number => {
  const baseWaitTime: Record<string, number> = {
    low: 30,
    medium: 60,
    high: 120,
    critical: 300,
  }

  const base = baseWaitTime[congestionLevel] || 60
  const variation = Math.random() * 0.3 - 0.15 // ±15% variación
  return Math.round(base * (1 + variation))
}

// Generar recomendaciones
const generateRecommendation = (analysis: AnalysisResult): string => {
  const { congestionLevel, currentDensity, priority } = analysis

  if (congestionLevel === "critical") {
    return "URGENTE: Activar semáforo inmediatamente. Congestión crítica detectada."
  }

  if (congestionLevel === "high") {
    return "Alta prioridad: Reducir tiempo de espera del semáforo."
  }

  if (congestionLevel === "medium" && priority > 60) {
    return "Prioridad media: Considerar ajuste de tiempos según tendencia."
  }

  if (currentDensity < 0.2) {
    return "Tráfico fluido: Mantener tiempos normales de semáforo."
  }

  return "Monitorear: Tráfico en niveles normales."
}

// Analizar tendencias históricas
const analyzeTrends = (historicalData: TrafficData[]) => {
  if (historicalData.length < 5) {
    return {
      increasing: false,
      peakDetected: false,
      averageGrowth: 0,
    }
  }

  const recent = historicalData.slice(-5)
  const older = historicalData.slice(-10, -5)

  const recentAvg = recent.reduce((sum, d) => sum + d.density, 0) / recent.length
  const olderAvg = older.length > 0 ? older.reduce((sum, d) => sum + d.density, 0) / older.length : recentAvg

  const growth = recentAvg - olderAvg
  const peakDetected = recent.some((d) => d.peakHour) || recentAvg > 0.7

  return {
    increasing: growth > 0.05,
    peakDetected,
    averageGrowth: growth,
  }
}

// Función principal de análisis
const analyzeTrafficData = async (): Promise<IntersectionAnalysis[]> => {
  try {
    const [currentData, intersections] = await Promise.all([getTrafficData(), getIntersections()])

    const analyses: IntersectionAnalysis[] = []

    for (const intersection of intersections) {
      const currentTraffic = currentData.find((d) => d.intersectionId === intersection.id)
      if (!currentTraffic) continue

      const historicalData = await getHistoricalData(intersection.id)
      const trends = analyzeTrends(historicalData)

      const averageDensity =
        historicalData.length > 0
          ? historicalData.reduce((sum, d) => sum + d.density, 0) / historicalData.length
          : currentTraffic.density

      const congestionLevel = calculateCongestionLevel(currentTraffic.density)
      const priority = calculatePriority(currentTraffic.density, trends.averageGrowth, currentTraffic.peakHour)
      const estimatedWaitTime = estimateWaitTime(currentTraffic.density, congestionLevel)

      const analysis: AnalysisResult = {
        intersectionId: intersection.id,
        currentDensity: currentTraffic.density,
        averageDensity,
        congestionLevel,
        recommendation: "",
        priority,
        estimatedWaitTime,
        timestamp: new Date(),
      }

      analysis.recommendation = generateRecommendation(analysis)

      analyses.push({
        intersectionId: intersection.id,
        name: intersection.name,
        location: { lat: intersection.lat, lng: intersection.lng },
        analysis,
        historicalData: historicalData.slice(-10), // Últimos 10 registros
        trends,
      })
    }

    return analyses.sort((a, b) => b.analysis.priority - a.analysis.priority)
  } catch (error) {
    console.error("Error en análisis de tráfico:", error)
    throw error
  }
}

// Cache para análisis (actualizado cada 10 segundos)
let analysisCache: IntersectionAnalysis[] = []
let lastAnalysisTime = 0

const getCachedAnalysis = async (): Promise<IntersectionAnalysis[]> => {
  const now = Date.now()
  if (now - lastAnalysisTime > 10000) {
    // 10 segundos
    try {
      analysisCache = await analyzeTrafficData()
      lastAnalysisTime = now
    } catch (error) {
      console.error("Error actualizando cache de análisis:", error)
    }
  }
  return analysisCache
}

// Endpoints de la API
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", service: "Traffic Analyzer", timestamp: new Date() })
})

app.get("/api/analysis", authenticateToken, async (req, res) => {
  try {
    const analysis = await getCachedAnalysis()
    res.json({
      timestamp: new Date(),
      totalIntersections: analysis.length,
      analysis,
      summary: {
        critical: analysis.filter((a) => a.analysis.congestionLevel === "critical").length,
        high: analysis.filter((a) => a.analysis.congestionLevel === "high").length,
        medium: analysis.filter((a) => a.analysis.congestionLevel === "medium").length,
        low: analysis.filter((a) => a.analysis.congestionLevel === "low").length,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo análisis" })
  }
})

app.get("/api/analysis/:intersectionId", authenticateToken, async (req, res) => {
  try {
    const { intersectionId } = req.params
    const analysis = await getCachedAnalysis()
    const intersectionAnalysis = analysis.find((a) => a.intersectionId === intersectionId)

    if (!intersectionAnalysis) {
      return res.status(404).json({ error: "Intersección no encontrada" })
    }

    res.json(intersectionAnalysis)
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo análisis de intersección" })
  }
})

app.get("/api/density/:intersectionId", authenticateToken, async (req, res) => {
  try {
    const { intersectionId } = req.params
    const analysis = await getCachedAnalysis()
    const intersectionAnalysis = analysis.find((a) => a.intersectionId === intersectionId)

    if (!intersectionAnalysis) {
      return res.status(404).json({ error: "Intersección no encontrada" })
    }

    res.json({
      intersectionId,
      currentDensity: intersectionAnalysis.analysis.currentDensity,
      averageDensity: intersectionAnalysis.analysis.averageDensity,
      congestionLevel: intersectionAnalysis.analysis.congestionLevel,
      timestamp: intersectionAnalysis.analysis.timestamp,
    })
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo densidad" })
  }
})

app.post("/api/analyze", authenticateToken, async (req, res) => {
  try {
    const analysis = await analyzeTrafficData()
    analysisCache = analysis
    lastAnalysisTime = Date.now()

    res.json({
      message: "Análisis ejecutado exitosamente",
      timestamp: new Date(),
      analysis,
    })
  } catch (error) {
    res.status(500).json({ error: "Error ejecutando análisis" })
  }
})

app.get("/api/priorities", authenticateToken, async (req, res) => {
  try {
    const analysis = await getCachedAnalysis()
    const priorities = analysis.map((a) => ({
      intersectionId: a.intersectionId,
      name: a.name,
      priority: a.analysis.priority,
      congestionLevel: a.analysis.congestionLevel,
      recommendation: a.analysis.recommendation,
    }))

    res.json({
      timestamp: new Date(),
      priorities: priorities.sort((a, b) => b.priority - a.priority),
    })
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo prioridades" })
  }
})

// Endpoint para métricas del sistema
app.get("/api/metrics", authenticateToken, async (req, res) => {
  try {
    const analysis = await getCachedAnalysis()

    const metrics = {
      totalIntersections: analysis.length,
      averageDensity: analysis.reduce((sum, a) => sum + a.analysis.currentDensity, 0) / analysis.length,
      highPriorityCount: analysis.filter((a) => a.analysis.priority > 70).length,
      criticalCount: analysis.filter((a) => a.analysis.congestionLevel === "critical").length,
      peakHourActive: analysis.some((a) => a.trends.peakDetected),
      averageWaitTime: analysis.reduce((sum, a) => sum + a.analysis.estimatedWaitTime, 0) / analysis.length,
      timestamp: new Date(),
    }

    res.json(metrics)
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo métricas" })
  }
})

// Actualizar análisis automáticamente cada 15 segundos
setInterval(async () => {
  try {
    await getCachedAnalysis()
    console.log(`📊 Análisis actualizado: ${analysisCache.length} intersecciones procesadas`)
  } catch (error) {
    console.error("Error en actualización automática:", error)
  }
}, 15000)

// Manejo de errores
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", error)
  res.status(500).json({ error: "Error interno del servidor" })
})

app.listen(PORT, () => {
  console.log(`🔍 Analizador de Tráfico ejecutándose en puerto ${PORT}`)
  console.log(`🔗 Conectado al Ingestor: ${INGESTOR_URL}`)
  console.log(`🔒 JWT Secret configurado: ${JWT_SECRET ? "Sí" : "No"}`)

  // Ejecutar análisis inicial
  setTimeout(async () => {
    try {
      await getCachedAnalysis()
      console.log("✅ Análisis inicial completado")
    } catch (error) {
      console.error("❌ Error en análisis inicial:", error)
    }
  }, 2000)
})
