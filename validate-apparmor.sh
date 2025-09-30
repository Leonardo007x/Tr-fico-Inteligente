#!/bin/bash

# Script de Validación de AppArmor para Sistema de Control de Tráfico
# Verifica que AppArmor esté funcionando correctamente con los perfiles del proyecto

set -e  # Salir si hay algún error

echo "==============================================="
echo "  VALIDACIÓN DE APPARMOR - TRAFFIC CONTROL"
echo "  Sistema de Control de Tráfico - Popayán"
echo "==============================================="
echo

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Variables
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Función para ejecutar check
run_check() {
    local check_name="$1"
    local check_command="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    log_info "Verificando: $check_name"
    
    if eval "$check_command" >/dev/null 2>&1; then
        log_success "$check_name: OK"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        log_error "$check_name: FALLÓ"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

echo "🔍 Iniciando validación de AppArmor..."
echo

# Check 1: Verificar que AppArmor esté instalado
run_check "AppArmor instalado" "command -v aa-status"

# Check 2: Verificar que AppArmor esté activo
run_check "AppArmor activo" "sudo aa-status | grep -q 'apparmor module is loaded'"

# Check 3: Verificar que AppArmor esté en modo enforce
run_check "AppArmor en modo enforce" "sudo aa-status | grep -q 'enforce'"

# Check 4: Verificar perfiles específicos del proyecto
PROFILES=("traffic-ingestor" "traffic-analyzer" "traffic-scheduler" "traffic-controller" "traffic-ui")

for profile in "${PROFILES[@]}"; do
    run_check "Perfil $profile cargado" "sudo aa-status | grep -q '$profile'"
done

# Check 5: Verificar archivos de perfiles
PROFILE_DIR="/etc/apparmor.d/traffic-control"
for profile in "${PROFILES[@]}"; do
    run_check "Archivo de perfil $profile" "test -f '$PROFILE_DIR/$profile'"
done

# Check 6: Verificar permisos de archivos de perfiles
for profile in "${PROFILES[@]}"; do
    run_check "Permisos de $profile" "test -r '$PROFILE_DIR/$profile'"
done

# Check 7: Verificar que Docker esté funcionando
run_check "Docker funcionando" "docker info >/dev/null 2>&1"

# Check 8: Verificar contenedores con AppArmor
if docker ps --format "table {{.Names}}" | grep -q "traffic-"; then
    log_info "Verificando contenedores con AppArmor..."
    
    # Obtener lista de contenedores del proyecto
    CONTAINERS=$(docker ps --format "{{.Names}}" | grep "traffic-")
    
    for container in $CONTAINERS; do
        run_check "AppArmor en contenedor $container" "docker inspect $container | grep -q 'AppArmorProfile'"
    done
else
    log_warning "No hay contenedores del proyecto ejecutándose"
fi

# Check 9: Verificar logs de AppArmor
run_check "Logs de AppArmor disponibles" "sudo dmesg | grep -q 'AppArmor' || journalctl -u apparmor --no-pager | head -1"

echo
echo "==============================================="
echo "  RESULTADO DE LA VALIDACIÓN"
echo "==============================================="
echo
echo "Checks ejecutados: $TOTAL_CHECKS"
echo -e "Checks exitosos: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Checks fallidos: ${RED}$FAILED_CHECKS${NC}"

# Calcular porcentaje de éxito
if [ $TOTAL_CHECKS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    echo "Tasa de éxito: $SUCCESS_RATE%"
else
    SUCCESS_RATE=0
    echo "Tasa de éxito: 0%"
fi

echo

# Determinar estado general
if [ $FAILED_CHECKS -eq 0 ]; then
    log_success "¡TODAS LAS VALIDACIONES PASARON!"
    echo
    echo "🎉 Estado: EXCELENTE"
    echo "🔒 AppArmor está configurado correctamente"
    echo "✅ Todos los perfiles están funcionando"
    echo "🚀 El sistema está listo para producción"
    exit 0
elif [ $SUCCESS_RATE -ge 80 ]; then
    log_warning "La mayoría de validaciones pasaron, pero hay algunos problemas menores"
    echo
    echo "⚠️  Estado: BUENO"
    echo "🔧 Se recomienda revisar los checks fallidos"
    exit 1
else
    log_error "Varias validaciones fallaron"
    echo
    echo "❌ Estado: PROBLEMAS DETECTADOS"
    echo "🔧 Se requiere intervención para corregir los problemas"
    exit 2
fi

