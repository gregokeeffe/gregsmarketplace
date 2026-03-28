/**
 * Greg's Marketplace – Image Upload
 * POST /api/upload-image  { imageData: "data:image/jpeg;base64,...", key: "item-id/1.jpg" }
 */
const { getStore } = require('@netlify/blobs');
const { createHash } = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

function getAdminToken() {
  const pw = process.env.ADMIN_PASSWORD || 'changeme';
  return createHash('sha256').update(pw).digest('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const token = (event.headers['x-admin-token'] || '').trim();
  if (token !== getAdminToken()) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch (_) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { imageData, key } = body || {};
  if (!imageData || !key) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'imageData and key required' }) };

  // Validate key format: item-id/number.jpg (prevent path traversal)
  if (!/^[a-z0-9-]+\/\d+\.jpg$/.test(key)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid key format. Expected: item-id/1.jpg' }) };
  }

  try {
    const base64 = imageData.replace(/^data:image\/jpeg;base64,/, '');
    const imageBuffer = Buffer.from(base64, 'base64');

    const store = getStore({
      name: 'images',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });

    await store.set(key, imageBuffer, { metadata: { contentType: 'image/jpeg' } });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ url: `/api/image/${key}`, key }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message || 'Storage error' }) };
  }
};
