const cache = require('../cache/cacheManager');
const { createAnalyticsClient } = require('../config/analytics');

const VALID_PERIODS = ['week', 'month', 'year'];

function getDateRange(period) {
  if (period === 'year') {
    return { startDate: '365daysAgo', endDate: 'today' };
  }
  if (period === 'month') {
    return { startDate: '30daysAgo', endDate: 'today' };
  }
  return { startDate: '7daysAgo', endDate: 'today' };
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  return `${day}/${month}/${year}`;
}

async function runSummaryReport(client, propertyId, period) {
  const { startDate, endDate } = getDateRange(period);
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' }
    ]
  });

  const values = response.rows?.[0]?.metricValues || [];
  const toNumber = (idx) => Number(values[idx]?.value || 0);

  return {
    sessions: toNumber(0),
    totalUsers: toNumber(1),
    newUsers: toNumber(2),
    pageViews: toNumber(3),
    avgSessionDuration: toNumber(4),
    bounceRate: toNumber(5)
  };
}

async function runDailyReport(client, propertyId, period) {
  const { startDate, endDate } = getDateRange(period);
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' }
    ]
  });

  return (response.rows || []).map((row) => {
    const date = row.dimensionValues?.[0]?.value || '';
    const metrics = row.metricValues || [];
    return {
      date,
      label: formatDateLabel(date),
      sessions: Number(metrics[0]?.value || 0),
      users: Number(metrics[1]?.value || 0),
      pageViews: Number(metrics[2]?.value || 0)
    };
  });
}

async function getAnalytics(req, res) {
  const period = VALID_PERIODS.includes(req.query.period)
    ? req.query.period
    : 'week';
  const cacheKey = `analytics:${period}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached, cached: true });
  }

  const { client, propertyId, error } = createAnalyticsClient();
  if (!client || !propertyId) {
    return res.status(500).json({
      success: false,
      error: error || 'Analytics client no configurado'
    });
  }

  try {
    const summary = await runSummaryReport(client, propertyId, period);
    const daily = await runDailyReport(client, propertyId, period);
    const payload = { period, summary, daily };
    cache.set(cacheKey, payload);
    return res.json({ success: true, data: payload, cached: false });
  } catch (err) {
    console.error('analyticsController error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error al consultar GA4'
    });
  }
}

module.exports = {
  getAnalytics
};
