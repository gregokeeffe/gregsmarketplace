/**
 * Greg's Marketplace – Admin Authentication
 * POST /api/admin-auth  { password: "..." }
 * Returns { token: "sha256hash" } on success, { error: "..." } on failure
 */
import { createHash } from 'crypto';

export default async (request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  const { password } = body || {};
  if (!password || typeof password !== 'string') {
    return Response.json({ error: 'Password required' }, { status: 400, headers: corsHeaders });
  }

  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

  if (password !== adminPassword) {
    // Avoid timing attacks with a brief delay
    await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
    return Response.json({ error: 'Invalid password' }, { status: 401, headers: corsHeaders });
  }

  const token = createHash('sha256').update(adminPassword).digest('hex');
  return Response.json({ token }, { headers: corsHeaders });
};

export const config = {
  path: '/api/admin-auth',
};
