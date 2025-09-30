@echo off
title Sistema Control Trafico - Popayan
color 0A

echo.
echo ===============================================
echo   SISTEMA DE CONTROL DE TRAFICO - POPAYAN
echo   Proyecto Sistemas Operativos - Universidad
echo   Con Seguridad AppArmor Integrada
echo ===============================================
echo.

:: Verificar si Docker Desktop esta ejecutandose
echo [1/5] Verificando Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Docker Desktop no esta ejecutandose
    echo.
    echo 💡 SOLUCION:
    echo    1. Abre Docker Desktop
    echo    2. Espera a que aparezca "Docker Desktop is running"
    echo    3. Ejecuta este archivo nuevamente
    echo.
    pause
    exit /b 1
)
echo ✅ Docker Desktop esta funcionando

:: Verificar si estamos en Linux o WSL2 para AppArmor
echo.
echo [2/5] Verificando compatibilidad con AppArmor...
if exist /proc/version (
    echo ✅ Ejecutandose en Linux/WSL2 - AppArmor disponible
    set "apparmor_available=1"
) else (
    echo ⚠️  Ejecutandose en Windows nativo - AppArmor no disponible
    echo    Los contenedores se ejecutaran sin AppArmor
    set "apparmor_available=0"
)

:: Limpiar contenedores anteriores
echo.
echo [3/5] Limpiando contenedores anteriores...
docker-compose down >nul 2>&1
echo ✅ Contenedores anteriores eliminados

:: Construir y ejecutar el proyecto
echo.
echo [4/5] Construyendo y ejecutando microservicios...
echo    Esto puede tomar 2-3 minutos en la primera ejecucion...
if %apparmor_available% equ 1 (
    echo    🔒 AppArmor habilitado para seguridad avanzada
) else (
    echo    ⚠️  AppArmor no disponible en este entorno
)
echo.
docker-compose up --build -d

:: Verificar que los servicios esten funcionando
echo.
echo [5/5] Verificando servicios...
timeout /t 15 /nobreak >nul

set "servicios_ok=0"
set "total_servicios=5"

:: Verificar Ingestor (puerto 3001)
curl -f -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Ingestor (puerto 3001): OK
    set /a servicios_ok+=1
) else (
    echo ❌ Ingestor (puerto 3001): NO DISPONIBLE
)

:: Verificar Analyzer (puerto 3002)
curl -f -s http://localhost:3002/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Analyzer (puerto 3002): OK
    set /a servicios_ok+=1
) else (
    echo ❌ Analyzer (puerto 3002): NO DISPONIBLE
)

:: Verificar Scheduler (puerto 3003)
curl -f -s http://localhost:3003/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Scheduler EDF (puerto 3003): OK
    set /a servicios_ok+=1
) else (
    echo ❌ Scheduler EDF (puerto 3003): NO DISPONIBLE
)

:: Verificar Controller (puerto 3004)
curl -f -s http://localhost:3004/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Controller (puerto 3004): OK
    set /a servicios_ok+=1
) else (
    echo ❌ Controller (puerto 3004): NO DISPONIBLE
)

:: Verificar UI (puerto 3000)
curl -f -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Interfaz Web (puerto 3000): OK
    set /a servicios_ok+=1
) else (
    echo ❌ Interfaz Web (puerto 3000): NO DISPONIBLE
)

echo.
echo ===============================================
echo   RESULTADO DE LA EJECUCION
echo ===============================================
echo Servicios funcionando: %servicios_ok%/%total_servicios%

if %servicios_ok% equ %total_servicios% (
    echo.
    echo 🎉 ¡SISTEMA COMPLETAMENTE FUNCIONAL!
    echo.
    echo 🌐 ACCESOS AL SISTEMA:
    echo    • Interfaz Web: http://localhost:3000
    echo    • API Ingestor: http://localhost:3001
    echo    • API Analyzer: http://localhost:3002
    echo    • API Scheduler: http://localhost:3003
    echo    • API Controller: http://localhost:3004
    echo.
    echo 🧪 PRUEBAS DE SEGURIDAD:
    echo    • Ejecutar: tests\run-security-tests.sh
    echo.
    echo 📊 CARACTERISTICAS IMPLEMENTADAS:
    echo    ✅ 5 Microservicios independientes
    echo    ✅ Algoritmo EDF funcionando
    echo    ✅ Seguridad con JWT y AppArmor
    echo    ✅ Simulacion de ataques
    echo    ✅ Mapa interactivo de Popayan
    echo    ✅ Comunicacion en tiempo real
    if %apparmor_available% equ 1 (
        echo    🔒 AppArmor activo y protegiendo contenedores
    ) else (
        echo    ⚠️  AppArmor no disponible en este entorno
    )
    echo.
    echo 🚀 ¿Abrir la interfaz web automaticamente?
    choice /c YN /m "Presiona Y para abrir, N para salir"
    if %errorlevel% equ 1 (
        start http://localhost:3000
        echo.
        echo ✅ Navegador abierto. ¡Disfruta del sistema!
    )
) else (
    echo.
    echo ⚠️  ALGUNOS SERVICIOS NO ESTAN FUNCIONANDO
    echo.
    echo 💡 SOLUCIONES:
    echo    1. Espera 30 segundos mas y vuelve a ejecutar
    echo    2. Verifica que Docker Desktop este funcionando
    echo    3. Revisa los logs: docker-compose logs
    echo.
    echo 📋 Ver logs de errores...
    docker-compose logs --tail=20
)

echo.
echo ===============================================
echo   COMANDOS UTILES:
echo ===============================================
echo • Ver logs:           docker-compose logs -f
echo • Parar sistema:      docker-compose down
echo • Reiniciar:          docker-compose restart
echo • Ver contenedores:   docker ps
echo • Limpiar todo:       docker-compose down -v
echo.
if %apparmor_available% equ 1 (
    echo 🔒 COMANDOS DE SEGURIDAD APPARMOR:
    echo • Validar AppArmor:    ./validate-apparmor.sh
    echo • Instalar perfiles:   ./security/install-apparmor.sh
    echo • Ver estado:          sudo aa-status
    echo • Ver perfiles:        sudo aa-status ^| grep traffic
    echo.
)
echo.

echo Presiona cualquier tecla para salir...
pause >nul
