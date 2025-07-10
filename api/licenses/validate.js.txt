// Ubicación de este archivo: /api/licenses/validate.js
const jwt = require('jsonwebtoken');

// --- Clave Secreta para firmar JWT ---
const JWT_SECRET = process.env.JWT_SECRET || 'clave-super-secreta-para-produccion-cambiar-esto';

// --- Base de Datos Falsa de Licencias ---
const validLicenses = {
  'TALLERPRO-VALIDA-1234-5678': { used: false, domain: null, type: 'PRO_LIFETIME' },
  'TALLERPRO-ANUAL-ABCD-EFGH': { used: false, domain: null, type: 'PRO_YEARLY' },
};

// Esta es la función serverless que Vercel ejecutará.
module.exports = (req, res) => {
  // --- Configuración Manual de CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Manejo de la Petición Pre-vuelo (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo aceptamos peticiones POST.
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  
  // --- LOGS DE DIAGNÓSTICO ---
  console.log('--- Petición recibida en /api/licenses/validate.js ---');
  console.log('Cuerpo de la petición:', req.body);

  const { licenseKey, uuid, domain } = req.body;

  if (!licenseKey || !uuid || !domain) {
    console.error('Error: Petición incompleta.');
    return res.status(400).json({ message: 'Faltan datos requeridos.' });
  }
  
  const license = validLicenses[licenseKey];

  if (!license) {
    console.error(`Resultado: La clave "${licenseKey}" NO FUE ENCONTRADA.`);
    return res.status(404).json({ message: 'La clave de licencia no es válida.' });
  }
  
  console.log(`Resultado: La clave "${licenseKey}" FUE ENCONTRADA.`);

  if (license.used && license.domain !== domain) {
      console.error(`Error: Licencia en uso en otro dominio: ${license.domain}`);
      return res.status(403).json({ message: 'Esta licencia ya está en uso en otro dominio.' });
  }

  // Marcar la licencia como usada
  validLicenses[licenseKey].used = true;
  validLicenses[licenseKey].domain = domain;

  const expiration = license.type === 'PRO_YEARLY' ? '365d' : '10y';
  const tokenPayload = { uuid, domain, type: license.type };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: expiration });

  console.log(`Licencia '${licenseKey}' activada con éxito.`);

  // Enviar la respuesta de éxito
  return res.status(200).json({
    message: 'Licencia activada con éxito.',
    token,
  });
};
