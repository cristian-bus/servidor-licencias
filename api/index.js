// --- server.js ---
// Necesitarás instalar estas dependencias: npm install express jsonwebtoken cors dotenv
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config(); // Para manejar variables de entorno

const app = express();
app.use(express.json());
// Forzando el redespliegue
// --- Configuración de CORS ---
// Se ha configurado para aceptar peticiones desde cualquier origen ('*').
// Esto soluciona el error de conexión que estabas experimentando.
// Para producción, es más seguro cambiar '*' por el dominio real de tu app cliente.
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'], // Se añade OPTIONS, importante para 'preflight requests' de CORS
  allowedHeaders: ['Content-Type', 'Authorization'], // Se especifican las cabeceras permitidas
};

// Maneja las solicitudes 'preflight' de CORS.
// El navegador envía una solicitud OPTIONS antes de la solicitud POST real.
// Esto asegura que el servidor responda correctamente a esa comprobación inicial.
app.options('*', cors(corsOptions));

app.use(cors(corsOptions));


// --- Clave Secreta para firmar JWT ---
// ¡MUY IMPORTANTE! Esta clave NUNCA debe estar en el código del cliente.
// Guárdala de forma segura en tus variables de entorno del servidor.
const JWT_SECRET = process.env.JWT_SECRET || 'clave-super-secreta-para-produccion-cambiar-esto';

// --- Base de Datos Falsa de Licencias ---
// En un sistema real, esto estaría en una base de datos segura (PostgreSQL, MongoDB, etc.)
const validLicenses = {
  'TALLERPRO-VALIDA-1234-5678': { used: false, domain: null, type: 'PRO_LIFETIME' },
  'TALLERPRO-ANUAL-ABCD-EFGH': { used: false, domain: null, type: 'PRO_YEARLY' },
};

/**
 * Endpoint para validar una licencia y generar un token JWT.
 * El cliente envía su clave y un identificador único (uuid).
 */
app.post('/api/licenses/validate', (req, res) => {
  // --- LOG DE DIAGNÓSTICO 1: Ver qué recibe el servidor ---
  console.log('--- Nueva Petición a /api/licenses/validate ---');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Cuerpo de la petición (req.body):', req.body);

  const { licenseKey, uuid, domain } = req.body;

  if (!licenseKey || !uuid || !domain) {
    console.error('Error: Petición incompleta. Faltan datos.');
    return res.status(400).json({ message: 'Faltan datos requeridos (licenseKey, uuid, domain).' });
  }

  // --- LOG DE DIAGNÓSTICO 2: Ver qué clave estamos buscando ---
  console.log(`Buscando la clave de licencia: "${licenseKey}"`);
  
  const license = validLicenses[licenseKey];

  // 1. Verificar si la licencia existe
  if (!license) {
    // --- LOG DE DIAGNÓSTICO 3: Informar que la clave no fue encontrada ---
    console.error(`Resultado: La clave "${licenseKey}" NO FUE ENCONTRADA en la lista.`);
    return res.status(404).json({ message: 'La clave de licencia no es válida.' });
  }
  
  // --- LOG DE DIAGNÓSTICO 4: Informar que la clave fue encontrada ---
  console.log(`Resultado: La clave "${licenseKey}" FUE ENCONTRADA. Procediendo a validar.`);

  // 2. Verificar si la licencia ya fue usada y está ligada a otro dominio/máquina
  if (license.used && license.domain !== domain) {
      // Opcional: podrías verificar también el UUID si quieres ligarla a un navegador específico.
      console.error(`Error: La licencia "${licenseKey}" ya está en uso en el dominio "${license.domain}".`);
      return res.status(403).json({ message: 'Esta licencia ya está en uso en otro dominio.' });
  }

  // 3. Marcar la licencia como usada (en una DB real, actualizarías el registro)
  validLicenses[licenseKey].used = true;
  validLicenses[licenseKey].domain = domain;

  // 4. Generar el JWT
  const expiration = license.type === 'PRO_YEARLY' ? '365d' : '10y'; // Licencia anual o "vitalicia" (10 años)
  const tokenPayload = {
    uuid, // Identificador del cliente
    domain, // Dominio donde se activó
    type: license.type, // Tipo de licencia
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: expiration });

  console.log(`Licencia '${licenseKey}' activada con éxito para el dominio '${domain}'.`);

  res.json({
    message: 'Licencia activada con éxito.',
    token,
  });
});


/**
 * Middleware de autenticación para proteger otras rutas de la API.
 * Este middleware se ejecutará antes de cada ruta que lo necesite.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

  if (token == null) {
    return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Si el token ha expirado o la firma es inválida
      return res.status(403).json({ message: 'Token inválido o expirado.' });
    }
    // Si el token es válido, adjuntamos el payload a la request para usarlo después
    req.user = user;
    next();
  });
};

// --- Ejemplo de una ruta protegida ---
// Solo se puede acceder con un JWT válido.
app.get('/api/data/profile', authenticateToken, (req, res) => {
  // Gracias al middleware, aquí tenemos acceso a req.user
  res.json({
    message: `Bienvenido, usuario con licencia tipo: ${req.user.type}`,
    // Aquí iría la lógica para devolver datos del perfil
  });
});

// Exporta la app de Express para que Vercel pueda usarla como una función serverless.
// Vercel se encarga de 'app.listen()' por nosotros.
module.exports = app;
