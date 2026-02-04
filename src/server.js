/**
 * Utiles Backend Server
 * Generic CRUD API for MongoDB collections
 *
 * @description Express server with dynamic MongoDB CRUD operations
 * @author Utiles Ya
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { connectToDatabase, closeConnection, isConnected } = require('./config/database');
const apiRoutes = require('./routes/api');
const uploadRoutes = require('./routes/uploadRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Initialize Express app
const app = express();

// Create HTTP server for Socket.io
const server = http.createServer(app);

// Configuration
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: NODE_ENV === 'development' ? '*' : [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'https://utiles-ya.netlify.app',
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ['GET', 'POST']
  }
});

// Make io available to routes
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join admin room
  socket.on('join:admin', () => {
    socket.join('admin');
    console.log(`Socket ${socket.id} joined admin room`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'https://utiles-ya.netlify.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // In development, allow all origins
    if (NODE_ENV === 'development') {
      return callback(null, true);
    }

    // In production, check against allowed origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, restrict later
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (only in development)
if (NODE_ENV === 'development') {
  app.use(requestLogger);
}

// Favicon handler (prevents 404 errors in browser)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbConnected = await isConnected();
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
    environment: NODE_ENV
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Utiles Backend API',
    version: '1.0.0',
    description: 'Generic CRUD API for MongoDB collections',
    documentation: '/api-docs',
    endpoints: {
      health: '/health',
      api: '/api/:database/:collection'
    }
  });
});

// API Documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    title: 'Utiles Backend API Documentation',
    version: '1.0.0',
    baseUrl: '/api/:database/:collection',
    endpoints: [
      {
        method: 'GET',
        path: '/api/:database/:collection',
        description: 'Get all documents from a collection',
        queryParams: {
          page: 'Page number (starts at 1)',
          limit: 'Documents per page (max 100)',
          sort: 'Sort fields (e.g., "price:asc,name:desc")',
          fields: 'Projection fields (e.g., "name,price,category")',
          '[field]': 'Filter by field value',
          '[field]=gte:value': 'Greater than or equal',
          '[field]=lte:value': 'Less than or equal',
          '[field]=regex:pattern': 'Regex search (case insensitive)'
        }
      },
      {
        method: 'GET',
        path: '/api/:database/:collection/:id',
        description: 'Get a single document by ID'
      },
      {
        method: 'POST',
        path: '/api/:database/:collection',
        description: 'Create a new document',
        body: 'JSON object with document data'
      },
      {
        method: 'POST',
        path: '/api/:database/:collection/bulk',
        description: 'Create multiple documents',
        body: 'JSON array of documents'
      },
      {
        method: 'PUT',
        path: '/api/:database/:collection/:id',
        description: 'Update a document (full replacement)',
        body: 'JSON object with updated data'
      },
      {
        method: 'PATCH',
        path: '/api/:database/:collection/:id',
        description: 'Partially update a document',
        body: 'JSON object with fields to update'
      },
      {
        method: 'DELETE',
        path: '/api/:database/:collection/:id',
        description: 'Delete a document by ID'
      },
      {
        method: 'DELETE',
        path: '/api/:database/:collection/bulk',
        description: 'Delete multiple documents by filter',
        body: 'JSON object with filter criteria'
      },
      {
        method: 'GET',
        path: '/api/:database/:collection/count',
        description: 'Count documents in collection'
      },
      {
        method: 'GET',
        path: '/api/:database/:collection/distinct/:field',
        description: 'Get distinct values for a field'
      },
      {
        method: 'POST',
        path: '/api/:database/:collection/search',
        description: 'Advanced search with aggregation pipeline',
        body: '{ "pipeline": [...] }'
      },
      {
        method: 'GET',
        path: '/api/cache/stats',
        description: 'Get cache statistics (entries, keys)'
      },
      {
        method: 'POST',
        path: '/api/cache/clear',
        description: 'Clear cache (all or by pattern)',
        body: '{ "pattern": "database/collection" } (optional)'
      },
      {
        method: 'POST',
        path: '/api/cache/cleanup',
        description: 'Remove expired cache entries'
      }
    ],
    examples: {
      getAllProducts: 'GET /api/ecommerce/products',
      getProductById: 'GET /api/ecommerce/products/507f1f77bcf86cd799439011',
      createProduct: 'POST /api/ecommerce/products with JSON body',
      filterByCategory: 'GET /api/ecommerce/products?category=notebooks',
      paginateResults: 'GET /api/ecommerce/products?page=1&limit=10',
      sortResults: 'GET /api/ecommerce/products?sort=price:asc',
      searchByName: 'GET /api/ecommerce/products?name=regex:pencil',
      clearProductsCache: 'POST /api/cache/clear with { "pattern": "utiles/products" }'
    }
  });
});

// API Routes
app.use('/api', apiRoutes);
app.use('/api/upload', uploadRoutes);

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  await closeConnection();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Start HTTP server (with Socket.io)
    server.listen(PORT, () => {
      console.log(`
========================================
  Utiles Backend API Server
========================================
  Environment: ${NODE_ENV}
  Port: ${PORT}
  URL: http://localhost:${PORT}
  API: http://localhost:${PORT}/api/:database/:collection
  Docs: http://localhost:${PORT}/api-docs
  Socket.io: Enabled
========================================
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run server
startServer();

module.exports = app;
