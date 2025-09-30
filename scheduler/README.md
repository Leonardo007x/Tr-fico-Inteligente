# Scheduler EDF

Este microservicio implementa el algoritmo Earliest Deadline First (EDF) para determinar la prioridad de los semáforos.

## Funcionalidad

- Implementa algoritmo EDF para scheduling de semáforos
- Calcula deadlines basados en densidad de tráfico
- Optimiza flujo vehicular
- Envía decisiones al controlador

## Algoritmo EDF

El algoritmo EDF prioriza las tareas (cambios de semáforo) con deadline más próximo:
1. Recibe datos de densidad del analyzer
2. Calcula deadline para cada intersección
3. Ordena por prioridad (deadline más cercano primero)
4. Envía decisión al controller

## Endpoints

- `GET /api/schedule` - Obtiene programación actual
- `GET /api/priorities` - Lista prioridades de intersecciones
- `POST /api/calculate` - Ejecuta cálculo EDF

## Desarrollo Local

\`\`\`bash
npm install
npm run dev
\`\`\`

El servicio estará disponible en http://localhost:3003
