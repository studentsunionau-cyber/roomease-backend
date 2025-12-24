// RoomEase Backend API Server - WITH POSTGRESQL
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

// Environment Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://roomease-au.netlify.app';
const DATABASE_URL = process.env.DATABASE_URL;

console.log('🏠 RoomEase API Starting...');
console.log('Environment:', process.env.NODE_ENV || 'development');

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully');
    console.log('📅 Server time:', res.rows[0].now);
  }
});

// Get property count
pool.query('SELECT COUNT(*) as count FROM properties', (err, res) => {
  if (err) {
    console.log('⚠️ Could not count properties (table may not exist yet)');
  } else {
    console.log('📊 Properties in database:', res.rows[0].count);
  }
});

// CORS Configuration
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============================================
// ROUTES
// ============================================

// Health Check
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM properties');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      properties: parseInt(result.rows[0].count),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed'
    });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: '🏠 Welcome to RoomEase API',
    version: '1.0.0',
    database: 'PostgreSQL',
    endpoints: {
      health: '/health',
      properties: '/api/properties',
      stats: '/api/stats',
      auth: '/api/auth/login'
    }
  });
});

// Statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM properties');
    const citiesResult = await pool.query('SELECT DISTINCT city FROM properties');
    const avgPriceResult = await pool.query('SELECT AVG(price) as avg FROM properties');
    const typeStats = await pool.query(`
      SELECT type, COUNT(*) as count 
      FROM properties 
      GROUP BY type
    `);

    const stats = {};
    typeStats.rows.forEach(row => {
      stats[row.type.toLowerCase().replace(' ', '_')] = parseInt(row.count);
    });

    res.json({
      totalProperties: parseInt(totalResult.rows[0].count),
      cities: citiesResult.rows.length,
      citiesList: citiesResult.rows.map(r => r.city),
      averagePrice: Math.round(parseFloat(avgPriceResult.rows[0].avg)),
      propertyTypes: stats
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get All Properties
app.get('/api/properties', async (req, res) => {
  try {
    let query = 'SELECT * FROM properties WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Filter by city
    if (req.query.city) {
      query += ` AND LOWER(city) = LOWER($${paramCount})`;
      params.push(req.query.city);
      paramCount++;
    }

    // Filter by type
    if (req.query.type) {
      query += ` AND LOWER(type) = LOWER($${paramCount})`;
      params.push(req.query.type);
      paramCount++;
    }

    // Filter by price range
    if (req.query.minPrice) {
      query += ` AND price >= $${paramCount}`;
      params.push(parseInt(req.query.minPrice));
      paramCount++;
    }
    if (req.query.maxPrice) {
      query += ` AND price <= $${paramCount}`;
      params.push(parseInt(req.query.maxPrice));
      paramCount++;
    }

    // Sorting
    if (req.query.sort === 'price_asc') {
      query += ' ORDER BY price ASC';
    } else if (req.query.sort === 'price_desc') {
      query += ' ORDER BY price DESC';
    } else if (req.query.sort === 'rating') {
      query += ' ORDER BY rating DESC NULLS LAST';
    } else {
      query += ' ORDER BY created_at DESC';
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM properties WHERE 1=1';
    const countParams = [];
    let countParamNum = 1;

    if (req.query.city) {
      countQuery += ` AND LOWER(city) = LOWER($${countParamNum})`;
      countParams.push(req.query.city);
      countParamNum++;
    }
    if (req.query.type) {
      countQuery += ` AND LOWER(type) = LOWER($${countParamNum})`;
      countParams.push(req.query.type);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      properties: result.rows
    });
  } catch (error) {
    console.error('Properties error:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get Single Property
app.get('/api/properties/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Property fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = `user_${Date.now()}`;
    await pool.query(
      'INSERT INTO users (id, email, password, name, role) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, hashedPassword, name, role || 'student']
    );

    // Generate token
    const token = jwt.sign(
      { id: userId, email, role: role || 'student' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: userId, email, name, role: role || 'student' }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create Booking
app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { propertyId, checkIn, checkOut } = req.body;

    // Verify property exists
    const propertyResult = await pool.query('SELECT id FROM properties WHERE id = $1', [propertyId]);
    if (propertyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Create booking
    const bookingId = `booking_${Date.now()}`;
    await pool.query(
      'INSERT INTO bookings (id, property_id, user_id, check_in, check_out, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [bookingId, propertyId, req.user.id, checkIn, checkOut, 'pending']
    );

    const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);

    res.status(201).json({
      message: 'Booking created successfully',
      booking: booking.rows[0]
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get User Bookings
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log('🚀 RoomEase API running on port', PORT);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, closing database pool...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});
