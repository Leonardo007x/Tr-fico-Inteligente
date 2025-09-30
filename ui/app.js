/* global L, io */

class TrafficControlApp {
  constructor() {
    this.map = null
    this.socket = null
    this.trafficLights = new Map()
    this.markers = new Map()
    this.showLabels = true
    this.isConnected = false
    this.charts = {}
    this.chartData = {
      flowData: [],
      waitTimeData: [],
      maxDataPoints: 20
    }

    this.init()
  }

  async init() {
    try {
      this.initMap()
      this.initSocket()
      this.initEventListeners()
      this.initCharts()
      this.startPeriodicUpdates()

      // Hide loading overlay after initialization
      setTimeout(() => {
        document.getElementById("loading-overlay").style.display = "none"
      }, 2000)
    } catch (error) {
      console.error("Error initializing app:", error)
      this.showError("Error inicializando la aplicación")
    }
  }

  initMap() {
    // Initialize map centered on Popayán
    this.map = L.map("map").setView([2.4448, -76.6147], 14)

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(this.map)

    // Add custom controls
    this.addMapControls()
  }

  initSocket() {
    const CONTROLLER_URL =
      window.location.hostname === "localhost" ? "http://localhost:3004" : `http://${window.location.hostname}:3004`

    this.socket = io(CONTROLLER_URL)

    this.socket.on("connect", () => {
      console.log("Connected to controller")
      this.isConnected = true
      this.updateConnectionStatus(true)
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from controller")
      this.isConnected = false
      this.updateConnectionStatus(false)
    })

    this.socket.on("initialState", (data) => {
      console.log("Received initial state:", data)
      this.updateTrafficLights(data.lights)
      this.updateMetrics(data.metrics)
    })

    this.socket.on("stateUpdate", (data) => {
      this.updateTrafficLights(data.lights)
      this.updateMetrics(data.metrics)
    })

    this.socket.on("trafficLightChanged", (data) => {
      this.handleTrafficLightChange(data)
    })

    this.socket.on("maintenanceAlert", (data) => {
      this.handleMaintenanceAlert(data)
    })

    // Request initial state
    setTimeout(() => {
      if (this.socket.connected) {
        this.socket.emit("requestState")
      }
    }, 1000)
  }

