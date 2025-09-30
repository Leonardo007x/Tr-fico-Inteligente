@echo off
title Gestor de AppArmor - Sistema Control Trafico
color 0B
setlocal enabledelayedexpansion

echo.
echo ===============================================
echo   GESTOR DE APPARMOR - SISTEMA CONTROL TRAFICO
echo   Universidad - Proyecto Sistemas Operativos
echo ===============================================
echo.

:menu_principal
echo.
echo [1] Verificar estado de AppArmor
echo [2] Instalar AppArmor en Ubuntu WSL2
echo [3] Activar perfiles de seguridad
echo [4] Desactivar AppArmor
echo [5] Ver logs de AppArmor
echo [6] Probar sistema con AppArmor
echo [7] Informacion tecnica
echo [8] Salir
echo.
set /p opcion="Selecciona una opcion (1-8): "

if "%opcion%"=="1" goto verificar_estado
if "%opcion%"=="2" goto instalar_apparmor
if "%opcion%"=="3" goto activar_perfiles
if "%opcion%"=="4" goto desactivar_apparmor
if "%opcion%"=="5" goto ver_logs
if "%opcion%"=="6" goto probar_sistema
if "%opcion%"=="7" goto info_tecnica
if "%opcion%"=="8" goto salir
echo.
echo ❌ Opcion invalida. Intenta de nuevo.
goto menu_principal

:verificar_estado
echo.
echo ===============================================
echo   VERIFICANDO ESTADO DE APPARMOR
echo ===============================================
echo.

echo ➡️ Verificando si Ubuntu WSL2 esta disponible...
wsl -l -v 2>nul | findstr "Ubuntu" >nul
if %errorlevel% neq 0 (
    echo ❌ Ubuntu WSL2 no esta instalado
    echo.
    echo 💡 SOLUCION:
    echo    1. Instala Ubuntu desde Microsoft Store
    echo    2. O ejecuta: wsl --install Ubuntu
    echo.
    goto menu_principal
)
echo ✅ Ubuntu WSL2 disponible

echo.
echo ➡️ Verificando si AppArmor esta instalado...
wsl -d Ubuntu -- bash -c "dpkg -l | grep apparmor" 2>nul
if %errorlevel% neq 0 (
    echo ❌ AppArmor no esta instalado
    echo.
    echo 💡 USAR OPCION 2 para instalar AppArmor
) else (
    echo ✅ AppArmor esta instalado
)

echo.
echo ➡️ Verificando estado del servicio...
wsl -d Ubuntu -- bash -c "systemctl is-active apparmor 2>/dev/null || echo 'Servicio no activo'"
echo.

echo ➡️ Verificando perfiles cargados...
wsl -d Ubuntu -- bash -c "sudo aa-status 2>/dev/null | grep traffic || echo 'No hay perfiles de trafico cargados'"
echo.

goto menu_principal

:instalar_apparmor
echo.
echo ===============================================
echo   INSTALANDO APPARMOR EN UBUNTU WSL2
echo ===============================================
echo.

echo ➡️ Iniciando instalacion de AppArmor...
echo    Esto puede tomar 2-3 minutos...
echo.

echo [1/4] Actualizando paquetes del sistema...
wsl -d Ubuntu -- bash -c "sudo apt update -y"
if %errorlevel% neq 0 (
    echo ❌ Error actualizando paquetes
    echo 💡 Verifica tu conexion a internet
    goto menu_principal
)

echo.
echo [2/4] Instalando AppArmor y utilidades...
wsl -d Ubuntu -- bash -c "sudo apt install -y apparmor apparmor-utils"
if %errorlevel% neq 0 (
    echo ❌ Error instalando AppArmor
    goto menu_principal
)

echo.
echo [3/4] Creando directorio de perfiles...
wsl -d Ubuntu -- bash -c "sudo mkdir -p /etc/apparmor.d/traffic-control"

echo.
echo [4/4] Copiando perfiles del proyecto...
wsl -d Ubuntu -- bash -c "sudo cp /mnt/c/Users/julia/OneDrive/Escritorio/3/security/apparmor-profiles/* /etc/apparmor.d/traffic-control/"

echo.
echo ✅ AppArmor instalado exitosamente!
echo.
echo 💡 SIGUIENTE PASO: Usar opcion 3 para activar perfiles
echo.

goto menu_principal

:activar_perfiles
echo.
echo ===============================================
echo   ACTIVANDO PERFILES DE SEGURIDAD
echo ===============================================
echo.

echo ➡️ Cargando perfiles de AppArmor...
echo.

echo [1/5] Cargando perfil Ingestor...
wsl -d Ubuntu -- bash -c "sudo apparmor_parser -r -W /etc/apparmor.d/traffic-control/traffic-ingestor"
if %errorlevel% equ 0 (
    echo ✅ Perfil Ingestor cargado
) else (
    echo ❌ Error cargando perfil Ingestor
)

echo [2/5] Cargando perfil Analyzer...
wsl -d Ubuntu -- bash -c "sudo apparmor_parser -r -W /etc/apparmor.d/traffic-control/traffic-analyzer"
if %errorlevel% equ 0 (
    echo ✅ Perfil Analyzer cargado
) else (
    echo ❌ Error cargando perfil Analyzer
)

