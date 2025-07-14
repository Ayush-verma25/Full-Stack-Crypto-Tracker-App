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

// Fetch data from CoinGecko
async function fetchCoinGeckoData() {
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false'
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching from CoinGecko:', error.message);
    throw error;
  }
}

// Update current data
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
    throw error;
  }
}

// Store history data
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
  }
}

// API Routes

// GET /api/coins - Fetch current cryptocurrency data
app.get('/api/coins', async (req, res) => {
  try {
    let currentData = await CurrentData.find().sort({ rank: 1 });
    
    // If no data exists, fetch from CoinGecko
    if (currentData.length === 0) {
      currentData = await updateCurrentData();
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

// Cron Jobs
// Update current data every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('Running scheduled update of current data...');
  await updateCurrentData();
});

// Store history data every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled storage of history data...');
  await storeHistoryData();
});

// Initialize data on startup
async function initializeData() {
  try {
    console.log('Initializing data...');
    await updateCurrentData();
    await storeHistoryData();
    console.log('Data initialization complete');
  } catch (error) {
    console.error('Error initializing data:', error.message);
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