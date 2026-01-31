/**
 * Generic API Routes
 * Dynamic CRUD routes for any MongoDB database/collection
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/genericController');
const cache = require('../cache/cacheManager');

/**
 * Cache Management Routes (must be before dynamic routes)
 */

// Get cache statistics
router.get('/cache/stats', (req, res) => {
  const stats = cache.getStats();
  res.json({
    success: true,
    data: stats
  });
});

// Clear all cache or by pattern
router.post('/cache/clear', (req, res) => {
  const { pattern } = req.body;

  if (pattern) {
    const count = cache.invalidatePattern(pattern);
    res.json({
      success: true,
      message: `Cache cleared for pattern: ${pattern}`,
      entriesCleared: count
    });
  } else {
    cache.clear();
    res.json({
      success: true,
      message: 'All cache cleared'
    });
  }
});

// Manual cache cleanup (remove expired entries)
router.post('/cache/cleanup', (req, res) => {
  const cleaned = cache.cleanup();
  res.json({
    success: true,
    message: `Cleaned ${cleaned} expired entries`
  });
});

/**
 * API Routes Pattern: /api/:database/:collection
 *
 * Examples:
 * - GET    /api/ecommerce/products       - Get all products
 * - GET    /api/ecommerce/products/:id   - Get one product
 * - POST   /api/ecommerce/products       - Create product
 * - PUT    /api/ecommerce/products/:id   - Update product (full)
 * - PATCH  /api/ecommerce/products/:id   - Update product (partial)
 * - DELETE /api/ecommerce/products/:id   - Delete product
 */

// Count documents in collection
router.get('/:database/:collection/count', controller.count);

// Get distinct values for a field
router.get('/:database/:collection/distinct/:field', controller.distinct);

// Advanced search with aggregation pipeline
router.post('/:database/:collection/search', controller.search);

// Bulk create (must be before :id route)
router.post('/:database/:collection/bulk', controller.createMany);

// Bulk delete (must be before :id route)
router.delete('/:database/:collection/bulk', controller.removeMany);

// Standard CRUD operations
router.get('/:database/:collection', controller.getAll);
router.get('/:database/:collection/:id', controller.getOne);
router.post('/:database/:collection', controller.create);
router.put('/:database/:collection/:id', controller.update);
router.patch('/:database/:collection/:id', controller.patch);
router.delete('/:database/:collection/:id', controller.remove);

module.exports = router;
