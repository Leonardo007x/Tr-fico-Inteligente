# Sistema de Control de Tráfico Inteligente - Popayán

Este proyecto simula un sistema de control de tráfico inteligente para la ciudad de Popayán utilizando el algoritmo EDF (Earliest Deadline First) para optimizar el flujo vehicular.

## 🏗️ Arquitectura

El sistema está compuesto por 5 microservicios:

- **Ingestor**: Genera datos simulados de tráfico vehicular
- **Analyzer**: Analiza la densidad de tráfico por intersección
- **Scheduler**: Implementa el algoritmo EDF para priorizar semáforos
- **Controller**: Controla el estado de los semáforos en tiempo real
- **UI**: Interfaz web con mapa interactivo de Popayán

## 🚀 Instalación y Ejecución

### Requisitos Previos

- Docker Desktop (Windows/Mac) o Docker Engine (Linux)
- Docker Compose
- WSL2 (para Windows)

### Pasos para Ejecutar

1. Clona o descarga el proyecto
2. Abre una terminal en la carpeta raíz del proyecto
3. Ejecuta el siguiente comando:

\`\`\`bash
docker-compose up --build
\`\`\`

4. Espera a que todos los servicios se inicien
5. Abre tu navegador y ve a: http://localhost:3000

## 🌐 Puertos de los Servicios

- UI: http://localhost:3000
- Ingestor: http://localhost:3001
- Analyzer: http://localhost:3002
- Scheduler: http://localhost:3003
- Controller: http://localhost:3004

## 📱 Uso de la Aplicación

1. La interfaz muestra un mapa de Popayán con semáforos marcados
2. Los semáforos cambian de color según el algoritmo EDF:
   - 🔴 Rojo: Detenido
   - 🟡 Ámbar: Precaución
   - 🟢 Verde: Paso libre
3. El panel lateral muestra métricas en tiempo real:
   - Flujo vehicular simulado
   - Deadlines cumplidos/fallidos
   - Estados actuales de semáforos

## 🔒 Seguridad

El sistema implementa múltiples capas de seguridad:

- **Autenticación JWT** para las comunicaciones entre microservicios
- **AppArmor** para control de acceso obligatorio en contenedores Linux
- **Perfiles de seguridad** específicos para cada microservicio
- **Pruebas de penetración** automatizadas

Ver `/docs/seguridad.md` y `/docs/apparmor-implementacion.md` para más detalles.

## 🧪 Pruebas

Ver `/docs/pruebas.md` para información sobre simulaciones y pruebas de rendimiento.

## 📚 Documentación Adicional

- [Arquitectura del Sistema](./docs/arquitectura.md)
- [Configuración de Seguridad](./docs/seguridad.md)
- [Guía de Pruebas](./docs/pruebas.md)

## 🐧 Migración a Linux

Para usar AppArmor en producción:

1. Instala Docker en Ubuntu/Debian:
\`\`\`bash
sudo apt update
sudo apt install docker.io docker-compose apparmor-utils
\`\`\`

2. Instala los perfiles de AppArmor:
```bash
./security/install-apparmor.sh
```

3. Verifica la instalación:
```bash
./validate-apparmor.sh
```

Ver `/docs/apparmor-implementacion.md` para documentación completa.

## 🛠️ Desarrollo

Cada microservicio tiene su propio README.md con instrucciones específicas de desarrollo.

## 📄 Licencia

Este proyecto es para fines educativos y de demostración.
