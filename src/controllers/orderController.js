/**
 * Order Controller
 * Specific endpoints for order management
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../config/database');
const cache = require('../cache/cacheManager');

const DATABASE = 'utiles';
const COLLECTION = 'orders';
const PRODUCTS_COLLECTION = 'products';

const VALID_STATUSES = ['pending', 'ready', 'shipped', 'delivered', 'cancelled'];

// Estados que requieren que el stock esté descontado
const STOCK_REQUIRED_STATUSES = ['ready', 'shipped', 'delivered'];

/**
 * Descuenta stock de los productos de una orden
 * Solo se ejecuta si stockDescontado !== true
 */
async function decrementStock(order) {
  if (order.stockDescontado === true) return false;
  if (!order.items || order.items.length === 0) return false;

  const productsCol = getCollection(DATABASE, PRODUCTS_COLLECTION);

  for (const item of order.items) {
    const refid = item.refid;
    const quantity = Number(item.quantity) || 0;
    if (!refid || quantity <= 0) continue;

    await productsCol.updateOne(
      { refid },
      { $inc: { stock: -quantity } }
    );
  }

  cache.invalidatePattern(`${DATABASE}/${PRODUCTS_COLLECTION}`);
  return true;
}

/**
 * Restaura stock de los productos de una orden
 * Solo se ejecuta si stockDescontado === true
 */
async function restoreStock(order) {
  if (order.stockDescontado !== true) return false;
  if (!order.items || order.items.length === 0) return false;

  const productsCol = getCollection(DATABASE, PRODUCTS_COLLECTION);

  for (const item of order.items) {
    const refid = item.refid;
    const quantity = Number(item.quantity) || 0;
    if (!refid || quantity <= 0) continue;

    await productsCol.updateOne(
      { refid },
      { $inc: { stock: quantity } }
    );
  }

  cache.invalidatePattern(`${DATABASE}/${PRODUCTS_COLLECTION}`);
  return true;
}

/**
 * Maneja el stock al cambiar de estado una orden.
 * Exportada para que genericController pueda usarla en PATCH.
 * @param {object} order - Documento de la orden ANTES del cambio
 * @param {string} newStatus - Nuevo estado
 * @returns {{ stockDescontado: boolean } | null}
 */
async function handleStockOnStatusChange(order, newStatus) {
  if (STOCK_REQUIRED_STATUSES.includes(newStatus)) {
    const did = await decrementStock(order);
    if (did) return { stockDescontado: true };
    return null;
  }

  if (newStatus === 'cancelled') {
    const did = await restoreStock(order);
    if (did) return { stockDescontado: false };
    return null;
  }

  return null;
}

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

    const col = getCollection(DATABASE, COLLECTION);

    // Obtener la orden actual antes de actualizar (necesaria para stock)
    const currentOrder = await col.findOne({ _id: new ObjectId(id) });
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Manejar stock según cambio de estado
    const stockUpdate = await handleStockOnStatusChange(currentOrder, status);

    // Build update object
    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (status === 'delivered' && device) {
      updateData.deliveredBy = device;
      updateData.deliveredAt = new Date();
    }

    if (stockUpdate) {
      Object.assign(updateData, stockUpdate);
    }

    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    // Invalidate cache
    cache.invalidatePattern(`${DATABASE}/${COLLECTION}`);

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
  updateStatus,
  handleStockOnStatusChange
};