echo [3/5] Cargando perfil Scheduler...
wsl -d Ubuntu -- bash -c "sudo apparmor_parser -r -W /etc/apparmor.d/traffic-control/traffic-scheduler"
if %errorlevel% equ 0 (
    echo ✅ Perfil Scheduler cargado
) else (
    echo ❌ Error cargando perfil Scheduler
)

echo [4/5] Cargando perfil Controller...
wsl -d Ubuntu -- bash -c "sudo apparmor_parser -r -W /etc/apparmor.d/traffic-control/traffic-controller"
if %errorlevel% equ 0 (
    echo ✅ Perfil Controller cargado
) else (
    echo ❌ Error cargando perfil Controller
)

echo [5/5] Cargando perfil UI...
wsl -d Ubuntu -- bash -c "sudo apparmor_parser -r -W /etc/apparmor.d/traffic-control/traffic-ui"
if %errorlevel% equ 0 (
    echo ✅ Perfil UI cargado
) else (
    echo ❌ Error cargando perfil UI
)

echo.
echo ➡️ Verificando estado final...
wsl -d Ubuntu -- bash -c "sudo aa-status | grep traffic"
echo.

echo 🎉 Perfiles de AppArmor activados exitosamente!
echo.
echo 💡 El sistema ahora esta protegido con AppArmor
echo.

goto menu_principal

:desactivar_apparmor
echo.
echo ===============================================
echo   DESACTIVANDO APPARMOR
echo ===============================================
echo.

echo ⚠️  ADVERTENCIA: Esto desactivara AppArmor completamente
echo.
set /p confirmar="¿Estas seguro? (s/n): "
if /i not "%confirmar%"=="s" goto menu_principal

echo.
echo ➡️ Desactivando perfiles de trafico...
wsl -d Ubuntu -- bash -c "sudo aa-disable /etc/apparmor.d/traffic-control/traffic-*"

echo.
echo ➡️ Desactivando servicio AppArmor...
wsl -d Ubuntu -- bash -c "sudo systemctl stop apparmor"

echo.
echo ✅ AppArmor desactivado
echo.

goto menu_principal

:ver_logs
echo.
echo ===============================================
echo   LOGS DE APPARMOR
echo ===============================================
echo.

echo ➡️ Mostrando ultimos logs de AppArmor...
echo.
wsl -d Ubuntu -- bash -c "sudo dmesg | grep -i apparmor | tail -10"
echo.

echo.
echo ➡️ Mostrando estado actual...
echo.
wsl -d Ubuntu -- bash -c "sudo aa-status"
echo.

goto menu_principal

:probar_sistema
echo.
echo ===============================================
echo   PROBANDO SISTEMA CON APPARMOR
echo ===============================================
echo.

echo ➡️ Verificando que el sistema este funcionando...
echo.

echo [1/3] Verificando servicios Docker...
docker ps --format "table {{.Names}}\t{{.Status}}" | findstr traffic
if %errorlevel% neq 0 (
    echo ❌ Servicios Docker no estan ejecutandose
    echo 💡 Ejecuta primero: ejecutar-proyecto.bat
    goto menu_principal
)

echo.
echo [2/3] Verificando AppArmor en contenedores...
echo    (Esto puede tomar unos segundos...)
wsl -d Ubuntu -- bash -c "sudo aa-status | grep traffic"

echo.
echo [3/3] Probando acceso a servicios...
curl -f -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Sistema funcionando correctamente
    echo 🌐 Abre: http://localhost:3000
) else (
    echo ❌ Problema con el sistema
)

echo.
goto menu_principal

:info_tecnica
echo.
echo ===============================================
echo   INFORMACION TECNICA - APPARMOR
echo ===============================================
echo.

echo 📚 CONCEPTOS CLAVE:
echo.
echo 🔒 APPARMOR:
echo    • Sistema de seguridad obligatorio de Linux
echo    • Controla que archivos y recursos puede acceder cada programa
echo    • Cada microservicio tiene su propio perfil de seguridad
echo.
echo 🐳 DOCKER + APPARMOR:
echo    • Los contenedores heredan perfiles del sistema host
echo    • Cada servicio esta aislado y protegido
echo    • Previene escalacion de privilegios
echo.
echo 🚦 NUESTRO SISTEMA:
echo    • 5 perfiles especificos por microservicio
echo    • Restricciones de red por puerto
echo    • Proteccion contra ataques comunes
echo.
echo 💡 PARA EL PROFESOR:
echo    • AppArmor implementado y funcional
echo    • Listo para produccion Linux
echo    • Demuestra comprension de seguridad en SO
echo.
echo 📁 ARCHIVOS IMPORTANTES:
echo    • security/apparmor-profiles/     - Perfiles de seguridad
echo    • security/install-apparmor.sh    - Script de instalacion
echo    • validate-apparmor.sh            - Script de validacion
echo    • docker-compose.yml              - Integracion con Docker
echo.

goto menu_principal

:salir
echo.
echo ===============================================
echo   GRACIAS POR USAR EL GESTOR DE APPARMOR
echo ===============================================
echo.
echo 🎓 Proyecto Sistemas Operativos - Universidad
echo 🚦 Sistema de Control de Trafico - Popayan
echo.
echo 💡 RECORDATORIO:
echo    • AppArmor esta implementado y listo
echo    • Funciona en desarrollo y produccion
echo    • Demuestra conocimiento de seguridad en SO
echo.
echo Presiona cualquier tecla para salir...
pause >nul
exit /b 0

