#!/bin/bash

# Script de Ejecución de Pruebas de Seguridad
# Sistema de Control de Tráfico - Popayán

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}🚀 SCRIPT DE PRUEBAS DE SEGURIDAD${NC}"
echo -e "${BOLD}=====================================${NC}"

# Función para mostrar ayuda
show_help() {
    echo -e "${BOLD}Uso: $0 [OPCIÓN]${NC}"
    echo ""
    echo "Opciones:"
    echo "  all         Ejecutar todas las pruebas de seguridad (por defecto)"
    echo "  auth        Solo pruebas de autenticación JWT"
    echo "  rate        Solo pruebas de rate limiting"
    echo "  injection   Solo pruebas de inyección SQL"
    echo "  websocket   Solo pruebas de estrés WebSocket"
    echo "  health      Solo health checks de servicios"
    echo "  help        Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0                    # Ejecutar todas las pruebas"
    echo "  $0 auth              # Solo autenticación"
    echo "  $0 injection         # Solo inyección SQL"
}

# Verificar que Docker esté ejecutándose
check_docker() {
    echo -e "${BLUE}🔍 Verificando Docker...${NC}"
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker no está ejecutándose. Por favor inicia Docker Desktop.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker está ejecutándose${NC}"
}

# Verificar que los servicios estén ejecutándose
check_services() {
    echo -e "${BLUE}🔍 Verificando servicios del sistema...${NC}"
    
    local services=("3001:Ingestor" "3002:Analyzer" "3003:Scheduler" "3004:Controller")
    local all_services_up=true
    
    for service in "${services[@]}"; do
        local port=$(echo $service | cut -d: -f1)
        local name=$(echo $service | cut -d: -f2)
        
        if curl -f -s http://localhost:$port/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name (puerto $port): OK${NC}"
        else
            echo -e "${RED}❌ $name (puerto $port): NO DISPONIBLE${NC}"
            all_services_up=false
        fi
    done
    
    if [ "$all_services_up" = false ]; then
        echo -e "${YELLOW}⚠️  Algunos servicios no están disponibles.${NC}"
        echo -e "${BLUE}💡 Ejecuta: docker-compose up -d${NC}"
        echo -e "${BLUE}💡 Espera 30 segundos y vuelve a intentar.${NC}"
        exit 1
    fi
}

# Instalar dependencias si es necesario
install_dependencies() {
    echo -e "${BLUE}📦 Verificando dependencias...${NC}"
    
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📥 Instalando dependencias...${NC}"
        npm install
    else
        echo -e "${GREEN}✅ Dependencias ya instaladas${NC}"
    fi
}

# Ejecutar pruebas específicas
run_test() {
    local test_type=$1
    
    case $test_type in
        "all")
            echo -e "${BOLD}🧪 Ejecutando TODAS las pruebas de seguridad...${NC}"
            node security-tests.js
            ;;
        "auth")
            echo -e "${BOLD}🔐 Ejecutando pruebas de AUTENTICACIÓN...${NC}"
            npm run test:auth
            ;;
        "rate")
            echo -e "${BOLD}⚡ Ejecutando pruebas de RATE LIMITING...${NC}"
            npm run test:rate
            ;;
        "injection")
            echo -e "${BOLD}💉 Ejecutando pruebas de INYECCIÓN SQL...${NC}"
            npm run test:injection
            ;;
        "websocket")
            echo -e "${BOLD}🌐 Ejecutando pruebas de ESTRÉS WEBSOCKET...${NC}"
            npm run test:websocket
            ;;
        "health")
            echo -e "${BOLD}🏥 Ejecutando HEALTH CHECKS...${NC}"
            npm run test:health
            ;;
        "help")
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Opción no válida: $test_type${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Función principal
main() {
    local test_type=${1:-"all"}
    
    # Verificaciones previas
    check_docker
    check_services
    install_dependencies
    
    echo -e "${BOLD}${GREEN}✅ Todas las verificaciones pasaron. Iniciando pruebas...${NC}"
    echo ""
    
    # Ejecutar pruebas
    run_test $test_type
    
    echo ""
    echo -e "${BOLD}${GREEN}🎉 Pruebas de seguridad completadas${NC}"
}

# Manejar interrupciones
trap 'echo -e "\n${YELLOW}⚠️  Pruebas interrumpidas por el usuario${NC}"; exit 130' INT

# Ejecutar función principal
main "$@"
