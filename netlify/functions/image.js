/**
 * Greg's Marketplace – Image Serving
 * GET /api/image/:item-id/:number.jpg
 */
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const path = event.path || '';
  // Matches both /api/image/KEY and /.netlify/functions/image/KEY
  const match = path.match(/\/image\/(.+)$/);
  const key = match ? match[1] : null;

  if (!key || !/^[a-z0-9-]+\/\d+\.jpg$/.test(key)) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/plain' }, body: 'Invalid image key' };
  }

  try {
    const store = getStore({
      name: 'images',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });

    const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!result) return { statusCode: 404, body: 'Image not found' };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: Buffer.from(result.data).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/plain' }, body: err.message };
  }
};
