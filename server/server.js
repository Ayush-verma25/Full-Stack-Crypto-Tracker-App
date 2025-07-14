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

const CurrentData = mongoose.model('CurrentData', CurrentDataSchema);
const HistoryData = mongoose.model('HistoryData', HistoryDataSchema);

// Rate limiting variables
let lastFetchTime = 0;
const RATE_LIMIT_DELAY = 60000; // 1 minute between requests
let fetchRetryCount = 0;
const MAX_RETRIES = 3;

// Fetch data from CoinGecko with rate limiting and retry logic
async function fetchCoinGeckoData() {
  try {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    
    // Ensure we don't exceed rate limits
    if (timeSinceLastFetch < RATE_LIMIT_DELAY) {
      const waitTime = RATE_LIMIT_DELAY - timeSinceLastFetch;
      console.log(`Rate limit protection: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false',
      {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'CryptoTracker/1.0'
        }
      }
    );
    
    lastFetchTime = Date.now();
    fetchRetryCount = 0; // Reset retry count on success
    return response.data;
  } catch (error) {
    console.error('Error fetching from CoinGecko:', error.message);
    
    if (error.response?.status === 429 && fetchRetryCount < MAX_RETRIES) {
      fetchRetryCount++;
      const backoffTime = Math.min(1000 * Math.pow(2, fetchRetryCount), 60000); // Exponential backoff, max 1 minute
      console.log(`Rate limited. Retrying in ${backoffTime}ms (attempt ${fetchRetryCount}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return fetchCoinGeckoData(); // Retry
    }
    
    throw error;
  }
}

// Update current data with error handling
async function updateCurrentData() {
  try {
    const coinData = await fetchCoinGeckoData();
    
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
    
    // If it's a rate limit error, don't throw - just log and continue
    if (error.response?.status === 429) {
      console.log('Rate limited - will retry on next scheduled update');
      return [];
    }
    
    throw error;
  }
}

// Store history data with error handling
async function storeHistoryData() {
  try {
    const coinData = await fetchCoinGeckoData();
    
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
    
    // If it's a rate limit error, don't throw - just log and continue
    if (error.response?.status === 429) {
      console.log('Rate limited - will retry on next scheduled update');
    }
  }
}

// Root route to fix "Cannot GET /" error
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Crypto Tracker API is running',
    version: '1.0.0',
    endpoints: {
      current: '/api/coins',
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
    uptime: process.uptime()
  });
});

// API Routes

// GET /api/coins - Fetch current cryptocurrency data
app.get('/api/coins', async (req, res) => {
  try {
    let currentData = await CurrentData.find().sort({ rank: 1 });
    
    // If no data exists or data is older than 1 hour, try to fetch new data
    if (currentData.length === 0 || 
        (currentData[0] && Date.now() - currentData[0].timestamp > 3600000)) {
      try {
        const newData = await updateCurrentData();
        if (newData.length > 0) {
          currentData = newData;
        }
      } catch (error) {
        console.log('Failed to fetch new data, using existing data if available');
      }
    }
    
    res.json({
      success: true,
      data: currentData,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
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
    
    // Calculate portfolio metrics
    const totalMarketCap = currentData.reduce((sum, coin) => sum + coin.marketCap, 0);
    const avgChange = currentData.length > 0 ? 
      currentData.reduce((sum, coin) => sum + coin.change24h, 0) / currentData.length : 0;
    
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

// Cron Jobs - Reduced frequency to avoid rate limits
// Update current data every 2 hours instead of 30 minutes
cron.schedule('0 */2 * * *', async () => {
  console.log('Running scheduled update of current data...');
  try {
    await updateCurrentData();
  } catch (error) {
    console.error('Scheduled update failed:', error.message);
  }
});

// Store history data every 4 hours instead of every hour
cron.schedule('0 */4 * * *', async () => {
  console.log('Running scheduled storage of history data...');
  try {
    await storeHistoryData();
  } catch (error) {
    console.error('Scheduled history storage failed:', error.message);
  }
});

// Initialize data on startup with better error handling
async function initializeData() {
  try {
    console.log('Initializing data...');
    
    // Check if we have existing data
    const existingData = await CurrentData.find();
    if (existingData.length > 0) {
      console.log('Found existing data, skipping initial API call');
      return;
    }
    
    // Only fetch if we don't have data
    console.log('No existing data found, fetching initial data...');
    await updateCurrentData();
    
    // Add a delay before storing history to avoid rate limits
    setTimeout(async () => {
      try {
        await storeHistoryData();
        console.log('Data initialization complete');
      } catch (error) {
        console.error('Error storing initial history data:', error.message);
      }
    }, 30000); // 30 second delay
    
  } catch (error) {
    console.error('Error initializing data:', error.message);
    console.log('Server will continue without initial data fetch');
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeData();
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
