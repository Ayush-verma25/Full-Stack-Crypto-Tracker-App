// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Current Data Schema
const CurrentDataSchema = new mongoose.Schema({
  coinId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  price: { type: Number, required: true },
  marketCap: { type: Number, required: true },
  change24h: { type: Number, required: true },
  image: { type: String },
  rank: { type: Number },
  timestamp: { type: Date, default: Date.now }
});

// History Data Schema
const HistoryDataSchema = new mongoose.Schema({
  coinId: { type: String, required: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  price: { type: Number, required: true },
  marketCap: { type: Number, required: true },
  change24h: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const CurrentData = mongoose.model('CurrentData', CurrentData);
const HistoryData = mongoose.model('HistoryData', HistoryDataSchema);

// Rate limiting variables
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 120000; // 2 minutes minimum between API calls
let fetchInProgress = false;

// Exponential backoff for retries
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch data from CoinGecko with rate limiting and retry logic
async function fetchCoinGeckoData() {
  // Check if we should skip this call due to rate limiting
  const now = Date.now();
  if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
    console.log('Skipping API call due to rate limiting');
    return null;
  }

  // Prevent concurrent API calls
  if (fetchInProgress) {
    console.log('API call already in progress, skipping');
    return null;
  }

  fetchInProgress = true;
  let retryCount = 0;
  const maxRetries = 3;
  
  try {
    while (retryCount < maxRetries) {
      try {
        console.log(`Fetching data from CoinGecko (attempt ${retryCount + 1})`);
        
        const response = await axios.get(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false',
          {
            timeout: 10000, // 10 second timeout
            headers: {
              'User-Agent': 'CryptoTracker/1.0'
            }
          }
        );
        
        lastFetchTime = now;
        console.log('Successfully fetched data from CoinGecko');
        return response.data;
        
      } catch (error) {
        retryCount++;
        
        if (error.response?.status === 429) {
          console.log(`Rate limited (429), waiting before retry ${retryCount}/${maxRetries}`);
          // Exponential backoff: 30s, 60s, 120s
          await delay(30000 * Math.pow(2, retryCount - 1));
        } else if (retryCount < maxRetries) {
          console.log(`API error (${error.response?.status}), retrying in 10s...`);
          await delay(10000);
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Max retries exceeded');
    
  } finally {
    fetchInProgress = false;
  }
}

// Update current data with improved error handling
async function updateCurrentData() {
  try {
    const coinData = await fetchCoinGeckoData();
    
    // If we couldn't fetch new data due to rate limiting, return existing data
    if (!coinData) {
      console.log('Using existing data due to rate limiting');
      return await CurrentData.find().sort({ rank: 1 });
    }
    
    // Clear existing current data
    await CurrentData.deleteMany({});
    
    // Insert new data
    const formattedData = coinData.map(coin => ({
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      marketCap: coin.market_cap,
      change24h: coin.price_change_percentage_24h,
      image: coin.image,
      rank: coin.market_cap_rank,
      timestamp: new Date()
    }));

    await CurrentData.insertMany(formattedData);
    console.log('Current data updated successfully');
    
    return formattedData;
  } catch (error) {
    console.error('Error updating current data:', error.message);
    
    // Return existing data if update fails
    try {
      const existingData = await CurrentData.find().sort({ rank: 1 });
      if (existingData.length > 0) {
        console.log('Returning existing data after update failure');
        return existingData;
      }
    } catch (dbError) {
      console.error('Error fetching existing data:', dbError.message);
    }
    
    throw error;
  }
}

// Store history data with improved error handling
async function storeHistoryData() {
  try {
    const coinData = await fetchCoinGeckoData();
    
    // Skip if we couldn't fetch new data
    if (!coinData) {
      console.log('Skipping history storage due to rate limiting');
      return;
    }
    
    const historyData = coinData.map(coin => ({
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      marketCap: coin.market_cap,
      change24h: coin.price_change_percentage_24h,
      timestamp: new Date()
    }));

    await HistoryData.insertMany(historyData);
    console.log('History data stored successfully');
  } catch (error) {
    console.error('Error storing history data:', error.message);
    // Don't throw error for history storage failures
  }
}

// API Routes

// Root route for health checks
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Crypto Tracker API is running',
    timestamp: new Date(),
    endpoints: {
      coins: '/api/coins',
      history: '/api/history/:coinId',
      portfolio: '/api/portfolio'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// GET /api/coins - Fetch current cryptocurrency data
app.get('/api/coins', async (req, res) => {
  try {
    let currentData = await CurrentData.find().sort({ rank: 1 });
    
    // If no data exists or data is older than 1 hour, try to fetch new data
    if (currentData.length === 0 || 
        (currentData[0] && Date.now() - currentData[0].timestamp > 3600000)) {
      try {
        currentData = await updateCurrentData();
      } catch (error) {
        console.error('Failed to update data, using existing data:', error.message);
        // If update fails, still return existing data if available
        if (currentData.length === 0) {
          throw error;
        }
      }
    }
    
    res.json({
      success: true,
      data: currentData,
      timestamp: new Date(),
      dataAge: currentData.length > 0 ? Date.now() - currentData[0].timestamp : 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Unable to fetch cryptocurrency data'
    });
  }
});

// POST /api/history - Manually store history snapshot
app.post('/api/history', async (req, res) => {
  try {
    await storeHistoryData();
    res.json({
      success: true,
      message: 'History data stored successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/history/:coinId - Get historical data for a specific coin
app.get('/api/history/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const historyData = await HistoryData.find({
      coinId: coinId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });
    
    res.json({
      success: true,
      data: historyData,
      coinId: coinId,
      days: parseInt(days)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/portfolio - Get portfolio summary
app.get('/api/portfolio', async (req, res) => {
  try {
    const currentData = await CurrentData.find().sort({ rank: 1 });
    
    if (currentData.length === 0) {
      return res.json({
        success: true,
        data: {
          totalValue: 0,
          avgChange: 0,
          coins: []
        },
        message: 'No data available'
      });
    }
    
    // Calculate portfolio metrics
    const totalMarketCap = currentData.reduce((sum, coin) => sum + coin.marketCap, 0);
    const avgChange = currentData.reduce((sum, coin) => sum + coin.change24h, 0) / currentData.length;
    
    const portfolioData = currentData.slice(0, 6).map(coin => ({
      name: coin.name,
      symbol: coin.symbol,
      price: coin.price,
      change24h: coin.change24h,
      image: coin.image
    }));
    
    res.json({
      success: true,
      data: {
        totalValue: totalMarketCap,
        avgChange: avgChange,
        coins: portfolioData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cron Jobs with reduced frequency
// Update current data every 2 hours (was 30 minutes)
cron.schedule('0 */2 * * *', async () => {
  console.log('Running scheduled update of current data...');
  try {
    await updateCurrentData();
  } catch (error) {
    console.error('Scheduled update failed:', error.message);
  }
});

// Store history data every 4 hours (was 1 hour)
cron.schedule('0 */4 * * *', async () => {
  console.log('Running scheduled storage of history data...');
  try {
    await storeHistoryData();
  } catch (error) {
    console.error('Scheduled history storage failed:', error.message);
  }
});

// Initialize data on startup with delay
async function initializeData() {
  try {
    console.log('Initializing data...');
    
    // Wait a bit before making the first API call
    await delay(5000);
    
    // Try to update current data
    try {
      await updateCurrentData();
    } catch (error) {
      console.error('Failed to initialize current data:', error.message);
    }
    
    // Wait before storing history
    await delay(10000);
    
    // Try to store history data
    try {
      await storeHistoryData();
    } catch (error) {
      console.error('Failed to initialize history data:', error.message);
    }
    
    console.log('Data initialization complete');
  } catch (error) {
    console.error('Error initializing data:', error.message);
    // Don't crash the server if initialization fails
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize data with error handling
  setTimeout(async () => {
    await initializeData();
  }, 2000); // Wait 2 seconds before initialization
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
