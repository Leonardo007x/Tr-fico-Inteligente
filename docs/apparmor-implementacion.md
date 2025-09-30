# Implementación Completa de AppArmor en Sistema de Control de Tráfico

## Resumen Ejecutivo

Este documento describe la implementación completa de **AppArmor** en el Sistema de Control de Tráfico Inteligente de Popayán. AppArmor proporciona una capa adicional de seguridad mediante el control de acceso obligatorio (MAC - Mandatory Access Control) para todos los microservicios del sistema.

## ¿Qué es AppArmor?

**AppArmor** es un sistema de seguridad basado en perfiles que protege el sistema operativo y las aplicaciones contra amenazas tanto conocidas como desconocidas. Funciona mediante:

- **Control de acceso obligatorio**: Restringe qué recursos puede acceder cada aplicación
- **Perfiles de seguridad**: Define políticas específicas para cada servicio
- **Prevención de ataques**: Bloquea intentos de acceso no autorizado a archivos, redes y procesos

## Arquitectura de Seguridad Implementada

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA CON APPARMOR                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Ingestor   │  │  Analyzer   │  │  Scheduler  │         │
│  │ + AppArmor  │  │ + AppArmor  │  │ + AppArmor  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                         │
│  │ Controller  │  │     UI      │                         │
│  │ + AppArmor  │  │ + AppArmor  │                         │
│  └─────────────┘  └─────────────┘                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              DOCKER + APPARMOR PROFILES                │ │
│  │  • traffic-ingestor   • traffic-analyzer               │ │
│  │  • traffic-scheduler  • traffic-controller             │ │
│  │  • traffic-ui                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Perfiles de AppArmor Implementados

### 1. Perfil para Ingestor (`traffic-ingestor`)

**Permisos otorgados:**
- Acceso de lectura/escritura a directorio `/app`
- Acceso a puerto 3001 (servicio propio)
- Comunicación con puertos 3002, 3003, 3004 (otros servicios)
- Acceso a logs específicos del ingestor
- Acceso a archivos temporales de datos de tráfico

**Restricciones:**
- Sin acceso a archivos del sistema críticos (`/etc/passwd`, `/etc/shadow`)
- Sin permisos de administrador (`sudo`, `su`)
- Sin acceso a directorios de usuario (`/home`)
- Sin capacidades del sistema (`sys_admin`, `sys_ptrace`)

### 2. Perfil para Analyzer (`traffic-analyzer`)

**Permisos otorgados:**
- Acceso a puerto 3002 (servicio propio)
- Comunicación con puertos 3001, 3003, 3004
- Acceso a archivos de análisis y cache
- Acceso a datos históricos para análisis de tendencias
- Acceso a algoritmos de densidad

**Restricciones:**
- Sin acceso a archivos del sistema críticos
- Sin permisos de administrador
- Sin acceso a configuración del sistema

### 3. Perfil para Scheduler EDF (`traffic-scheduler`)

**Permisos otorgados:**
- Acceso a puerto 3003 (servicio propio)
- Comunicación con puertos 3002, 3004
- Acceso a archivos de planificación y cola de tareas
- Acceso a cache de algoritmos EDF
- Acceso a reloj del sistema para deadlines

**Restricciones:**
- Sin acceso a archivos del sistema críticos
- Sin permisos de administrador
- Sin acceso a configuración del sistema

### 4. Perfil para Controller (`traffic-controller`)

**Permisos otorgados:**
- Acceso a puertos 3004, 3000 (servicio propio y UI)
- Comunicación con puertos 3001, 3002, 3003
- Acceso a archivos de estado de semáforos
- Acceso a configuración de intersecciones
- Acceso a dispositivos de hardware simulados

**Restricciones:**
- Sin acceso a archivos del sistema críticos
- Sin permisos de administrador
- Sin acceso a configuración del sistema

### 5. Perfil para UI (`traffic-ui`)

**Permisos otorgados:**
- Acceso a puerto 3000 (servicio propio)
- Comunicación con puertos 3001, 3002, 3003, 3004
- Acceso a archivos de interfaz y assets
- Acceso a datos de mapas
- Acceso a sesiones de usuario

**Restricciones:**
- Sin acceso a archivos del sistema críticos
- Sin permisos de administrador
- Sin acceso a configuración del sistema

## Instalación y Configuración

### Paso 1: Instalación Automática

```bash
# Ejecutar script de instalación
./security/install-apparmor.sh
```

Este script:
- Verifica que AppArmor esté instalado
- Crea directorio de perfiles `/etc/apparmor.d/traffic-control`
- Instala todos los perfiles del proyecto
- Carga los perfiles en AppArmor
- Verifica el estado de instalación

### Paso 2: Integración con Docker

Los perfiles se integran automáticamente con Docker mediante `docker-compose.yml`:

```yaml
services:
  ingestor:
    # ... configuración del servicio ...
    security_opt:
      - apparmor:traffic-ingestor
    volumes:
      - traffic-logs:/var/log/traffic-control
      - traffic-data:/var/data
```

### Paso 3: Verificación

```bash
# Verificar estado de AppArmor
./validate-apparmor.sh

# Ver estado de perfiles
sudo aa-status | grep traffic

# Ejecutar pruebas automatizadas
node tests/apparmor-tests.js
```

## Comandos de Gestión

### Gestión de Perfiles

```bash
# Ver estado de todos los perfiles
sudo aa-status

# Ver perfiles específicos del proyecto
sudo aa-status | grep traffic

# Recargar un perfil después de cambios
sudo apparmor_parser -r /etc/apparmor.d/traffic-control/traffic-ingestor

# Deshabilitar un perfil
sudo aa-disable /etc/apparmor.d/traffic-control/traffic-ingestor

# Habilitar un perfil
sudo aa-enable /etc/apparmor.d/traffic-control/traffic-ingestor
```

