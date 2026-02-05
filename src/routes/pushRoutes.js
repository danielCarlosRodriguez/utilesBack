/**
 * Push notification token registration routes
 */

const express = require('express');
const router = express.Router();
const { getCollection } = require('../config/database');

const DATABASE = 'utiles';
const COLLECTION = 'pushTokens';

/**
 * POST /api/push/register
 * Register or update a push token
 * Body: { token: string, deviceName: string }
 */
router.post('/register', async (req, res) => {
  try {
    const { token, deviceName } = req.body;

    if (!token || !token.startsWith('ExponentPushToken[')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Expo push token'
      });
    }

    const col = getCollection(DATABASE, COLLECTION);

    await col.updateOne(
      { token },
      {
        $set: {
          token,
          deviceName: deviceName || 'Unknown',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Push token registered'
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register push token'
    });
  }
});

/**
 * DELETE /api/push/register/:token
 * Unregister a push token
 */
router.delete('/register/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const col = getCollection(DATABASE, COLLECTION);

    await col.deleteOne({ token });

    res.json({
      success: true,
      message: 'Push token removed'
    });
  } catch (error) {
    console.error('Error removing push token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove push token'
    });
  }
});

module.exports = router;
