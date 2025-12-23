# 🚀 RoomEase Backend - Complete Deployment Guide
## Copy-Paste Ready Files for Heroku Deployment

---

## 📋 DEPLOYMENT STEPS OVERVIEW

1. Create a new folder on your computer called `roomease-backend`
2. Copy each file below into that folder
3. Deploy to Heroku using the commands provided
4. Your API will be live in 10 minutes!

---

## 📁 FILE 1: server.js

Create a file named `server.js` and copy this entire content:

```javascript
// RoomEase Backend API Server - Production Ready
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();

// Environment Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://roomease-au.netlify.app';

console.log('🏠 RoomEase API Starting...');

// CORS Configuration
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
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

// In-memory database
const db = {
  users: [],
  properties: [],
  bookings: [],
  reviews: [],
  messages: []
};

// Load property data
function loadRealData() {
  const listingsPath = path.join(__dirname, 'roomease_listings.json');
  
  try {
    if (fs.existsSync(listingsPath)) {
      const data = fs.readFileSync(listingsPath, 'utf8');
      const listings = JSON.parse(data);
      db.properties = listings;
      console.log(`✅ Loaded ${db.properties.length} properties`);
    }
  } catch (error) {
    console.error('Error loading data:', error.message);
  }
}

loadRealData();

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ROUTES

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    properties: db.properties.length
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: '🏠 RoomEase API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      properties: '/api/properties',
      stats: '/api/stats'
    }
  });
});

// Statistics
app.get('/api/stats', (req, res) => {
  const cities = [...new Set(db.properties.map(p => p.location.city))];
  const avgPrice = Math.round(
    db.properties.reduce((sum, p) => sum + p.price, 0) / db.properties.length
  );
  
  res.json({
    totalProperties: db.properties.length,
    cities: cities.length,
    citiesList: cities,
    averagePrice: avgPrice,
    propertyTypes: {
      privateRoom: db.properties.filter(p => p.type === 'Private Room').length,
      sharedRoom: db.properties.filter(p => p.type === 'Shared Room').length,
      studio: db.properties.filter(p => p.type === 'Studio').length
    }
  });
});

// Get All Properties
app.get('/api/properties', (req, res) => {
  let properties = [...db.properties];
  
  // Filter by city
  if (req.query.city) {
    properties = properties.filter(
      p => p.location.city.toLowerCase() === req.query.city.toLowerCase()
    );
  }
  
  // Filter by type
  if (req.query.type) {
    properties = properties.filter(
      p => p.type.toLowerCase() === req.query.type.toLowerCase()
    );
  }
  
  // Filter by price
  if (req.query.minPrice) {
    properties = properties.filter(p => p.price >= parseInt(req.query.minPrice));
  }
  if (req.query.maxPrice) {
    properties = properties.filter(p => p.price <= parseInt(req.query.maxPrice));
  }
  
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedProperties = properties.slice(startIndex, endIndex);
  
  res.json({
    total: properties.length,
    page,
    limit,
    properties: paginatedProperties
  });
});

// Get Single Property
app.get('/api/properties/:id', (req, res) => {
  const property = db.properties.find(p => p.id === req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(property);
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (db.users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = {
      id: `user_${Date.now()}`,
      email,
      password: hashedPassword,
      name,
      role: role || 'student',
      createdAt: new Date().toISOString()
    };
    
    db.users.push(user);
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
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
    
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    
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
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create Booking
app.post('/api/bookings', authenticateToken, (req, res) => {
  const { propertyId, checkIn, checkOut } = req.body;
  
  const property = db.properties.find(p => p.id === propertyId);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  
  const booking = {
    id: `booking_${Date.now()}`,
    propertyId,
    userId: req.user.id,
    checkIn,
    checkOut,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  db.bookings.push(booking);
  res.status(201).json({ message: 'Booking created', booking });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 RoomEase API running on port ${PORT}`);
  console.log(`📊 Properties loaded: ${db.properties.length}`);
});
```

---

## 📁 FILE 2: package.json

Create a file named `package.json`:

```json
{
  "name": "roomease-backend",
  "version": "1.0.0",
  "description": "RoomEase API Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "engines": {
    "node": "18.x"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.0.3"
  }
}
```

---

## 📁 FILE 3: Procfile

Create a file named `Procfile` (no extension):

```
web: node server.js
```

---

## 📁 FILE 4: .gitignore

Create a file named `.gitignore`:

```
node_modules/
npm-debug.log*
.env
.env.local
.DS_Store
*.log
```

---

## 📁 FILE 5: roomease_listings.json

**IMPORTANT:** This file is too large to paste here (141 KB).

**Option 1: Download from previous outputs**
- Look for the file in `/mnt/user-data/outputs/data-collection/roomease_listings.json`

**Option 2: Create a minimal version for testing**
Create a file named `roomease_listings.json` with this sample data:

```json
[
  {
    "id": "prop_001",
    "title": "Modern Private Room Near UNSW",
    "description": "Comfortable private room in Kensington, perfect for students.",
    "type": "Private Room",
    "price": 280,
    "location": {
      "address": "123 Anzac Parade",
      "suburb": "Kensington",
      "city": "Sydney",
      "state": "NSW",
      "postcode": "2033",
      "country": "Australia"
    },
    "nearestUniversity": {
      "name": "UNSW Sydney",
      "distance": "800m"
    },
    "features": {
      "bedrooms": 1,
      "bathrooms": 1,
      "furnished": true,
      "wifi": true,
      "parking": true,
      "petsAllowed": false
    },
    "amenities": ["WiFi", "Air Conditioning", "Washing Machine", "Kitchen Access"],
    "images": ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"],
    "availableFrom": "2025-02-01",
    "verified": true,
    "rating": 4.8,
    "reviewsCount": 24
  }
]
```

**For production:** You'll need the full 100-property dataset. I can help you retrieve it separately.

---

## 🚀 DEPLOYMENT COMMANDS

Once you have all files in the `roomease-backend` folder:

### Step 1: Install Heroku CLI

**macOS:**
```bash
brew tap heroku/brew && brew install heroku
```

**Windows:**
Download from: https://devcenter.heroku.com/articles/heroku-cli

**Linux:**
```bash
curl https://cli-assets.heroku.com/install.sh | sh
```

### Step 2: Deploy to Heroku

```bash
# Navigate to your folder
cd roomease-backend