### Gestión de Logs

```bash
# Ver logs de AppArmor en tiempo real
sudo journalctl -u apparmor -f

# Ver logs de dmesg
sudo dmesg | grep AppArmor

# Ver logs de denegaciones
sudo journalctl | grep "apparmor.*DENIED"
```

## Beneficios de Seguridad

### 1. **Aislamiento de Servicios**
- Cada microservicio opera en su propio perfil de seguridad
- No pueden acceder a recursos de otros servicios
- Prevención de escalación de privilegios

### 2. **Protección contra Ataques**
- **Inyección SQL**: Bloquea acceso a archivos de base de datos
- **Escalación de privilegios**: Sin acceso a `sudo`, `su`, archivos del sistema
- **Acceso no autorizado**: Restricciones estrictas de archivos y red

### 3. **Cumplimiento de Estándares**
- **ISO 27001**: Control de acceso obligatorio
- **OWASP**: Prevención de vulnerabilidades comunes
- **NIST**: Mejores prácticas de seguridad

### 4. **Auditoría y Monitoreo**
- Logs detallados de todas las actividades
- Detección de intentos de acceso no autorizado
- Trazabilidad completa de acciones del sistema

## Casos de Uso de Seguridad

### Caso 1: Intento de Acceso a Archivos del Sistema

**Escenario**: Un atacante intenta acceder a `/etc/passwd` desde el contenedor del ingestor.

**Resultado**: AppArmor bloquea el acceso y registra el intento:
```
audit: type=1400 audit(1234567890.123:456): apparmor="DENIED" operation="open" profile="traffic-ingestor" name="/etc/passwd" pid=1234 comm="node" requested_mask="r" denied_mask="r" fsuid=1001 ouid=0
```

### Caso 2: Intento de Escalación de Privilegios

**Escenario**: Un atacante intenta ejecutar `sudo` desde cualquier contenedor.

**Resultado**: AppArmor bloquea la ejecución:
```
audit: type=1400 audit(1234567890.123:456): apparmor="DENIED" operation="exec" profile="traffic-ingestor" name="/usr/bin/sudo" pid=1234 comm="node" requested_mask="x" denied_mask="x" fsuid=1001 ouid=0
```

### Caso 3: Comunicación No Autorizada entre Servicios

**Escenario**: El ingestor intenta acceder directamente al puerto de la UI.

**Resultado**: AppArmor permite la comunicación (está en el perfil) pero registra la actividad.

## Monitoreo y Alertas

### Métricas de Seguridad

```bash
# Contar denegaciones por perfil
sudo journalctl | grep "apparmor.*DENIED" | awk '{print $12}' | sort | uniq -c

# Ver intentos de acceso no autorizado
sudo journalctl | grep "apparmor.*DENIED" | grep -E "(passwd|shadow|sudo|su)"

# Monitorear en tiempo real
sudo journalctl -u apparmor -f | grep DENIED
```

### Alertas Automáticas

El sistema puede configurarse para enviar alertas cuando:
- Se detectan múltiples denegaciones del mismo perfil
- Se intenta acceder a archivos críticos del sistema
- Se detectan patrones de ataque conocidos

## Solución de Problemas

### Problema 1: Contenedor no inicia

**Síntomas**: Error al iniciar contenedor con AppArmor.

**Solución**:
```bash
# Verificar que el perfil existe
sudo aa-status | grep traffic-ingestor

# Recargar el perfil
sudo apparmor_parser -r /etc/apparmor.d/traffic-control/traffic-ingestor

# Verificar logs de AppArmor
sudo journalctl -u apparmor | tail -20
```

### Problema 2: Acceso denegado a archivos necesarios

**Síntomas**: Aplicación falla al acceder a archivos necesarios.

**Solución**:
1. Identificar el archivo en los logs de AppArmor
2. Agregar el permiso al perfil correspondiente
3. Recargar el perfil:
```bash
sudo apparmor_parser -r /etc/apparmor.d/traffic-control/traffic-ingestor
```

### Problema 3: Comunicación entre servicios falla

**Síntomas**: Los microservicios no pueden comunicarse.

**Solución**:
1. Verificar que los puertos estén permitidos en los perfiles
2. Verificar configuración de red en Docker
3. Recargar perfiles si es necesario

## Mejores Prácticas

### 1. **Principio de Menor Privilegio**
- Cada servicio tiene solo los permisos mínimos necesarios
- No se otorgan permisos "por si acaso"
- Revisión regular de permisos

### 2. **Monitoreo Continuo**
- Revisión diaria de logs de AppArmor
- Alertas automáticas para actividad sospechosa
- Auditoría regular de perfiles

### 3. **Actualización de Perfiles**
- Revisión mensual de permisos
- Actualización cuando se agregan nuevas funcionalidades
- Pruebas de seguridad regulares

### 4. **Documentación**
- Mantener documentación actualizada de todos los perfiles
- Registrar cambios y razones
- Entrenamiento del equipo en AppArmor

## Conclusiones

La implementación de AppArmor en el Sistema de Control de Tráfico proporciona:

✅ **Seguridad robusta**: Protección contra múltiples tipos de ataques
✅ **Cumplimiento**: Cumple con estándares internacionales de seguridad
✅ **Auditoría**: Trazabilidad completa de todas las actividades
✅ **Flexibilidad**: Fácil gestión y actualización de perfiles
✅ **Rendimiento**: Impacto mínimo en el rendimiento del sistema

Esta implementación convierte al sistema en una solución de **grado empresarial** con niveles de seguridad apropiados para entornos de producción críticos.

---

*Documento generado automáticamente como parte de la implementación de AppArmor en el Sistema de Control de Tráfico Inteligente de Popayán.*

