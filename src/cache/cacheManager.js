/**
 * Cache Manager
 * In-memory cache with TTL (Time To Live) support
 */

// Cache storage
const cache = new Map();

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

// TTL configuration by collection pattern
const TTL_CONFIG = {
  'utiles/products': 10 * 60 * 1000,  // 10 minutes for products
  'default': DEFAULT_TTL
};

/**
 * Get TTL for a specific cache key
 * @param {string} key - Cache key
 * @returns {number} TTL in milliseconds
 */
function getTTL(key) {
  for (const [pattern, ttl] of Object.entries(TTL_CONFIG)) {
    if (pattern !== 'default' && key.startsWith(pattern)) {
      return ttl;
    }
  }
  return TTL_CONFIG.default;
}

/**
 * Get a value from cache
 * @param {string} key - Cache key
 * @returns {*} Cached value or null if not found/expired
 */
function get(key) {
  const item = cache.get(key);

  if (!item) {
    return null;
  }

  // Check if expired
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }

  return item.data;
}

/**
 * Get a value from cache even if expired (stale)
 * @param {string} key - Cache key
 * @returns {object|null} Cached item metadata or null if not found
 */
function getStale(key) {
  const item = cache.get(key);
  if (!item) {
    return null;
  }

  return {
    data: item.data,
    expiry: item.expiry,
    createdAt: item.createdAt,
    isExpired: Date.now() > item.expiry
  };
}

/**
 * Set a value in cache
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} ttl - Optional TTL in milliseconds
 */
function set(key, data, ttl) {
  const effectiveTTL = ttl || getTTL(key);

  cache.set(key, {
    data,
    expiry: Date.now() + effectiveTTL,
    createdAt: new Date().toISOString()
  });
}

/**
 * Delete a specific key from cache
 * @param {string} key - Cache key to delete
 */
function del(key) {
  cache.delete(key);
}

/**
 * Clear all cache entries
 */
function clear() {
  cache.clear();
}

/**
 * Invalidate cache entries matching a pattern
 * @param {string} pattern - Pattern prefix to match (e.g., "utiles/products")
 * @returns {number} Number of entries invalidated
 */
function invalidatePattern(pattern) {
  let count = 0;

  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
      count++;
    }
  }

  return count;
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
function getStats() {
  const now = Date.now();
  let validCount = 0;
  let expiredCount = 0;

  for (const [key, item] of cache.entries()) {
    if (now > item.expiry) {
      expiredCount++;
    } else {
      validCount++;
    }
  }

  return {
    totalEntries: cache.size,
    validEntries: validCount,
    expiredEntries: expiredCount,
    keys: Array.from(cache.keys())
  };
}

/**
 * Clean up expired entries (can be called periodically)
 * @returns {number} Number of entries cleaned
 */
function cleanup() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, item] of cache.entries()) {
    if (now > item.expiry) {
      cache.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Auto-cleanup every 10 minutes
setInterval(cleanup, 10 * 60 * 1000);

module.exports = {
  get,
  getStale,
  set,
  del,
  clear,
  invalidatePattern,
  getStats,
  cleanup,
  getTTL
};
