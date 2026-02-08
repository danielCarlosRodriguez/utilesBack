const cache = require('../cache/cacheManager');
const { createAnalyticsClient } = require('../config/analytics');

const VALID_PERIODS = ['week', 'month', 'year'];
const PERIOD_DAYS = {
  week: 7,
  month: 30,
  year: 365
};

function getDateRange(period, offsetPeriods = 0) {
  const days = PERIOD_DAYS[period] || 7;
  if (offsetPeriods === 0) {
    return { startDate: `${days}daysAgo`, endDate: 'today' };
  }
  const startDaysAgo = days * (offsetPeriods + 1);
  const endDaysAgo = days * offsetPeriods + 1;
  return { startDate: `${startDaysAgo}daysAgo`, endDate: `${endDaysAgo}daysAgo` };
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  return `${day}/${month}/${year}`;
}

async function runSummaryReport(client, propertyId, period, offsetPeriods = 0) {
  const { startDate, endDate } = getDateRange(period, offsetPeriods);
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

async function runDailyReport(client, propertyId, period, offsetPeriods = 0) {
  const { startDate, endDate } = getDateRange(period, offsetPeriods);
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
  const compare = req.query.compare === 'prev';
  const cacheKey = compare ? `analytics:${period}:prev` : `analytics:${period}`;

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
    const offsetPeriods = compare ? 1 : 0;
    const summary = await runSummaryReport(client, propertyId, period, offsetPeriods);
    const daily = await runDailyReport(client, propertyId, period, offsetPeriods);
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
