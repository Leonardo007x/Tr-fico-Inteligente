import express from "express"
import cors from "cors"
import jwt from "jsonwebtoken"
import WebSocket from "ws"
import http from "http"

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.use(cors())
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || "tu_secreto_jwt_aqui"
const PORT = process.env.PORT || 3001

// Intersecciones principales de Popayán
const INTERSECTIONS = [
  { id: "int_001", name: "Carrera 5 con Calle 5", lat: 2.4448, lng: -76.6147, maxCapacity: 100 },
  { id: "int_002", name: "Carrera 6 con Calle 4", lat: 2.4438, lng: -76.6137, maxCapacity: 80 },
  { id: "int_003", name: "Carrera 7 con Calle 3", lat: 2.4428, lng: -76.6127, maxCapacity: 120 },
  { id: "int_004", name: "Carrera 8 con Calle 2", lat: 2.4418, lng: -76.6117, maxCapacity: 90 },
  { id: "int_005", name: "Carrera 9 con Calle 1", lat: 2.4408, lng: -76.6107, maxCapacity: 110 },
  { id: "int_006", name: "Avenida Panamericana Norte", lat: 2.4498, lng: -76.6097, maxCapacity: 150 },
  { id: "int_007", name: "Avenida Panamericana Sur", lat: 2.4398, lng: -76.6197, maxCapacity: 140 },
  { id: "int_008", name: "Carrera 2 con Calle 8", lat: 2.4468, lng: -76.6167, maxCapacity: 70 },
]

interface TrafficData {
  intersectionId: string
  vehicleCount: number
  timestamp: Date
  density: number
  peakHour: boolean
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

// Generar token JWT para pruebas
app.post("/api/auth/token", (req, res) => {
  const { username } = req.body
  if (!username) {
    return res.status(400).json({ error: "Username requerido" })
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "24h" })
  res.json({ token, expiresIn: "24h" })
})

// Función para simular datos de tráfico
const generateTrafficData = (): TrafficData[] => {
  const currentHour = new Date().getHours()
  const isPeakHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)

  return INTERSECTIONS.map((intersection) => {
    let baseTraffic = Math.random() * 0.6 // 0-60% de capacidad base

    // Aumentar tráfico en horas pico
    if (isPeakHour) {
      baseTraffic += Math.random() * 0.4 // Hasta 100% en horas pico
    }

    // Variación adicional para simular eventos especiales
    if (Math.random() < 0.1) {
      // 10% probabilidad de evento especial
      baseTraffic += Math.random() * 0.3
    }

    const vehicleCount = Math.floor(baseTraffic * intersection.maxCapacity)
    const density = vehicleCount / intersection.maxCapacity

    return {
      intersectionId: intersection.id,
      vehicleCount: Math.max(0, vehicleCount),
      timestamp: new Date(),
      density: Math.min(1, density),
      peakHour: isPeakHour,
    }
  })
}

// Almacenar datos históricos (últimos 100 registros por intersección)
const trafficHistory: Map<string, TrafficData[]> = new Map()

// Función para actualizar historial
const updateHistory = (data: TrafficData[]) => {
  data.forEach((item) => {
    if (!trafficHistory.has(item.intersectionId)) {
      trafficHistory.set(item.intersectionId, [])
    }

    const history = trafficHistory.get(item.intersectionId)!
    history.push(item)

    // Mantener solo los últimos 100 registros
    if (history.length > 100) {
      history.shift()
    }
  })
}

// Endpoints de la API
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", service: "Traffic Ingestor", timestamp: new Date() })
})

app.get("/api/intersections", (req, res) => {
  res.json(INTERSECTIONS)
})

app.get("/api/traffic-data", authenticateToken, (req, res) => {
  const currentData = generateTrafficData()
  updateHistory(currentData)

  res.json({
    timestamp: new Date(),
    data: currentData,
    totalIntersections: INTERSECTIONS.length,
  })
})

app.get("/api/traffic-data/:intersectionId", authenticateToken, (req, res) => {
  const { intersectionId } = req.params
  const intersection = INTERSECTIONS.find((i) => i.id === intersectionId)

  if (!intersection) {
    return res.status(404).json({ error: "Intersección no encontrada" })
  }

  const currentData = generateTrafficData().find((d) => d.intersectionId === intersectionId)
  const history = trafficHistory.get(intersectionId) || []

  res.json({
    intersection,
    currentData,
    history: history.slice(-10), // Últimos 10 registros
  })
})

app.get("/api/traffic-history/:intersectionId", authenticateToken, (req, res) => {
  const { intersectionId } = req.params
  const history = trafficHistory.get(intersectionId) || []

  res.json({
    intersectionId,
    history,
    count: history.length,
  })
})

// Simulación de hora pico
app.post("/api/simulate-peak", authenticateToken, (req, res) => {
  const peakData = INTERSECTIONS.map((intersection) => {
    const vehicleCount = Math.floor((0.8 + Math.random() * 0.2) * intersection.maxCapacity)
    return {
      intersectionId: intersection.id,
      vehicleCount,
      timestamp: new Date(),
      density: vehicleCount / intersection.maxCapacity,
      peakHour: true,
    }
  })

  updateHistory(peakData)

  // Enviar datos a través de WebSocket
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "peak_simulation",
          data: peakData,
        }),
      )
    }
  })

  res.json({
    message: "Simulación de hora pico activada",
    data: peakData,
  })
})

// WebSocket para datos en tiempo real
wss.on("connection", (ws) => {
  console.log("Cliente WebSocket conectado")

  // Enviar datos iniciales
  const initialData = generateTrafficData()
  ws.send(
    JSON.stringify({
      type: "initial_data",
      data: initialData,
    }),
  )

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString())

      if (data.type === "request_data") {
        const currentData = generateTrafficData()
        updateHistory(currentData)

        ws.send(
          JSON.stringify({
            type: "traffic_update",
            data: currentData,
          }),
        )
      }
    } catch (error) {
      console.error("Error procesando mensaje WebSocket:", error)
    }
  })

  ws.on("close", () => {
    console.log("Cliente WebSocket desconectado")
  })
})

// Generar datos automáticamente cada 2 segundos (ACELERADO PARA DEMO)
setInterval(() => {
  const currentData = generateTrafficData()
  updateHistory(currentData)

  // Enviar a todos los clientes WebSocket conectados
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "traffic_update",
          data: currentData,
          timestamp: new Date(),
        }),
      )
    }
  })
}, 2000)

// Manejo de errores
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", error)
  res.status(500).json({ error: "Error interno del servidor" })
})

server.listen(PORT, () => {
  console.log(`🚦 Ingestor de Tráfico ejecutándose en puerto ${PORT}`)
  console.log(`📊 Monitoreando ${INTERSECTIONS.length} intersecciones en Popayán`)
  console.log(`🔒 JWT Secret configurado: ${JWT_SECRET ? "Sí" : "No"}`)
})
