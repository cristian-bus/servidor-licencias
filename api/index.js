// --- server.js ---
// Necesitarás instalar estas dependencias: npm install express jsonwebtoken cors dotenv
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config(); // Para manejar variables de entorno

const app = express();
app.use(express.json());

// --- Configuración de CORS ---
// En un entorno real, deberías restringir el origen a tu dominio de producción.
// Por ejemplo: const corsOptions = { origin: 'https://tu-dominio-app.com' };
app.use(cors());

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
  const { licenseKey, uuid, domain } = req.body;

  if (!licenseKey || !uuid || !domain) {
    return res.status(400).json({ message: 'Faltan datos requeridos (licenseKey, uuid, domain).' });
  }

  const license = validLicenses[licenseKey];

  // 1. Verificar si la licencia existe
  if (!license) {
    return res.status(404).json({ message: 'La clave de licencia no es válida.' });
  }

  // 2. Verificar si la licencia ya fue usada y está ligada a otro dominio/máquina
  if (license.used && license.domain !== domain) {
      // Opcional: podrías verificar también el UUID si quieres ligarla a un navegador específico.
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

  console.log(`Licencia '${licenseKey}' activada para el dominio '${domain}'.`);

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


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor de licencias corriendo en http://localhost:${PORT}`);
});
