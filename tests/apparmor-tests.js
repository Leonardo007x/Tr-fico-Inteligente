/**
 * Pruebas de AppArmor para Sistema de Control de Tráfico
 * Verifica que los perfiles de AppArmor estén funcionando correctamente
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuración de colores para output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Función para logging con colores
function log(level, message, color = colors.reset) {
    const timestamp = new Date().toISOString();
    const levelColor = level === 'ERROR' ? colors.red : 
                      level === 'SUCCESS' ? colors.green : 
                      level === 'WARNING' ? colors.yellow : 
                      level === 'INFO' ? colors.blue : colors.reset;
    
    console.log(`${levelColor}[${level}]${colors.reset} ${color}${message}${colors.reset}`);
}

// Función para ejecutar comandos
function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// Configuración de pruebas
const APPARMOR_TESTS = {
    // Verificar que AppArmor esté instalado y activo
    async checkAppArmorStatus() {
        try {
            log('INFO', 'Verificando estado de AppArmor...');
            const result = await runCommand('sudo aa-status');
            
            if (result.stdout.includes('apparmor module is loaded')) {
                log('SUCCESS', 'AppArmor está cargado y funcionando');
                return true;
            } else {
                log('ERROR', 'AppArmor no está cargado');
                return false;
            }
        } catch (error) {
            log('ERROR', `Error verificando AppArmor: ${error.error.message}`);
            return false;
        }
    },

    // Verificar perfiles específicos del proyecto
    async checkProjectProfiles() {
        const profiles = [
            'traffic-ingestor',
            'traffic-analyzer', 
            'traffic-scheduler',
            'traffic-controller',
            'traffic-ui'
        ];

        let allProfilesOk = true;

        for (const profile of profiles) {
            try {
                log('INFO', `Verificando perfil: ${profile}`);
                const result = await runCommand(`sudo aa-status | grep ${profile}`);
                
                if (result.stdout.includes(profile)) {
                    log('SUCCESS', `Perfil ${profile} está cargado`);
                } else {
                    log('ERROR', `Perfil ${profile} no está cargado`);
                    allProfilesOk = false;
                }
            } catch (error) {
                log('ERROR', `Error verificando perfil ${profile}: ${error.error.message}`);
                allProfilesOk = false;
            }
        }

        return allProfilesOk;
    },

    // Verificar archivos de perfiles
    async checkProfileFiles() {
        const profileDir = '/etc/apparmor.d/traffic-control';
        const profiles = [
            'traffic-ingestor',
            'traffic-analyzer',
            'traffic-scheduler', 
            'traffic-controller',
            'traffic-ui'
        ];

        let allFilesOk = true;

        for (const profile of profiles) {
            const filePath = `${profileDir}/${profile}`;
            try {
                if (fs.existsSync(filePath)) {
                    log('SUCCESS', `Archivo de perfil encontrado: ${profile}`);
                } else {
                    log('ERROR', `Archivo de perfil no encontrado: ${profile}`);
                    allFilesOk = false;
                }
            } catch (error) {
                log('ERROR', `Error verificando archivo ${profile}: ${error.message}`);
                allFilesOk = false;
            }
        }

        return allFilesOk;
    },

    // Verificar contenedores Docker con AppArmor
    async checkDockerAppArmor() {
        try {
            log('INFO', 'Verificando contenedores Docker con AppArmor...');
            
            // Obtener lista de contenedores del proyecto
            const result = await runCommand('docker ps --format "{{.Names}}" | grep traffic-');
            
            if (result.stdout.trim()) {
                const containers = result.stdout.trim().split('\n');
                let containersWithAppArmor = 0;

                for (const container of containers) {
                    try {
                        const inspectResult = await runCommand(`docker inspect ${container} | grep -i apparmor`);
                        if (inspectResult.stdout.includes('AppArmorProfile')) {
                            log('SUCCESS', `Contenedor ${container} tiene AppArmor configurado`);
                            containersWithAppArmor++;
                        } else {
                            log('WARNING', `Contenedor ${container} no tiene AppArmor configurado`);
                        }
                    } catch (error) {
                        log('WARNING', `No se pudo verificar AppArmor en contenedor ${container}`);
                    }
                }

                if (containersWithAppArmor === containers.length) {
                    log('SUCCESS', 'Todos los contenedores tienen AppArmor configurado');
                    return true;
                } else {
                    log('WARNING', `Solo ${containersWithAppArmor}/${containers.length} contenedores tienen AppArmor`);
                    return false;
                }
            } else {
                log('WARNING', 'No hay contenedores del proyecto ejecutándose');
                return true; // No es un error si no hay contenedores
            }
        } catch (error) {
            log('ERROR', `Error verificando contenedores Docker: ${error.error.message}`);
            return false;
        }
    },

    // Verificar logs de AppArmor
    async checkAppArmorLogs() {
        try {
            log('INFO', 'Verificando logs de AppArmor...');
            
            // Intentar diferentes métodos para obtener logs
            let logFound = false;
            
            try {
                const dmesgResult = await runCommand('sudo dmesg | grep -i apparmor | tail -5');
                if (dmesgResult.stdout.trim()) {
                    log('SUCCESS', 'Logs de AppArmor encontrados en dmesg');
                    logFound = true;
                }
            } catch (error) {
                // dmesg puede fallar, no es crítico
            }

            try {
                const journalResult = await runCommand('sudo journalctl -u apparmor --no-pager -n 5');
                if (journalResult.stdout.includes('apparmor') || journalResult.stdout.includes('AppArmor')) {
                    log('SUCCESS', 'Logs de AppArmor encontrados en journalctl');
                    logFound = true;
                }
            } catch (error) {
                // journalctl puede fallar, no es crítico
            }

            if (!logFound) {
                log('WARNING', 'No se encontraron logs recientes de AppArmor');
            }

            return true; // No es crítico si no hay logs
        } catch (error) {
            log('WARNING', `No se pudieron verificar logs de AppArmor: ${error.error.message}`);
            return true; // No es crítico
        }
    }
};

// Función principal de pruebas
async function runAppArmorTests() {
    console.log(`${colors.cyan}===============================================${colors.reset}`);
    console.log(`${colors.cyan}  PRUEBAS DE APPARMOR - TRAFFIC CONTROL${colors.reset}`);
    console.log(`${colors.cyan}  Sistema de Control de Tráfico - Popayán${colors.reset}`);
    console.log(`${colors.cyan}===============================================${colors.reset}\n`);

    const results = {
        apparmorStatus: false,
        projectProfiles: false,
        profileFiles: false,
        dockerAppArmor: false,
        apparmorLogs: false
    };

    // Ejecutar todas las pruebas
    results.apparmorStatus = await APPARMOR_TESTS.checkAppArmorStatus();
    results.projectProfiles = await APPARMOR_TESTS.checkProjectProfiles();
    results.profileFiles = await APPARMOR_TESTS.checkProfileFiles();
    results.dockerAppArmor = await APPARMOR_TESTS.checkDockerAppArmor();
    results.apparmorLogs = await APPARMOR_TESTS.checkAppArmorLogs();

    // Calcular resultados
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    const successRate = Math.round((passedTests / totalTests) * 100);

    console.log(`\n${colors.cyan}===============================================${colors.reset}`);
    console.log(`${colors.cyan}  RESULTADO DE LAS PRUEBAS${colors.reset}`);
    console.log(`${colors.cyan}===============================================${colors.reset}`);

    console.log(`\n${colors.blue}Pruebas ejecutadas: ${totalTests}${colors.reset}`);
    console.log(`${colors.green}Pruebas exitosas: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}Pruebas fallidas: ${totalTests - passedTests}${colors.reset}`);
    console.log(`${colors.yellow}Tasa de éxito: ${successRate}%${colors.reset}`);

    // Mostrar detalle de resultados
    console.log(`\n${colors.blue}Detalle de resultados:${colors.reset}`);
    Object.entries(results).forEach(([test, passed]) => {
        const status = passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
        const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
        console.log(`  ${status} ${testName}`);
    });

    // Determinar estado final
    if (passedTests === totalTests) {
        console.log(`\n${colors.green}🎉 ¡TODAS LAS PRUEBAS DE APPARMOR PASARON!${colors.reset}`);
        console.log(`${colors.green}✅ AppArmor está configurado correctamente${colors.reset}`);
        console.log(`${colors.green}🔒 El sistema está protegido${colors.reset}`);
        return 0;
    } else if (successRate >= 80) {
        console.log(`\n${colors.yellow}⚠️  La mayoría de pruebas pasaron${colors.reset}`);
        console.log(`${colors.yellow}🔧 Se recomienda revisar las pruebas fallidas${colors.reset}`);
        return 1;
    } else {
        console.log(`\n${colors.red}❌ Varias pruebas de AppArmor fallaron${colors.reset}`);
        console.log(`${colors.red}🔧 Se requiere intervención para corregir los problemas${colors.reset}`);
        return 2;
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    runAppArmorTests()
        .then(exitCode => {
            process.exit(exitCode);
        })
        .catch(error => {
            log('ERROR', `Error ejecutando pruebas: ${error.message}`);
            process.exit(3);
        });
}

module.exports = { runAppArmorTests, APPARMOR_TESTS };