# Login to Heroku
heroku login

# Create app
heroku create roomease-api

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set FRONTEND_URL=https://roomease-au.netlify.app
heroku config:set JWT_SECRET=$(openssl rand -hex 32)

# Initialize git
git init
git add .
git commit -m "Initial deployment"

# Add Heroku remote (if not added automatically)
heroku git:remote -a roomease-api

# Deploy
git push heroku main

# Open your API
heroku open
```

### Step 3: Test Your API

```bash
# Test health endpoint
curl https://roomease-api.herokuapp.com/health

# Test properties
curl https://roomease-api.herokuapp.com/api/properties

# Test stats
curl https://roomease-api.herokuapp.com/api/stats
```

---

## ✅ SUCCESS CHECKLIST

After deployment, verify:

- [ ] `/health` returns `{"status": "ok"}`
- [ ] `/api/properties` returns array of properties
- [ ] `/api/stats` returns statistics
- [ ] No errors in logs: `heroku logs --tail`
- [ ] CORS allows your frontend URL

---

## 🔗 CONNECT FRONTEND

Update your frontend files (`login.html`, `search.html`):

```javascript
// Change this line:
const API_URL = 'http://localhost:3000';

// To this:
const API_URL = 'https://roomease-api.herokuapp.com';
```

Then redeploy your frontend to Netlify.

---

## 🆘 TROUBLESHOOTING

### Issue: "Application error"
```bash
heroku logs --tail
heroku restart
```

### Issue: CORS errors
```bash
heroku config:set FRONTEND_URL=https://your-exact-url.netlify.app
heroku restart
```

### Issue: Properties not loading
- Check if `roomease_listings.json` is in the folder
- Verify JSON is valid
- Check logs: `heroku logs --tail`

---

## 📊 YOUR DEPLOYMENT INFO

Fill this in:

**Heroku App Name:** _______________________
**API URL:** https://_______________________.herokuapp.com
**Deployment Date:** _______________________

---

## 🎉 YOU'RE DONE!

Your backend API is now live and ready to serve your frontend!

**Next Steps:**
1. Update frontend API URL
2. Redeploy frontend
3. Test the full application
4. Launch to users!

**Questions?** Check Heroku docs: https://devcenter.heroku.com/
