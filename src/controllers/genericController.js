/**
 * Generic CRUD Controller
 * Handles all CRUD operations for any MongoDB collection dynamically
 */

const { ObjectId } = require('mongodb');
const { getCollection } = require('../config/database');
const cache = require('../cache/cacheManager');

/**
 * Generate cache key from request
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {object} query - Query parameters
 * @returns {string} Cache key
 */
function getCacheKey(database, collection, query = {}) {
  const queryString = Object.keys(query).length > 0
    ? ':' + JSON.stringify(query)
    : '';
  return `${database}/${collection}${queryString}`;
}

/**
 * Invalidate cache for a collection
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 */
function invalidateCollectionCache(database, collection) {
  const pattern = `${database}/${collection}`;
  const count = cache.invalidatePattern(pattern);
  console.log(`Cache invalidated: ${pattern} (${count} entries)`);
}

/**
 * Validate if a string is a valid MongoDB ObjectId
 * @param {string} id - String to validate
 * @returns {boolean} True if valid ObjectId
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
}

/**
 * Parse query parameters for filtering, sorting, and pagination
 * @param {object} query - Express request query object
 * @returns {object} Parsed options
 */
function parseQueryOptions(query) {
  const options = {
    filter: {},
    sort: {},
    skip: 0,
    limit: 0,
    projection: {}
  };

  // Pagination
  if (query.page && query.limit) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
    options.skip = (page - 1) * limit;
    options.limit = limit;
  } else if (query.limit) {
    options.limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  }

  // Sorting: ?sort=field:asc,field2:desc
  if (query.sort) {
    const sortParts = query.sort.split(',');
    sortParts.forEach(part => {
      const [field, order] = part.split(':');
      if (field) {
        options.sort[field.trim()] = order?.toLowerCase() === 'desc' ? -1 : 1;
      }
    });
  }

  // Field projection: ?fields=name,price,description
  if (query.fields) {
    const fields = query.fields.split(',');
    fields.forEach(field => {
      if (field.trim()) {
        options.projection[field.trim()] = 1;
      }
    });
  }

  // Build filter from remaining query params
  const reservedParams = ['page', 'limit', 'sort', 'fields'];
  Object.keys(query).forEach(key => {
    if (!reservedParams.includes(key) && query[key] !== undefined) {
      const value = query[key];

      // Handle special operators
      if (typeof value === 'string') {
        // Range queries: field=gte:100 or field=lte:50
        if (value.startsWith('gte:')) {
          options.filter[key] = { $gte: parseFloat(value.slice(4)) };
        } else if (value.startsWith('lte:')) {
          options.filter[key] = { $lte: parseFloat(value.slice(4)) };
        } else if (value.startsWith('gt:')) {
          options.filter[key] = { $gt: parseFloat(value.slice(3)) };
        } else if (value.startsWith('lt:')) {
          options.filter[key] = { $lt: parseFloat(value.slice(3)) };
        } else if (value.startsWith('ne:')) {
          options.filter[key] = { $ne: value.slice(3) };
        } else if (value.startsWith('regex:')) {
          options.filter[key] = { $regex: value.slice(6), $options: 'i' };
        } else if (value.includes(',')) {
          // Array of values: field=value1,value2,value3
          options.filter[key] = { $in: value.split(',').map(v => v.trim()) };
        } else {
          options.filter[key] = value;
        }
      } else {
        options.filter[key] = value;
      }
    }
  });

  return options;
}

/**
 * GET all documents from a collection
 */
async function getAll(req, res, next) {
  try {
    const { database, collection } = req.params;
    const cacheKey = getCacheKey(database, collection, req.query);

    // Try to get from cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        meta: {
          ...cached.meta,
          source: 'cache'
        }
      });
    }

    const col = getCollection(database, collection);
    const options = parseQueryOptions(req.query);

    // Build query
    let cursor = col.find(options.filter);

    if (Object.keys(options.projection).length > 0) {
      cursor = cursor.project(options.projection);
    }

    if (Object.keys(options.sort).length > 0) {
      cursor = cursor.sort(options.sort);
    }

    if (options.skip > 0) {
      cursor = cursor.skip(options.skip);
    }

    if (options.limit > 0) {
      cursor = cursor.limit(options.limit);
    }

    const documents = await cursor.toArray();
    const total = await col.countDocuments(options.filter);

    const response = {
      success: true,
      data: documents,
      meta: {
        total,
        count: documents.length,
        database,
        collection,
        source: 'database'
      }
    };

    // Store in cache
    cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    // If database fails, try to serve stale cache (best-effort)
    const { database, collection } = req.params || {};
    const cacheKey = database && collection
      ? getCacheKey(database, collection, req.query)
      : null;
    const stale = cacheKey ? cache.getStale(cacheKey) : null;

    if (stale && stale.data) {
      return res.status(200).json({
        ...stale.data,
        meta: {
          ...(stale.data.meta || {}),
          source: 'cache-stale',
          stale: true,
          cache: {
            createdAt: stale.createdAt,
            expiry: new Date(stale.expiry).toISOString(),
            isExpired: stale.isExpired
          }
        },
        warning: 'Serving stale data due to database error'
      });
    }

    next(error);
  }
}

