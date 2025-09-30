@echo off
title Parando Sistema - Control Trafico
color 0C

echo.
echo ===============================================
echo   PARANDO SISTEMA DE CONTROL DE TRAFICO
echo ===============================================
echo.

echo [1/2] Deteniendo microservicios...
docker-compose down
echo ✅ Servicios detenidos

echo.
echo [2/2] Limpiando recursos...
docker system prune -f >nul 2>&1
echo ✅ Recursos liberados

echo.
echo ===============================================
echo   SISTEMA DETENIDO COMPLETAMENTE
echo ===============================================
echo.
echo ✅ Todos los contenedores detenidos
echo ✅ Recursos Docker liberados
echo ✅ Puertos liberados (3000-3004)
echo.
echo 💡 Para volver a ejecutar: ejecutar-proyecto.bat
echo.

pause