  initEventListeners() {
    // Map controls
    document.getElementById("center-map").addEventListener("click", () => {
      this.map.setView([2.4448, -76.6147], 14)
    })

    document.getElementById("toggle-labels").addEventListener("click", () => {
      this.toggleLabels()
    })

    document.getElementById("simulate-peak").addEventListener("click", () => {
      this.simulatePeakHour()
    })

    // Agregar botón de simulación de ataques
    this.addAttackSimulationButton()

    // Modal controls
    document.getElementById("close-modal").addEventListener("click", () => {
      this.closeModal()
    })

    // Close modal when clicking outside
    document.getElementById("light-modal").addEventListener("click", (e) => {
      if (e.target.id === "light-modal") {
        this.closeModal()
      }
    })

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeModal()
      }
    })
  }

  addMapControls() {
    // Add custom legend
    const legend = L.control({ position: "bottomleft" })
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "legend")
      div.style.background = "rgba(255, 255, 255, 0.95)"
      div.style.padding = "10px"
      div.style.borderRadius = "8px"
      div.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)"
      div.innerHTML = `
                <h4 style="margin: 0 0 8px 0; font-size: 14px;">Estado de Semáforos</h4>
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
                    <div><span style="display: inline-block; width: 12px; height: 12px; background: #48bb78; border-radius: 50%; margin-right: 8px;"></span>Verde - Paso libre</div>
                    <div><span style="display: inline-block; width: 12px; height: 12px; background: #ed8936; border-radius: 50%; margin-right: 8px;"></span>Ámbar - Precaución</div>
                    <div><span style="display: inline-block; width: 12px; height: 12px; background: #f56565; border-radius: 50%; margin-right: 8px;"></span>Rojo - Detenido</div>
                    <div><span style="display: inline-block; width: 12px; height: 12px; background: #718096; border-radius: 50%; margin-right: 8px;"></span>Mantenimiento</div>
                </div>
            `
      return div
    }
    legend.addTo(this.map)
  }

  addAttackSimulationButton() {
    // Crear botón de simulación de ataques
    const mapControls = document.querySelector('.map-controls')
    const attackBtn = document.createElement('button')
    attackBtn.id = 'simulate-attack'
    attackBtn.className = 'control-btn'
    attackBtn.innerHTML = '🛡️ Simular Ataque'
    attackBtn.style.background = 'linear-gradient(135deg, #f56565, #e53e3e)'
    attackBtn.style.color = 'white'
    attackBtn.style.border = 'none'
    
    attackBtn.addEventListener('click', () => {
      this.simulateSecurityAttack()
    })
    
    mapControls.appendChild(attackBtn)
  }

  initCharts() {
    // Initialize Flow Chart
    const flowCtx = document.getElementById('flowChart').getContext('2d')
    this.charts.flow = new Chart(flowCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Vehículos/min',
          data: [],
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: 'rgba(102, 126, 234, 1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        animation: {
          duration: 750,
          easing: 'easeInOutQuart'
        }
      }
    })

    // Initialize Wait Time Chart
    const waitCtx = document.getElementById('waitTimeChart').getContext('2d')
    this.charts.waitTime = new Chart(waitCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Tiempo (seg)',
          data: [],
          borderColor: 'rgba(72, 187, 120, 1)',
          backgroundColor: 'rgba(72, 187, 120, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        animation: {
          duration: 750,
          easing: 'easeInOutQuart'
        }
      }
    })
  }

  updateCharts() {
    // Update flow chart with intersection data
    const intersections = Array.from(this.trafficLights.values())
    const labels = intersections.map(light => light.id)
    const flowData = intersections.map(light => {
      // Simulate vehicle flow based on congestion level
      const baseFlow = {
        low: Math.floor(Math.random() * 20) + 10,
        medium: Math.floor(Math.random() * 30) + 20,
        high: Math.floor(Math.random() * 40) + 30,
        critical: Math.floor(Math.random() * 50) + 40
      }
      return baseFlow[light.congestionLevel] || 15
    })

    this.charts.flow.data.labels = labels
    this.charts.flow.data.datasets[0].data = flowData
    this.charts.flow.update('none')

    // Update wait time chart
    const now = new Date().toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
    
    this.chartData.waitTimeData.push({
      time: now,
      value: Math.floor(Math.random() * 60) + 30
    })

    if (this.chartData.waitTimeData.length > this.chartData.maxDataPoints) {
      this.chartData.waitTimeData.shift()
    }

    this.charts.waitTime.data.labels = this.chartData.waitTimeData.map(d => d.time)
    this.charts.waitTime.data.datasets[0].data = this.chartData.waitTimeData.map(d => d.value)
    this.charts.waitTime.update('none')
  }

  updateTrafficLights(lights) {
    lights.forEach((light) => {
      this.trafficLights.set(light.id, light)
      this.updateMarker(light)
    })
    
    // Update charts when traffic lights data changes
    this.updateCharts()
  }

  updateMarker(light) {
    let marker = this.markers.get(light.id)

    if (!marker) {
      // Create new marker
      const icon = this.createTrafficLightIcon(light.currentState, light.maintenanceMode)
      marker = L.marker([light.location.lat, light.location.lng], { icon }).addTo(this.map)

      // Add click event
      marker.on("click", () => {
        this.showTrafficLightDetails(light.id)
      })

      // Add tooltip
      if (this.showLabels) {
        marker.bindTooltip(light.name, {
          permanent: false,
          direction: "top",
          offset: [0, -10],
        })
      }

      this.markers.set(light.id, marker)
    } else {
      // Update existing marker
      const icon = this.createTrafficLightIcon(light.currentState, light.maintenanceMode)
      marker.setIcon(icon)
    }
  }

  createTrafficLightIcon(state, maintenanceMode = false) {
    let color = "#718096" // Default gray

    if (!maintenanceMode) {
      switch (state) {
        case "green":
          color = "#48bb78"
          break
        case "amber":
          color = "#ed8936"
          break
        case "red":
          color = "#f56565"
          break
      }
    }

    const html = `
            <div class="traffic-light-marker ${maintenanceMode ? "maintenance" : state}" 
                 style="background: ${color};">
            </div>
        `

    return L.divIcon({
      html: html,
      className: "custom-marker",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
  }

  updateMetrics(metrics) {
    // Animate metric updates
    this.animateMetricUpdate("total-lights", metrics.totalLights || "-")
    this.animateMetricUpdate("operational-lights", metrics.operationalLights || "-")
    this.animateMetricUpdate("state-changes", metrics.stateChanges || "-")
    this.animateMetricUpdate("success-rate", metrics.successRate ? `${Math.round(metrics.successRate)}%` : "-")

    document.getElementById("connected-clients").textContent = metrics.connectedClients || "-"
    document.getElementById("system-uptime").textContent = this.formatUptime(metrics.systemUptimeMs) || "-"
    document.getElementById("last-update").textContent = new Date().toLocaleTimeString("es-CO")
  }

  animateMetricUpdate(elementId, newValue) {
    const element = document.getElementById(elementId)
    const currentValue = element.textContent
    
    if (currentValue !== newValue) {
      element.classList.add("updating")
      element.textContent = newValue
      
      setTimeout(() => {
        element.classList.remove("updating")
      }, 500)
    }
  }

  updateConnectionStatus(connected) {
    const statusElement = document.getElementById("connection-status")
    const dot = statusElement.querySelector(".status-dot")
    const text = statusElement.querySelector("span")

    if (connected) {
      dot.classList.remove("offline")
      text.textContent = "Conectado"
    } else {
      dot.classList.add("offline")
      text.textContent = "Desconectado"
    }
  }

  handleTrafficLightChange(data) {
    console.log("Traffic light changed:", data)

    // Update the marker
    const light = this.trafficLights.get(data.lightId)
    if (light) {
      light.currentState = data.newState
      light.lastChanged = new Date(data.timestamp)
      this.updateMarker(light)
    }

    // Add to activity log
    this.addActivity(`${data.lightId}: ${data.oldState} → ${data.newState}`, data.reason)
  }

  handleMaintenanceAlert(data) {
    console.log("Maintenance alert:", data)

    const light = this.trafficLights.get(data.lightId)
    if (light) {
      light.maintenanceMode = data.status === "maintenance_start"
      light.isOperational = data.status !== "maintenance_start"
      this.updateMarker(light)
    }

    const message =
      data.status === "maintenance_start"
        ? `${data.name} entró en mantenimiento`
        : `${data.name} salió de mantenimiento`

    this.addActivity(message, "Sistema de Mantenimiento")
  }

  addActivity(description, reason) {
    const activityList = document.getElementById("activity-list")

    // Remove "no data" message
    const noData = activityList.querySelector(".no-data")
    if (noData) {
      noData.remove()
    }

    // Create activity item
    const item = document.createElement("div")
    item.className = "activity-item"
    item.innerHTML = `
            <div class="activity-time">${new Date().toLocaleTimeString("es-CO")}</div>
            <div class="activity-description">${description}</div>
            ${reason ? `<div class="activity-reason" style="font-size: 0.75rem; color: #718096; margin-top: 0.25rem;">${reason}</div>` : ""}
        `

    // Add to top of list
    activityList.insertBefore(item, activityList.firstChild)

    // Keep only last 10 items
    const items = activityList.querySelectorAll(".activity-item")
    if (items.length > 10) {
      items[items.length - 1].remove()
    }
  }

  async showTrafficLightDetails(lightId) {
    const light = this.trafficLights.get(lightId)
    if (!light) return

    const modal = document.getElementById("light-modal")
    const title = document.getElementById("modal-title")
    const body = document.getElementById("modal-body")

    title.textContent = `${light.name} (${light.id})`

    // Show basic details immediately with vehicle icons
    body.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <h4 style="margin-bottom: 0.5rem; color: #2d3748;">Estado Actual</h4>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div class="traffic-light-marker ${light.currentState}" style="width: 16px; height: 16px;"></div>
                            <span style="font-weight: 600; text-transform: capitalize;">${light.currentState}</span>
                        </div>
                    </div>
                    <div>
                        <h4 style="margin-bottom: 0.5rem; color: #2d3748;">Prioridad</h4>
                        <span style="font-weight: 600; color: #667eea;">${light.priority || 0}</span>
                    </div>
                    <div>
                        <h4 style="margin-bottom: 0.5rem; color: #2d3748;">Nivel de Congestión</h4>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-weight: 600; text-transform: capitalize;">${light.congestionLevel || 'low'}</span>
                            ${this.getVehicleIcons(light.congestionLevel || 'low')}
                        </div>
                    </div>
                    <div>
                        <h4 style="margin-bottom: 0.5rem; color: #2d3748;">Estado Operacional</h4>
                        <span style="font-weight: 600; color: ${light.isOperational ? "#48bb78" : "#f56565"};">
                            ${light.isOperational ? "Operacional" : "Fuera de Servicio"}
                        </span>
                    </div>
                </div>

                <div style="margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 0.5rem; color: #2d3748;">Ubicación</h4>
                    <p style="color: #718096;">Lat: ${light.location.lat}, Lng: ${light.location.lng}</p>
                </div>

                <div style="margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 0.5rem; color: #2d3748;">Último Cambio</h4>
                    <p style="color: #718096;">${new Date(light.lastChanged).toLocaleString("es-CO")}</p>
                </div>

                <div>
                    <h4 style="margin-bottom: 0.5rem; color: #2d3748;">Tráfico Actual</h4>
                    <div style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: rgba(102, 126, 234, 0.1); border-radius: 8px;">
                        <span style="font-weight: 600; color: #2d3748;">Vehículos en la intersección:</span>
                        ${this.getVehicleIcons(light.congestionLevel || 'low')}
                    </div>
                </div>
            `

    modal.style.display = "block"

    // Try to get additional details from API (optional)
    try {
      const token = await this.getAuthToken()
      if (token) {
        const response = await fetch(`http://localhost:3004/api/traffic-lights/${lightId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          
          // Add recent changes if available
          if (data.recentChanges && data.recentChanges.length > 0) {
            const changesHtml = `
              <div style="margin-top: 1.5rem;">
                <h4 style="margin-bottom: 0.5rem; color: #2d3748;">Cambios Recientes</h4>
                <div style="max-height: 200px; overflow-y: auto;">
                  ${data.recentChanges
                    .map(
                      (change) => `
                      <div style="padding: 0.5rem; margin-bottom: 0.5rem; background: rgba(0,0,0,0.02); border-radius: 4px;">
                        <div style="font-size: 0.875rem; font-weight: 600;">
                          ${change.fromState} → ${change.toState}
                        </div>
                        <div style="font-size: 0.75rem; color: #718096;">
                          ${new Date(change.timestamp).toLocaleString("es-CO")} - ${change.reason}
                        </div>
                      </div>
                    `,
                    )
                    .join("")}
                </div>
              </div>
            `
            body.innerHTML += changesHtml
          }
        }
      }
    } catch (error) {
      console.log("No se pudieron cargar detalles adicionales:", error.message)
      // No mostrar error, ya que tenemos la información básica
    }
  }

  closeModal() {
    document.getElementById("light-modal").style.display = "none"
  }

  toggleLabels() {
    this.showLabels = !this.showLabels

    this.markers.forEach((marker, lightId) => {
      if (this.showLabels) {
        const light = this.trafficLights.get(lightId)
        if (light) {
          marker.bindTooltip(light.name, {
            permanent: false,
            direction: "top",
            offset: [0, -10],
          })
        }
      } else {
        marker.unbindTooltip()
      }
    })

    const btn = document.getElementById("toggle-labels")
    btn.textContent = this.showLabels ? "🏷️ Ocultar Etiquetas" : "🏷️ Mostrar Etiquetas"
    
    // Agregar feedback visual
    btn.style.transform = 'scale(0.95)'
    setTimeout(() => {
      btn.style.transform = 'scale(1)'
    }, 150)
  }

  async simulatePeakHour() {
    try {
      // Simular hora pico localmente si no hay conexión al servidor
      this.addActivity("Simulación de hora pico activada", "Usuario")

      // Update peak hour indicator
      const peakIndicator = document.getElementById("peak-hour")
      peakIndicator.innerHTML = '<span class="peak-status" style="color: #f56565; animation: pulse 1s infinite;">Hora Pico Simulada</span>'

      // Simular aumento de tráfico visualmente
      this.simulateTrafficIncrease()

      // Agregar botón para volver a normal
      const simulateBtn = document.getElementById("simulate-peak")
      simulateBtn.textContent = "🔄 Volver a Normal"
      simulateBtn.onclick = () => this.returnToNormal()

      // Auto-reset after 2 minutes
      setTimeout(() => {
        this.returnToNormal()
      }, 120000)

    } catch (error) {
      console.error("Error simulating peak hour:", error)
      this.showError("Error simulando hora pico")
    }
  }

  simulateTrafficIncrease() {
    // Simular aumento de vehículos en los marcadores
    this.markers.forEach((marker, lightId) => {
      const light = this.trafficLights.get(lightId)
      if (light) {
        // Aumentar nivel de congestión temporalmente
        const originalLevel = light.congestionLevel
        light.congestionLevel = 'high'
        
        // Actualizar marcador con más vehículos
        const icon = this.createTrafficLightIcon(light.currentState, light.maintenanceMode)
        marker.setIcon(icon)
        
        // Restaurar después de un tiempo
        setTimeout(() => {
          light.congestionLevel = originalLevel
          const icon = this.createTrafficLightIcon(light.currentState, light.maintenanceMode)
          marker.setIcon(icon)
        }, 30000) // 30 segundos
      }
    })

    // Actualizar contadores de congestión
    this.animateCongestionUpdate("high-count", 8)
    this.animateCongestionUpdate("medium-count", 5)
    this.animateCongestionUpdate("low-count", 2)
  }

  returnToNormal() {
    // Restaurar indicador de hora normal
    const peakIndicator = document.getElementById("peak-hour")
    peakIndicator.innerHTML = '<span class="peak-status">Hora Normal</span>'

    // Restaurar botón original
    const simulateBtn = document.getElementById("simulate-peak")
    simulateBtn.textContent = "⚡ Simular Hora Pico"
    simulateBtn.onclick = () => this.simulatePeakHour()

    // Restaurar niveles de congestión normales
    this.animateCongestionUpdate("high-count", 2)
    this.animateCongestionUpdate("medium-count", 3)
    this.animateCongestionUpdate("low-count", 8)

    this.addActivity("Sistema regresó a operación normal", "Usuario")
  }

  simulateSecurityAttack() {
    this.addActivity("🚨 ATAQUE DETECTADO: Intento de inyección SQL", "Sistema de Seguridad")
    
    // Simular efectos visuales del ataque
    this.showAttackEffects()
    
    // Simular respuesta del sistema
    setTimeout(() => {
      this.addActivity("🛡️ DEFENSA ACTIVADA: Rate limiting aplicado", "Sistema de Seguridad")
      this.addActivity("🔒 BLOQUEO: IP maliciosa bloqueada", "Sistema de Seguridad")
      this.addActivity("📊 LOG: Evento registrado en logs de seguridad", "Sistema de Seguridad")
    }, 2000)

    // Mostrar notificación de seguridad
    this.showSecurityNotification()
  }

  showAttackEffects() {
    // Efecto visual en el mapa
    const mapContainer = document.getElementById('map')
    mapContainer.style.animation = 'shake 0.5s ease-in-out'
    
    // Efecto en el header
    const header = document.querySelector('.header')
    header.style.animation = 'glow 1s ease-in-out'
    
    // Restaurar estilos después de la animación
    setTimeout(() => {
      mapContainer.style.animation = ''
      header.style.animation = ''
    }, 1000)

    // Simular cambio de estado en algunos semáforos
    this.markers.forEach((marker, lightId) => {
      if (Math.random() < 0.3) { // 30% de probabilidad
        const light = this.trafficLights.get(lightId)
        if (light) {
          // Cambiar temporalmente a modo mantenimiento
          const originalState = light.currentState
          const originalMaintenance = light.maintenanceMode
          
          light.maintenanceMode = true
          const icon = this.createTrafficLightIcon(light.currentState, true)
          marker.setIcon(icon)
          
          // Restaurar después de 5 segundos
          setTimeout(() => {
            light.maintenanceMode = originalMaintenance
            const icon = this.createTrafficLightIcon(originalState, originalMaintenance)
            marker.setIcon(icon)
          }, 5000)
        }
      }
    })
  }

  showSecurityNotification() {
    const notification = document.createElement("div")
    notification.style.cssText = `
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc2626;
      color: white;
      padding: 2rem 3rem;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      z-index: 4000;
      font-weight: 900;
      text-align: center;
      font-size: 24px;
      letter-spacing: 2px;
      max-width: 700px;
      font-family: Arial, sans-serif;
      border: 3px solid #991b1b;
    `
    notification.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
        <div style="font-size: 32px; font-weight: 900;">
          🛡️ ATAQUE BLOQUEADO 🛡️
        </div>
        <div style="font-size: 20px; font-weight: 700;">
          Sistema de Seguridad Activo
        </div>
      </div>
    `
    document.body.appendChild(notification)

    // Remover después de 5 segundos
    setTimeout(() => {
      notification.style.opacity = '0'
      notification.style.transform = 'translateX(-50%) translateY(-20px)'
      setTimeout(() => {
        notification.remove()
      }, 300)
    }, 5000)
  }

  async getAuthToken() {
    try {
      const response = await fetch("http://localhost:3001/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ui-client" }),
      })
      const data = await response.json()
      return data.token
    } catch (error) {
      console.error("Error getting auth token:", error)
      return null
    }
  }

  startPeriodicUpdates() {
    // Update priorities every 10 seconds
    setInterval(async () => {
      await this.updatePriorities()
    }, 10000)

    // Update congestion levels every 15 seconds
    setInterval(async () => {
      await this.updateCongestionLevels()
    }, 15000)

    // Update charts every 5 seconds
    setInterval(() => {
      this.updateCharts()
    }, 5000)
  }

  async updatePriorities() {
    try {
      const token = await this.getAuthToken()
      if (!token) return

      const response = await fetch("http://localhost:3003/api/priorities", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        this.displayPriorities(data.priorities)
      }
    } catch (error) {
      console.error("Error updating priorities:", error)
    }
  }

  displayPriorities(priorities) {
    const priorityList = document.getElementById("priority-list")

    if (!priorities || priorities.length === 0) {
      priorityList.innerHTML = '<div class="no-data">Sin prioridades activas</div>'
      return
    }

    priorityList.innerHTML = priorities
      .slice(0, 5)
      .map((priority) => {
        const urgencyClass = priority.urgent
          ? "urgent"
          : priority.priority > 70
            ? "high"
            : priority.priority > 40
              ? "medium"
              : "low"

        return `
                <div class="priority-item ${urgencyClass}">
                    <div class="priority-info">
                        <div class="priority-name">${priority.intersectionName}</div>
                        <div class="priority-details">
                            ${priority.currentState} → ${priority.requestedState} | 
                            ${Math.round(priority.timeToDeadline / 1000)}s restantes
                        </div>
                    </div>
                    <div class="priority-score">${priority.priority}</div>
                </div>
            `
      })
      .join("")
  }

  async updateCongestionLevels() {
    try {
      const token = await this.getAuthToken()
      if (!token) return

      const response = await fetch("http://localhost:3002/api/analysis", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        this.displayCongestionLevels(data.summary)
      }
    } catch (error) {
      console.error("Error updating congestion levels:", error)
    }
  }

  displayCongestionLevels(summary) {
    if (!summary) return

    // Animate congestion level updates
    this.animateCongestionUpdate("critical-count", summary.critical || 0)
    this.animateCongestionUpdate("high-count", summary.high || 0)
    this.animateCongestionUpdate("medium-count", summary.medium || 0)
    this.animateCongestionUpdate("low-count", summary.low || 0)
  }

  animateCongestionUpdate(elementId, newValue) {
    const element = document.getElementById(elementId)
    const currentValue = parseInt(element.textContent) || 0
    
    if (currentValue !== newValue) {
      element.style.transform = 'scale(1.2)'
      element.style.color = '#48bb78'
      element.textContent = newValue
      
      setTimeout(() => {
        element.style.transform = 'scale(1)'
        element.style.color = ''
      }, 300)
    }
  }

  formatUptime(uptimeMs) {
    if (!uptimeMs) return "-"

    const seconds = Math.floor(uptimeMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m`
    return `${seconds}s`
  }

  getVehicleIcons(congestionLevel) {
    const icons = {
      low: '<i class="fas fa-car vehicle-icon car"></i><i class="fas fa-motorcycle vehicle-icon motorcycle"></i>',
      medium: '<i class="fas fa-car vehicle-icon car"></i><i class="fas fa-car vehicle-icon car"></i><i class="fas fa-bus vehicle-icon bus"></i>',
      high: '<i class="fas fa-car vehicle-icon car"></i><i class="fas fa-car vehicle-icon car"></i><i class="fas fa-bus vehicle-icon bus"></i><i class="fas fa-motorcycle vehicle-icon motorcycle"></i>',
      critical: '<i class="fas fa-car vehicle-icon car"></i><i class="fas fa-car vehicle-icon car"></i><i class="fas fa-bus vehicle-icon bus"></i><i class="fas fa-bus vehicle-icon bus"></i><i class="fas fa-motorcycle vehicle-icon motorcycle"></i>'
    }
    return icons[congestionLevel] || '<i class="fas fa-car vehicle-icon car"></i>'
  }

  showError(message) {
    // Enhanced error notification with animation
    const notification = document.createElement("div")
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #f56565, #e53e3e);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(245, 101, 101, 0.3);
            z-index: 4000;
            font-weight: 500;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            border-left: 4px solid #fff;
        `
    notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
            </div>
        `
    document.body.appendChild(notification)

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)'
    }, 100)

    // Animate out and remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)'
    setTimeout(() => {
      notification.remove()
      }, 300)
    }, 5000)
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new TrafficControlApp()
})
