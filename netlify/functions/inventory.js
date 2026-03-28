/**
 * Greg's Marketplace – Live Inventory API
 * GET  /.netlify/functions/inventory  → returns inventory
 * POST /.netlify/functions/inventory  → saves inventory (admin token required)
 */
const { getStore } = require('@netlify/blobs');
const { createHash } = require('crypto');
const { readFileSync } = require('fs');
const path = require('path');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

function getAdminToken() {
  const pw = process.env.ADMIN_PASSWORD || 'changeme';
  return createHash('sha256').update(pw).digest('hex');
}

function json(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod === 'GET') {
    // Try Netlify Blobs first
    try {
      const store = getStore({
        name: 'inventory',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN,
      });
      const data = await store.get('current', { type: 'json' });
      if (data) return json(200, data);
    } catch (_) {
      // Blobs not available – fall through to static file
    }

    // Fall back to seed JSON file
    try {
      const seedPath = path.join(__dirname, '../../data/inventory.json');
      const raw = readFileSync(seedPath, 'utf8');
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...CORS }, body: raw };
    } catch (err) {
      return json(404, { error: 'Inventory not found' });
    }
  }

  if (event.httpMethod === 'POST') {
    const token = (event.headers['x-admin-token'] || '').trim();
    if (token !== getAdminToken()) {
      return json(401, { error: 'Unauthorized' });
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (_) {
      return json(400, { error: 'Invalid JSON' });
    }

    if (!body || !Array.isArray(body.items)) {
      return json(400, { error: 'Invalid inventory format – missing items array' });
    }

    try {
      const store = getStore({
        name: 'inventory',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN,
      });
      await store.setJSON('current', body);
      return json(200, { success: true });
    } catch (err) {
      return json(500, { error: err.message || 'Storage error' });
    }
  }

  return json(405, { error: 'Method not allowed' });
};
