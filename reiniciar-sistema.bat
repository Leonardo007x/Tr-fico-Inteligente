@echo off
title Reiniciando Sistema - Control Trafico
color 0B

echo.
echo ===============================================
echo   REINICIANDO SISTEMA DE CONTROL DE TRAFICO
echo ===============================================
echo.

echo [1/4] Deteniendo sistema actual...
docker-compose down
echo ✅ Sistema detenido

echo.
echo [2/4] Limpiando cache y recursos...
docker system prune -f >nul 2>&1
echo ✅ Cache limpiado

echo.
echo [3/4] Reconstruyendo con cambios...
docker-compose up --build -d
echo ✅ Sistema reconstruido

echo.
echo [4/4] Verificando servicios...
timeout /t 10 /nobreak >nul

set "servicios_ok=0"
set "total_servicios=5"

:: Verificar Ingestor (puerto 3001)
curl -f -s http://localhost:3001/api/health >nul 2>&1 && set /a servicios_ok+=1
curl -f -s http://localhost:3002/api/health >nul 2>&1 && set /a servicios_ok+=1
curl -f -s http://localhost:3003/api/health >nul 2>&1 && set /a servicios_ok+=1
curl -f -s http://localhost:3004/api/health >nul 2>&1 && set /a servicios_ok+=1
curl -f -s http://localhost:3000/health >nul 2>&1 && set /a servicios_ok+=1

echo.
echo ===============================================
echo   SISTEMA REINICIADO COMPLETAMENTE
echo ===============================================
echo Servicios funcionando: %servicios_ok%/%total_servicios%

if %servicios_ok% equ %total_servicios% (
    echo.
    echo 🎉 ¡SISTEMA COMPLETAMENTE OPERATIVO!
    echo.
    echo 🌐 Interfaz Web: http://localhost:3000
    echo.
    echo 💡 Los cambios ya estan aplicados
    echo 💡 Prueba el boton "Simular Ataque"
    echo.
    echo 🚀 ¿Abrir la interfaz web?
    choice /c YN /m "Presiona Y para abrir, N para salir"
    if %errorlevel% equ 1 (
        start http://localhost:3000
        echo.
        echo ✅ Navegador abierto con cambios aplicados
    )
) else (
    echo.
    echo ⚠️  Algunos servicios no estan funcionando
    echo.
    echo 💡 Espera 30 segundos mas y vuelve a intentar
    echo 💡 O ejecuta: docker-compose logs
)

echo.
pause
