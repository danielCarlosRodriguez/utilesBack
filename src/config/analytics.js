/**
 * Google Analytics GA4 client config
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

function parseCredentials(raw) {
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error('GA4_CREDENTIALS_JSON no es un JSON válido');
  }
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

function createAnalyticsClient() {
  if (!process.env.GA4_PROPERTY_ID) {
    return { client: null, propertyId: null, error: 'Falta GA4_PROPERTY_ID' };
  }
  if (!process.env.GA4_CREDENTIALS_JSON) {
    return { client: null, propertyId: null, error: 'Falta GA4_CREDENTIALS_JSON' };
  }

  const credentials = parseCredentials(process.env.GA4_CREDENTIALS_JSON);
  const client = new BetaAnalyticsDataClient({ credentials });
  const propertyId = process.env.GA4_PROPERTY_ID;

  return { client, propertyId, error: null };
}

module.exports = {
  createAnalyticsClient
};
