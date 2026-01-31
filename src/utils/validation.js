/**
 * Input Validation Utilities
 * Helper functions for validating API inputs
 */

const { ObjectId } = require('mongodb');

/**
 * Validate MongoDB ObjectId
 * @param {string} id - String to validate
 * @returns {boolean} True if valid ObjectId
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
}

/**
 * Validate database name
 * @param {string} name - Database name
 * @returns {boolean} True if valid
 */
function isValidDatabaseName(name) {
  if (!name || typeof name !== 'string') return false;
  // MongoDB database names can't contain: /\. "$*<>:|?
  const invalidChars = /[\/\\.\s"$*<>:|?]/;
  return !invalidChars.test(name) && name.length > 0 && name.length <= 64;
}

/**
 * Validate collection name
 * @param {string} name - Collection name
 * @returns {boolean} True if valid
 */
function isValidCollectionName(name) {
  if (!name || typeof name !== 'string') return false;
  // Collection names can't start with "system." or contain "$" or null character
  if (name.startsWith('system.')) return false;
  if (name.includes('$') || name.includes('\0')) return false;
  return name.length > 0 && name.length <= 255;
}

/**
 * Sanitize object by removing dangerous keys
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = {};
  const dangerousKeys = ['$where', '$function', '$accumulator', '$emit'];

  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous MongoDB operators at root level
    if (dangerousKeys.some(dk => key.includes(dk))) continue;

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'object' ? sanitizeObject(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Validate required fields in an object
 * @param {object} obj - Object to validate
 * @param {string[]} requiredFields - List of required field names
 * @returns {{valid: boolean, missing: string[]}} Validation result
 */
function validateRequiredFields(obj, requiredFields) {
  const missing = [];

  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

module.exports = {
  isValidObjectId,
  isValidDatabaseName,
  isValidCollectionName,
  sanitizeObject,
  validateRequiredFields
};
