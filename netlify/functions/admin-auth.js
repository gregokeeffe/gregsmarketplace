/**
 * Greg's Marketplace – Admin Authentication
 * POST /.netlify/functions/admin-auth  { "password": "..." }
 */
const { createHash } = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (_) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { password } = body || {};
  if (!password || typeof password !== 'string') {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Password required' }) };
  }

  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

  if (password !== adminPassword) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid password' }) };
  }

  const token = createHash('sha256').update(adminPassword).digest('hex');
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ token }) };
};
