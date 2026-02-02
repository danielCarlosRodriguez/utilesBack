/**
 * Order Controller
 * Specific endpoints for order management
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../config/database');
const cache = require('../cache/cacheManager');

const DATABASE = 'utiles';
const COLLECTION = 'orders';

const VALID_STATUSES = ['pending', 'ready', 'shipped', 'delivered', 'cancelled'];

/**
 * Update order status
 * GET /api/order/:id/:status
 */
async function updateStatus(req, res, next) {
  try {
    const { id, status } = req.params;
    const { device } = req.query;

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID format'
      });
    }

    // Build update object
    const updateData = {
      status,
      updatedAt: new Date()
    };

    // Add delivery info if status is delivered and device is provided
    if (status === 'delivered' && device) {
      updateData.deliveredBy = device;
      updateData.deliveredAt = new Date();
    }

    const col = getCollection(DATABASE, COLLECTION);
    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Invalidate cache
    const pattern = `${DATABASE}/${COLLECTION}`;
    cache.invalidatePattern(pattern);

    // Emit Socket.io event
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('order:updated', {
        orderId: id,
        status,
        order: result
      });
      console.log(`Socket event emitted: order:updated for ${id} -> ${status}`);
    }

    res.json({
      success: true,
      data: result,
      message: `Order status updated to: ${status}`
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  updateStatus
};