/**
 * GET a single document by ID
 */
async function getOne(req, res, next) {
  try {
    const { database, collection, id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID format'
      });
    }

    const col = getCollection(database, collection);
    const document = await col.findOne({ _id: new ObjectId(id) });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST - Create a new document
 */
async function create(req, res, next) {
  try {
    const { database, collection } = req.params;
    const data = req.body;

    // Validate request body
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body cannot be empty'
      });
    }

    // Remove _id if provided (let MongoDB generate it)
    if (data._id) {
      delete data._id;
    }

    // Add timestamps
    data.createdAt = new Date();
    data.updatedAt = new Date();

    const col = getCollection(database, collection);
    const result = await col.insertOne(data);

    // Invalidate cache for this collection
    invalidateCollectionCache(database, collection);

    res.status(201).json({
      success: true,
      data: {
        _id: result.insertedId,
        ...data
      },
      message: 'Document created successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST - Create multiple documents (bulk insert)
 */
async function createMany(req, res, next) {
  try {
    const { database, collection } = req.params;
    const data = req.body;

    // Validate request body is an array
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must be a non-empty array'
      });
    }

    // Process each document
    const documents = data.map(doc => {
      const { _id, ...rest } = doc;
      return {
        ...rest,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    const col = getCollection(database, collection);
    const result = await col.insertMany(documents);

    // Invalidate cache for this collection
    invalidateCollectionCache(database, collection);

    res.status(201).json({
      success: true,
      data: {
        insertedCount: result.insertedCount,
        insertedIds: result.insertedIds
      },
      message: `${result.insertedCount} documents created successfully`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT - Update a document by ID (full replacement)
 */
async function update(req, res, next) {
  try {
    const { database, collection, id } = req.params;
    const data = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID format'
      });
    }

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body cannot be empty'
      });
    }

    // Remove _id from update data
    delete data._id;

    // Update timestamp
    data.updatedAt = new Date();

    const col = getCollection(database, collection);
    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: data },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Invalidate cache for this collection
    invalidateCollectionCache(database, collection);

    res.json({
      success: true,
      data: result,
      message: 'Document updated successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH - Partial update of a document
 */
async function patch(req, res, next) {
  try {
    const { database, collection, id } = req.params;
    const data = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID format'
      });
    }

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body cannot be empty'
      });
    }

    // Remove _id from update data
    delete data._id;

    // Update timestamp
    data.updatedAt = new Date();

    const col = getCollection(database, collection);
    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: data },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Invalidate cache for this collection
    invalidateCollectionCache(database, collection);

    res.json({
      success: true,
      data: result,
      message: 'Document patched successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE - Delete a document by ID
 */
async function remove(req, res, next) {
  try {
    const { database, collection, id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID format'
      });
    }

    const col = getCollection(database, collection);
    const result = await col.findOneAndDelete({ _id: new ObjectId(id) });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Invalidate cache for this collection
    invalidateCollectionCache(database, collection);

    res.json({
      success: true,
      data: result,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE - Delete multiple documents by filter
 */
async function removeMany(req, res, next) {
  try {
    const { database, collection } = req.params;
    const filter = req.body;

    if (!filter || Object.keys(filter).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Filter criteria required in request body to prevent accidental deletion of all documents'
      });
    }

    const col = getCollection(database, collection);
    const result = await col.deleteMany(filter);

    // Invalidate cache for this collection
    invalidateCollectionCache(database, collection);

    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount
      },
      message: `${result.deletedCount} documents deleted successfully`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET - Count documents in collection
 */
async function count(req, res, next) {
  try {
    const { database, collection } = req.params;
    const options = parseQueryOptions(req.query);

    const col = getCollection(database, collection);
    const total = await col.countDocuments(options.filter);

    res.json({
      success: true,
      data: {
        count: total
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET - Get distinct values for a field
 */
async function distinct(req, res, next) {
  try {
    const { database, collection, field } = req.params;
    const options = parseQueryOptions(req.query);

    const col = getCollection(database, collection);
    const values = await col.distinct(field, options.filter);

    res.json({
      success: true,
      data: values,
      meta: {
        field,
        count: values.length
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST - Search with advanced query (aggregation)
 */
async function search(req, res, next) {
  try {
    const { database, collection } = req.params;
    const { pipeline } = req.body;

    if (!pipeline || !Array.isArray(pipeline)) {
      return res.status(400).json({
        success: false,
        error: 'Aggregation pipeline must be provided as an array'
      });
    }

    const col = getCollection(database, collection);
    const results = await col.aggregate(pipeline).toArray();

    res.json({
      success: true,
      data: results,
      meta: {
        count: results.length
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAll,
  getOne,
  create,
  createMany,
  update,
  patch,
  remove,
  removeMany,
  count,
  distinct,
  search
};
