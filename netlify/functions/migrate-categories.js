/**
 * One-time migration: rename legacy category values in live Blobs data.
 * POST /api/migrate-categories  (admin token required)
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

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify(body),
  };
}

const CATEGORY_MAP = {
  'Bicycles':       'Bicycles & Parts',
  'Bicycle Parts':  'Bicycles & Parts',
  'Furniture':      'Furniture & Household Items',
  'Household Goods':'Furniture & Household Items',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const token = (event.headers['x-admin-token'] || '').trim();
  if (token !== getAdminToken()) return json(401, { error: 'Unauthorized' });

  try {
    const store = getStore({
      name: 'inventory',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });
    const data = await store.get('current', { type: 'json' });

    if (!data || !data.items) return json(400, { error: 'No inventory data found at key "current"' });

    let migrated = 0;
    data.items = data.items.map(item => {
      const mapped = CATEGORY_MAP[item.category];
      if (mapped) {
        migrated++;
        return { ...item, category: mapped };
      }
      return item;
    });

    await store.setJSON('current', data);

    return json(200, {
      success: true,
      migrated,
      total: data.items.length,
      message: `Updated ${migrated} of ${data.items.length} items`,
    });
  } catch (err) {
    return json(500, { error: err.message });
  }
};
