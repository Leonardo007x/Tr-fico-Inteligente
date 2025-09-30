# Ingestor de Datos de Tráfico

Este microservicio genera datos simulados de tráfico vehicular para las intersecciones de Popayán.

## Funcionalidad

- Genera datos aleatorios de conteo vehicular
- Simula diferentes niveles de tráfico según la hora del día
- Expone API REST para consultar datos
- Implementa WebSocket para datos en tiempo real

## Endpoints

- `GET /api/traffic-data` - Obtiene datos actuales de tráfico
- `GET /api/intersections` - Lista todas las intersecciones
- `WebSocket /ws` - Datos en tiempo real

## Desarrollo Local

\`\`\`bash
npm install
npm run dev
\`\`\`

El servicio estará disponible en http://localhost:3001
