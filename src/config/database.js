/**
 * MongoDB Database Connection Module
 * Manages connection to MongoDB Atlas using the native driver
 */

const { MongoClient } = require('mongodb');

// MongoDB client instance (singleton pattern)
let client = null;
let db = null;

/**
 * Connect to MongoDB Atlas
 * @returns {Promise<MongoClient>} MongoDB client instance
 */
async function connectToDatabase() {
  if (client && client.topology && client.topology.isConnected()) {
    return client;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    console.log('Successfully connected to MongoDB Atlas');

    // Extract database name from URI or use default
    const dbName = extractDatabaseName(uri) || 'ecommerce';
    db = client.db(dbName);

    return client;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

/**
 * Extract database name from MongoDB URI
 * @param {string} uri - MongoDB connection string
 * @returns {string|null} Database name or null
 */
function extractDatabaseName(uri) {
  try {
    const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get a specific database instance
 * @param {string} dbName - Database name
 * @returns {Db} MongoDB database instance
 */
function getDatabase(dbName) {
  if (!client) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }
  return client.db(dbName);
}

/**
 * Get the default database instance
 * @returns {Db} Default MongoDB database instance
 */
function getDefaultDatabase() {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }
  return db;
}

/**
 * Get a collection from a specific database
 * @param {string} dbName - Database name
 * @param {string} collectionName - Collection name
 * @returns {Collection} MongoDB collection
 */
function getCollection(dbName, collectionName) {
  const database = getDatabase(dbName);
  return database.collection(collectionName);
}

/**
 * Close the database connection
 */
async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

/**
 * Health check for database connection
 * @returns {Promise<boolean>} True if connected
 */
async function isConnected() {
  try {
    if (!client) return false;
    await client.db('admin').command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  connectToDatabase,
  getDatabase,
  getDefaultDatabase,
  getCollection,
  closeConnection,
  isConnected
};
