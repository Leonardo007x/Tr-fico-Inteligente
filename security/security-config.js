/**
 * Configuración Centralizada de Seguridad
 * Sistema de Control de Tráfico - Popayán
 * 
 * Implementa políticas de seguridad robustas pero simples
 */

const crypto = require('crypto');

// Configuración de JWT mejorada
const JWT_CONFIG = {
  algorithm: 'HS256',
  expiresIn: '8h', // 8 horas para uso profesional
  issuer: 'traffic-control-popayan',
  audience: 'municipal-traffic-services',
  
  // Generar secret más robusto si no existe
  generateSecret: () => {
    return process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
  }
};

// Configuración de Rate Limiting por tipo de endpoint
const RATE_LIMITS = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos de autenticación
    message: 'Demasiados intentos de autenticación. Intente en 15 minutos.',
    standardHeaders: true
  },
  
  api: {
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // 100 requests por minuto
    message: 'Límite de API excedido. Intente en 1 minuto.',
    standardHeaders: true
  },
  
  critical: {
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 200, // Más permisivo para operaciones críticas
    message: 'Límite de operaciones críticas excedido.',
    standardHeaders: true
  }
};

// Headers de seguridad profesionales
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  'X-Powered-By': 'Traffic-Control-System-v1.0' // Custom header
};

// Configuración de CORS profesional
const CORS_CONFIG = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Lista de dominios permitidos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://127.0.0.1:3000',
      // Agregar dominios de producción aquí
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Validación de entrada mejorada
const INPUT_VALIDATION = {
  // Sanitizar strings para prevenir inyección
  sanitizeString: (input) => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/[<>]/g, '') // Remover < y >
      .replace(/['";]/g, '') // Remover comillas y punto y coma
      .replace(/--/g, '') // Remover comentarios SQL
      .replace(/\/\*/g, '') // Remover comentarios SQL
      .trim()
      .substring(0, 100); // Límite de longitud
  },
  
  // Validar intersectionId
  validateIntersectionId: (id) => {
    const pattern = /^int_\d{3}$/;
    return pattern.test(id);
  },
  
  // Validar estado de semáforo
  validateTrafficState: (state) => {
    const validStates = ['red', 'amber', 'green', 'maintenance'];
    return validStates.includes(state);
  },
  
  // Validar priority
  validatePriority: (priority) => {
    const num = parseInt(priority);
    return !isNaN(num) && num >= 0 && num <= 100;
  }
};

// Configuración de logging de seguridad
const SECURITY_LOGGING = {
  logSecurityEvent: (event, level = 'info', metadata = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      level,
      service: 'traffic-control-security',
      metadata: {
        ...metadata,
        userAgent: metadata.userAgent?.substring(0, 200), // Limitar tamaño
        ip: metadata.ip,
        endpoint: metadata.endpoint
      }
    };
    
    console.log(`[SECURITY-${level.toUpperCase()}]`, JSON.stringify(logEntry));
    
    // En producción, enviar a sistema de logs centralizado
    if (process.env.NODE_ENV === 'production') {
      // Implementar envío a ElasticSearch, Splunk, etc.
    }
  },
  
  logAuthAttempt: (ip, success, username, userAgent) => {
    SECURITY_LOGGING.logSecurityEvent('auth_attempt', success ? 'info' : 'warning', {
      ip, success, username, userAgent, 
      action: success ? 'login_success' : 'login_failed'
    });
  },
  
  logSuspiciousActivity: (ip, activity, endpoint, userAgent) => {
    SECURITY_LOGGING.logSecurityEvent('suspicious_activity', 'critical', {
      ip, activity, endpoint, userAgent,
      action: 'potential_attack'
    });
  }
};

// Middleware de seguridad centralizado
const createSecurityMiddleware = () => {
  return {
    // Aplicar headers de seguridad
    securityHeaders: (req, res, next) => {
      Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
        res.setHeader(header, value);
      });
      next();
    },
    
    // Validar y sanitizar entrada
    validateInput: (req, res, next) => {
      // Sanitizar parámetros
      if (req.params) {
        Object.keys(req.params).forEach(key => {
          req.params[key] = INPUT_VALIDATION.sanitizeString(req.params[key]);
        });
      }
      
      // Sanitizar query strings
      if (req.query) {
        Object.keys(req.query).forEach(key => {
          req.query[key] = INPUT_VALIDATION.sanitizeString(req.query[key]);
        });
      }
      
      // Validar body para requests POST/PUT
      if (req.body && typeof req.body === 'object') {
        // Validaciones específicas según endpoint
        if (req.path.includes('/traffic-lights/') && req.method === 'POST') {
          if (req.body.state && !INPUT_VALIDATION.validateTrafficState(req.body.state)) {
            return res.status(400).json({ 
              error: 'Estado de semáforo inválido',
              validStates: ['red', 'amber', 'green', 'maintenance']
            });
          }
        }
      }
      
      next();
    },
    
    // Detectar actividad sospechosa
    detectSuspiciousActivity: (req, res, next) => {
      const suspiciousPatterns = [
        /union.*select/i,
        /drop.*table/i,
        /insert.*into/i,
        /delete.*from/i,
        /<script/i,
        /javascript:/i,
        /eval\(/i,
        /expression\(/i
      ];
      
      const checkString = `${req.url} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`;
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(checkString)) {
          SECURITY_LOGGING.logSuspiciousActivity(
            req.ip, 
            `Patrón detectado: ${pattern}`, 
            req.path,
            req.get('User-Agent')
          );
          
          return res.status(403).json({ 
            error: 'Actividad sospechosa detectada',
            timestamp: new Date().toISOString(),
            incident_id: crypto.randomUUID()
          });
        }
      }
      
      next();
    }
  };
};

module.exports = {
  JWT_CONFIG,
  RATE_LIMITS,
  SECURITY_HEADERS,
  CORS_CONFIG,
  INPUT_VALIDATION,
  SECURITY_LOGGING,
  createSecurityMiddleware
};
