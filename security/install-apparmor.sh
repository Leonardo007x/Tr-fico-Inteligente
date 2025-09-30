#!/bin/bash

# Script de Instalación de AppArmor para Sistema de Control de Tráfico
# Este script configura AppArmor en un contenedor Linux para el proyecto

set -e  # Salir si hay algún error

echo "==============================================="
echo "  INSTALACIÓN DE APPARMOR - TRAFFIC CONTROL"
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

# Verificar si estamos en Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    log_error "Este script debe ejecutarse en un sistema Linux con AppArmor"
    log_info "Para Windows/Mac, usa Docker Desktop con WSL2"
    exit 1
fi

# Verificar si AppArmor está disponible
log_info "Verificando disponibilidad de AppArmor..."
if ! command -v apparmor_status &> /dev/null; then
    log_error "AppArmor no está instalado en el sistema"
    log_info "Instalando AppArmor..."
    
    # Detectar distribución
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y apparmor apparmor-utils
    elif command -v yum &> /dev/null; then
        sudo yum install -y apparmor
    elif command -v pacman &> /dev/null; then
        sudo pacman -S apparmor
    else
        log_error "No se pudo detectar el gestor de paquetes"
        exit 1
    fi
fi

log_success "AppArmor está disponible"

# Verificar estado de AppArmor
log_info "Verificando estado de AppArmor..."
if ! sudo aa-status | grep -q "apparmor module is loaded"; then
    log_warning "AppArmor no está cargado. Cargando módulo..."
    sudo systemctl start apparmor
    sudo systemctl enable apparmor
fi

log_success "AppArmor está activo"

# Crear directorio de perfiles si no existe
PROFILE_DIR="/etc/apparmor.d/traffic-control"
log_info "Creando directorio de perfiles: $PROFILE_DIR"
sudo mkdir -p "$PROFILE_DIR"

# Copiar perfiles de AppArmor
log_info "Instalando perfiles de AppArmor..."

# Función para instalar perfil
install_profile() {
    local profile_name="$1"
    local source_file="security/apparmor-profiles/$profile_name"
    local target_file="$PROFILE_DIR/$profile_name"
    
    if [[ -f "$source_file" ]]; then
        log_info "Instalando perfil: $profile_name"
        sudo cp "$source_file" "$target_file"
        sudo chmod 644 "$target_file"
        log_success "Perfil $profile_name instalado correctamente"
    else
        log_error "Archivo de perfil no encontrado: $source_file"
        return 1
    fi
}

# Instalar todos los perfiles
install_profile "traffic-ingestor"
install_profile "traffic-analyzer"
install_profile "traffic-scheduler"
install_profile "traffic-controller"
install_profile "traffic-ui"

# Cargar perfiles en AppArmor
log_info "Cargando perfiles en AppArmor..."

sudo apparmor_parser -r "$PROFILE_DIR/traffic-ingestor"
sudo apparmor_parser -r "$PROFILE_DIR/traffic-analyzer"
sudo apparmor_parser -r "$PROFILE_DIR/traffic-scheduler"
sudo apparmor_parser -r "$PROFILE_DIR/traffic-controller"
sudo apparmor_parser -r "$PROFILE_DIR/traffic-ui"

log_success "Todos los perfiles cargados correctamente"

# Verificar estado de los perfiles
log_info "Verificando estado de los perfiles instalados..."
echo
echo "Perfiles de Traffic Control activos:"
sudo aa-status | grep "traffic-" || log_warning "No se encontraron perfiles activos"

echo
echo "==============================================="
echo "  CONFIGURACIÓN COMPLETADA"
echo "==============================================="
echo
log_success "AppArmor configurado correctamente para el sistema de tráfico"
echo
echo "Perfiles instalados:"
echo "  ✅ traffic-ingestor"
echo "  ✅ traffic-analyzer"
echo "  ✅ traffic-scheduler"
echo "  ✅ traffic-controller"
echo "  ✅ traffic-ui"
echo
echo "Para verificar el estado:"
echo "  sudo aa-status"
echo
echo "Para recargar perfiles después de cambios:"
echo "  sudo apparmor_parser -r /etc/apparmor.d/traffic-control/traffic-[servicio]"
echo
echo "Para deshabilitar un perfil:"
echo "  sudo aa-disable /etc/apparmor.d/traffic-control/traffic-[servicio]"
echo
echo "Para habilitar un perfil:"
echo "  sudo aa-enable /etc/apparmor.d/traffic-control/traffic-[servicio]"
echo

# Crear script de validación
log_info "Creando script de validación..."
cat > validate-apparmor.sh << 'EOF'
#!/bin/bash
echo "==============================================="
echo "  VALIDACIÓN DE APPARMOR - TRAFFIC CONTROL"
echo "==============================================="
echo
echo "Estado general de AppArmor:"
sudo aa-status | head -5
echo
echo "Perfiles de Traffic Control:"
sudo aa-status | grep "traffic-" || echo "No hay perfiles activos"
echo
echo "Modo de AppArmor:"
sudo aa-status | grep "enforce\|complain" || echo "Modo no detectado"
echo
echo "==============================================="
EOF

chmod +x validate-apparmor.sh
log_success "Script de validación creado: validate-apparmor.sh"

echo
log_success "¡Instalación de AppArmor completada exitosamente!"
echo "El sistema está listo para usar AppArmor con Docker"

