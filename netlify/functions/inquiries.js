/**
 * Greg's Marketplace – Inquiries API
 * GET   /api/inquiries  → list all (admin token required)
 * POST  /api/inquiries  → submit inquiry (public)
 * PATCH /api/inquiries  → update status / notes (admin token required)
 */
const { getStore } = require('@netlify/blobs');
const { createHash } = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

function adminToken() {
  return createHash('sha256').update(process.env.ADMIN_PASSWORD || 'changeme').digest('hex');
}
function store() {
  return getStore({ name: 'inquiries', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_TOKEN });
}
function json(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const isAdmin = (event.headers['x-admin-token'] || '').trim() === adminToken();

  /* GET — admin only */
  if (event.httpMethod === 'GET') {
    if (!isAdmin) return json(401, { error: 'Unauthorized' });
    try {
      const data = await store().get('current', { type: 'json' }) || { inquiries: [] };
      return json(200, data);
    } catch (err) { return json(500, { error: err.message }); }
  }

  /* POST — public: submit new inquiry */
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body); } catch (_) { return json(400, { error: 'Invalid JSON' }); }

    const { itemId, itemTitle, name, fulfillment, payment, replyMethod, contact, question, pickupTimes } = body;
    if (!itemId || !name || !fulfillment || !payment || !replyMethod || !contact) {
      return json(400, { error: 'Missing required fields' });
    }

    const inquiry = {
      id: 'inq-' + Date.now(),
      submittedAt: new Date().toISOString(),
      status: 'new',
      adminNotes: '',
      itemId,
      itemTitle: itemTitle || itemId,
      name: name.trim(),
      fulfillment,
      payment,
      replyMethod,
      contact: contact.trim(),
      question: (question || '').trim(),
      pickupTimes: (pickupTimes || '').trim(),
    };

    try {
      const s = store();
      const existing = await s.get('current', { type: 'json' }) || { inquiries: [] };
      existing.inquiries.unshift(inquiry);
      await s.setJSON('current', existing);
      return json(200, { success: true, id: inquiry.id });
    } catch (err) { return json(500, { error: err.message }); }
  }

  /* PATCH — admin: update status / notes */
  if (event.httpMethod === 'PATCH') {
    if (!isAdmin) return json(401, { error: 'Unauthorized' });
    let body;
    try { body = JSON.parse(event.body); } catch (_) { return json(400, { error: 'Invalid JSON' }); }

    const { id, status, adminNotes } = body;
    if (!id) return json(400, { error: 'Missing id' });

    try {
      const s = store();
      const data = await s.get('current', { type: 'json' }) || { inquiries: [] };
      const inq = data.inquiries.find(i => i.id === id);
      if (!inq) return json(404, { error: 'Inquiry not found' });
      if (status !== undefined) inq.status = status;
      if (adminNotes !== undefined) inq.adminNotes = adminNotes;
      await s.setJSON('current', data);
      return json(200, { success: true });
    } catch (err) { return json(500, { error: err.message }); }
  }

  return json(405, { error: 'Method not allowed' });
};
