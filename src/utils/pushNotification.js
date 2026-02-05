/**
 * Push Notification utility
 * Sends push notifications via Expo Push API
 */

const { getCollection } = require('../config/database');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const DATABASE = 'utiles';
const PUSH_TOKENS_COLLECTION = 'pushTokens';

/**
 * Send push notification to all registered devices
 * @param {object} message - { title, body, data }
 */
async function sendPushToAll(message) {
  try {
    const col = getCollection(DATABASE, PUSH_TOKENS_COLLECTION);
    const tokenDocs = await col.find({}).toArray();

    if (tokenDocs.length === 0) {
      console.log('Push: No registered tokens found');
      return;
    }

    const messages = tokenDocs.map(doc => ({
      to: doc.token,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data || {}
    }));

    // Expo accepts batches of up to 100
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk)
      });

      const result = await response.json();

      // Clean up invalid tokens
      if (result.data) {
        for (let i = 0; i < result.data.length; i++) {
          const pushResult = result.data[i];
          if (pushResult.status === 'error' &&
              pushResult.details?.error === 'DeviceNotRegistered') {
            const badToken = chunk[i].to;
            await col.deleteOne({ token: badToken });
            console.log(`Push: Removed invalid token ${badToken}`);
          }
        }
      }
    }

    console.log(`Push: Sent to ${tokenDocs.length} device(s)`);
  } catch (error) {
    console.error('Push: Error sending notifications:', error);
  }
}

/**
 * Send notification for a new order
 * @param {object} orderData - The created order document
 */
async function sendNewOrderNotification(orderData) {
  console.log('Push: sendNewOrderNotification called', { _id: orderData._id, orderNumber: orderData.orderNumber, orderId: orderData.orderId });
  const orderNumber = orderData.orderNumber || orderData.orderId || 'nueva';
  const customerName = orderData.customerName || 'Cliente';
  const total = orderData.totals?.total || orderData.total || 0;

  await sendPushToAll({
    title: `Nuevo pedido #${orderNumber}`,
    body: `${customerName} - $${total}`,
    data: {
      orderId: orderData._id?.toString(),
      screen: 'order-detail'
    }
  });
}

module.exports = {
  sendPushToAll,
  sendNewOrderNotification
};
