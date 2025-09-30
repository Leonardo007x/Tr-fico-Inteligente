# Controlador de Semáforos

Este microservicio controla el estado de los semáforos basado en las decisiones del scheduler.

## Funcionalidad

- Recibe decisiones del scheduler
- Controla estados de semáforos (rojo, ámbar, verde)
- Expone WebSocket para comunicación en tiempo real con UI
- Mantiene historial de cambios

## Estados de Semáforo

- `red`: Detenido
- `amber`: Precaución
- `green`: Paso libre

## Endpoints

- `GET /api/traffic-lights` - Estado actual de todos los semáforos
- `GET /api/traffic-lights/:id` - Estado de un semáforo específico
- `WebSocket /ws` - Actualizaciones en tiempo real

## Desarrollo Local

\`\`\`bash
npm install
npm run dev
\`\`\`

El servicio estará disponible en http://localhost:3004
