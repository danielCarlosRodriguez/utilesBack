/**
 * Generic API Routes
 * Dynamic CRUD routes for any MongoDB database/collection
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/genericController');

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
