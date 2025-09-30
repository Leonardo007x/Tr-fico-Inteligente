@echo off
title Pruebas de Seguridad - Sistema Control Trafico
color 0E

echo.
echo ===============================================
echo   PRUEBAS DE SEGURIDAD - SISTEMA TRAFICO
echo   Simulacion de Ataques y Protecciones
echo ===============================================
echo.

:: Verificar si Docker esta ejecutandose
echo [1/3] Verificando Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Docker Desktop no esta ejecutandose
    echo 💡 Abre Docker Desktop y vuelve a intentar
    pause
    exit /b 1
)
echo ✅ Docker Desktop funcionando

:: Verificar que los servicios esten ejecutandose
echo.
echo [2/3] Verificando servicios del sistema...
set "servicios_ok=0"

curl -f -s http://localhost:3001/api/health >nul 2>&1 && set /a servicios_ok+=1
curl -f -s http://localhost:3002/api/health >nul 2>&1 && set /a servicios_ok+=1
curl -f -s http://localhost:3003/api/health >nul 2>&1 && set /a servicios_ok+=1
curl -f -s http://localhost:3004/api/health >nul 2>&1 && set /a servicios_ok+=1

if %servicios_ok% lss 4 (
    echo ❌ ERROR: Los servicios no estan ejecutandose
    echo.
    echo 💡 SOLUCION:
    echo    1. Ejecuta primero: ejecutar-proyecto.bat
    echo    2. Espera a que todos los servicios esten OK
    echo    3. Vuelve a ejecutar este archivo
    echo.
    pause
    exit /b 1
)
echo ✅ Todos los servicios estan funcionando

:: Ejecutar pruebas de seguridad
echo.
echo [3/3] Ejecutando pruebas de seguridad...
echo    Simulando ataques y verificando protecciones...
echo.

cd tests
node security-tests.js
set "resultado=%errorlevel%"
cd ..

echo.
echo ===============================================
echo   RESULTADO DE LAS PRUEBAS
echo ===============================================

if %resultado% equ 0 (
    echo.
    echo 🎉 ¡TODAS LAS PRUEBAS DE SEGURIDAD PASARON!
    echo.
    echo ✅ PROTECCIONES VERIFICADAS:
    echo    • Autenticacion JWT funcionando
    echo    • Rate limiting activo
    echo    • Proteccion contra inyeccion SQL
    echo    • WebSocket resistente a ataques
    echo    • Health checks operativos
    echo.
    echo 🏆 SISTEMA SEGURO PARA DESPLIEGUE
) else (
    echo.
    echo ⚠️  ALGUNAS PRUEBAS DE SEGURIDAD FALLARON
    echo.
    echo 📋 REVISA EL REPORTE DETALLADO:
    echo    • Archivo: tests\security-report-*.json
    echo    • Logs: docker-compose logs
    echo.
    echo 💡 RECOMENDACION: Corrige los errores antes del despliegue
)

echo.
echo ===============================================
echo   TIPOS DE ATAQUES SIMULADOS:
echo ===============================================
echo 🔐 Autenticacion JWT (tokens invalidos, acceso sin token)
echo ⚡ Rate Limiting (20 requests rapidos)
echo 💉 Inyeccion SQL (payloads maliciosos)
echo 🌐 Estrés WebSocket (50 conexiones simultaneas)
echo 🏥 Health Checks (verificacion de servicios)
echo.

echo Presiona cualquier tecla para salir...
pause >nul
