/**
 * Greg's Marketplace – Live Inventory API
 * GET  /api/inventory  → returns current inventory (from Netlify Blobs or seed JSON)
 * POST /api/inventory  → saves updated inventory (admin token required)
 */
import { getStore } from '@netlify/blobs';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getAdminToken() {
  const pw = process.env.ADMIN_PASSWORD || 'changeme';
  return createHash('sha256').update(pw).digest('hex');
}

export default async (request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === 'GET') {
    try {
      const store = getStore('inventory');
      const data = await store.get('current', { type: 'json' });
      if (data) {
        return Response.json(data, { headers: corsHeaders });
      }
    } catch (_) {
      // Blobs not configured (local dev without netlify dev, or first run)
    }

    // Fall back to static seed file
    try {
      const seedPath = join(__dirname, '../../data/inventory.json');
      const raw = await readFile(seedPath, 'utf8');
      return new Response(raw, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (_) {
      return Response.json(null, { status: 404, headers: corsHeaders });
    }
  }

  if (request.method === 'POST') {
    // Verify admin token
    const token = request.headers.get('x-admin-token') || '';
    const expected = getAdminToken();
    if (token !== expected) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
    }

    if (!body || !Array.isArray(body.items)) {
      return Response.json({ error: 'Invalid inventory format' }, { status: 400, headers: corsHeaders });
    }

    try {
      const store = getStore('inventory');
      await store.setJSON('current', body);
      return Response.json({ success: true }, { headers: corsHeaders });
    } catch (err) {
      return Response.json({ error: err.message || 'Storage error' }, { status: 500, headers: corsHeaders });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
};

export const config = {
  path: '/api/inventory',
};
