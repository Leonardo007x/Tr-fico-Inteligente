# Analizador de Tráfico

Este microservicio analiza los datos de tráfico recibidos del ingestor y calcula la densidad vehicular por intersección.

## Funcionalidad

- Recibe datos del servicio ingestor
- Calcula densidad de tráfico por intersección
- Determina niveles de congestión
- Envía resultados al scheduler

## Endpoints

- `GET /api/analysis` - Obtiene análisis actual
- `GET /api/density/:intersection` - Densidad de una intersección específica
- `POST /api/analyze` - Ejecuta análisis manual

## Desarrollo Local

\`\`\`bash
npm install
npm run dev
\`\`\`

El servicio estará disponible en http://localhost:3002
