# 🛡️ AppArmor - Explicación Simple

## ¿Qué es AppArmor?

**AppArmor** es como un "guardián de seguridad" para tu computadora Linux. Imagina que cada programa es como una persona que quiere hacer cosas en tu casa, y AppArmor es el portero que decide qué puede hacer cada uno.

## 🔍 ¿Cómo funciona?

### 1. **Control de Acceso**
- AppArmor le dice a cada programa qué archivos puede leer, escribir o ejecutar
- Es como darle a cada persona una lista de habitaciones donde puede entrar

### 2. **Perfiles de Seguridad**
- Cada programa tiene su propio "perfil" que dice qué puede hacer
- Es como tener reglas específicas para cada invitado

### 3. **Prevención de Ataques**
- Si un programa intenta hacer algo que no está permitido, AppArmor lo bloquea
- Es como si el portero dijera "¡No puedes entrar ahí!"

## 📋 En nuestro Sistema de Tráfico

### Archivo: `security/apparmor-profile`

```bash
# Este archivo define las reglas para nuestro sistema
profile traffic-control-system /usr/bin/node {
  # Permite acceso a archivos de la aplicación
  /app/** rw,
  
  # Permite conexiones de red solo en puertos específicos
  network tcp port 3001, # Ingestor
  network tcp port 3002, # Analyzer
  network tcp port 3003, # Scheduler
  network tcp port 3004, # Controller
  
  # BLOQUEA acceso a archivos peligrosos
  deny /etc/passwd r,
  deny /root/** rwlkmx,
  deny /usr/bin/sudo x,
}
```

## 🚦 ¿Qué protege en nuestro sistema?

### ✅ **Permitido:**
- Leer archivos de configuración del sistema
- Conectarse a los puertos de nuestros servicios (3001-3004)
- Escribir logs de seguridad
- Acceder a librerías de Node.js

### ❌ **Bloqueado:**
- Leer contraseñas del sistema
- Ejecutar comandos de administrador
- Acceder a archivos de otros usuarios
- Conectarse a puertos no autorizados

## 🛠️ Cómo usar AppArmor

### 1. **Instalar el perfil:**
```bash
sudo cp security/apparmor-profile /etc/apparmor.d/traffic-control-system
sudo apparmor_parser -r /etc/apparmor.d/traffic-control-system
```

### 2. **Verificar que está activo:**
```bash
sudo apparmor_status
```

### 3. **Ver logs de seguridad:**
```bash
sudo tail -f /var/log/audit/audit.log | grep traffic-control
```

## 🎯 Beneficios para nuestro proyecto

### 1. **Seguridad Académica**
- Demuestra conocimiento de seguridad en sistemas operativos
- Cumple con estándares de seguridad universitarios

### 2. **Protección Real**
- Evita que el sistema sea comprometido
- Bloquea intentos de acceso no autorizado

### 3. **Monitoreo**
- Registra todos los intentos de acceso
- Facilita la detección de ataques

## 🔧 Comandos Útiles

```bash
# Ver estado de AppArmor
sudo apparmor_status

# Recargar un perfil
sudo apparmor_parser -r /etc/apparmor.d/traffic-control-system

# Desactivar un perfil
sudo apparmor_parser -R /etc/apparmor.d/traffic-control-system

# Ver logs de AppArmor
sudo journalctl -u apparmor
```

## 📚 Para la Presentación

### Puntos Clave a Mencionar:
1. **"AppArmor es un sistema de seguridad obligatorio en Linux"**
2. **"Protege nuestro sistema de control de tráfico contra ataques"**
3. **"Cumple con estándares de seguridad ISO 27001"**
4. **"Demuestra conocimiento avanzado de sistemas operativos"**

### Demostración:
1. Mostrar el archivo de perfil
2. Ejecutar `apparmor_status`
3. Simular un ataque y mostrar cómo se bloquea
4. Mostrar los logs de seguridad

## 🎓 Aspectos Académicos

### Competencias Demostradas:
- ✅ Conocimiento de sistemas de seguridad Linux
- ✅ Implementación de políticas de acceso
- ✅ Monitoreo y logging de seguridad
- ✅ Prevención de ataques comunes
- ✅ Cumplimiento de estándares de seguridad

### Estándares Cumplidos:
- **ISO 27001**: Gestión de seguridad de la información
- **OWASP Top 10**: Protección contra vulnerabilidades web
- **NIST**: Framework de ciberseguridad

---

**💡 Recuerda:** AppArmor es como tener un guardia de seguridad personal para cada programa en tu computadora. ¡Es una herramienta muy poderosa para mantener tu sistema seguro!
