import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Wallet,
  Settings,
  RefreshCw,
} from "lucide-react";

const CryptoTracker = () => {
  const [coins, setCoins] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("rank");
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch coins data
  const fetchCoins = async () => {
    try {
      const response = await fetch("https://full-stack-crypto-tracker-app-server.onrender.com/api/coins");
      const data = await response.json();
      if (data.success) {
        setCoins(data.data);
        setLastUpdated(new Date(data.timestamp));
      }
    } catch (error) {
      console.error("Error fetching coins:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch portfolio data
  const fetchPortfolio = async () => {
    try {
      const response = await fetch("https://full-stack-crypto-tracker-app-server.onrender.com/api/portfolio");
      const data = await response.json();
      if (data.success) {
        setPortfolio(data.data);
      }
    } catch (error) {
      console.error("Error fetching portfolio:", error);
    }
  };

  // Fetch chart data for selected coin
  const fetchChartData = async (coinId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/history/${coinId}?days=7`
      );
      const data = await response.json();
      if (data.success) {
        const formattedData = data.data.map((item) => ({
          time: new Date(item.timestamp).toLocaleDateString(),
          price: item.price,
          change: item.change24h,
        }));
        setChartData(formattedData);
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
    }
  };

  useEffect(() => {
    fetchCoins();
    fetchPortfolio();

    // Auto-refresh every 30 minutes
    const interval = setInterval(() => {
      fetchCoins();
      fetchPortfolio();
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCoin) {
      fetchChartData(selectedCoin.coinId);
    }
  }, [selectedCoin]);

  // Filter and sort coins
  const filteredCoins = coins
    .filter(
      (coin) =>
        coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "price":
          return b.price - a.price;
        case "change":
          return b.change24h - a.change24h;
        case "marketCap":
          return b.marketCap - a.marketCap;
        default:
          return a.rank - b.rank;
      }
    });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatLargeNumber = (num) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercentage = (percent) => {
    return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading crypto data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Wallet className="w-8 h-8 text-green-400" />
              <span className="text-xl font-bold">CryptoTracker</span>
            </div>
            <span className="text-sm text-gray-400">Welcome Back, Trader!</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                fetchCoins();
                fetchPortfolio();
              }}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <Settings className="w-6 h-6 text-gray-400 cursor-pointer hover:text-white" />
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800 min-h-screen p-4 border-r border-gray-700">
          <nav className="space-y-2">
            <div className="px-3 py-2 bg-green-600 rounded-lg text-white font-medium">
              Dashboard
            </div>
            <div className="px-3 py-2 text-gray-400 hover:text-white cursor-pointer">
              My Wallet
            </div>
            <div className="px-3 py-2 text-gray-400 hover:text-white cursor-pointer">
              Trade
            </div>
            <div className="px-3 py-2 text-gray-400 hover:text-white cursor-pointer">
              Analytics
            </div>
            <div className="px-3 py-2 text-gray-400 hover:text-white cursor-pointer">
              History
            </div>
            <div className="px-3 py-2 text-gray-400 hover:text-white cursor-pointer">
              Assets
            </div>
          </nav>

          {/* Portfolio Summary */}
          {portfolio && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">My Portfolio</h3>
              <div className="space-y-3">
                {portfolio.coins.map((coin, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <img
                        src={coin.image}
                        alt={coin.name}
                        className="w-6 h-6 rounded-full"
                      />
                      <div>
                        <div className="text-sm font-medium">{coin.symbol}</div>
                        <div className="text-xs text-gray-400">
                          {formatCurrency(coin.price)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-sm ${
                        coin.change24h >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {formatPercentage(coin.change24h)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Balance Card */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {portfolio
                    ? formatLargeNumber(portfolio.totalValue)
                    : "$0.00"}
                </h2>
                <p className="text-green-100 flex items-center">
                  {portfolio && portfolio.avgChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  {portfolio ? formatPercentage(portfolio.avgChange) : "0%"}{" "}
                  This Week
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-green-100">Total Market Cap</div>
                <div className="text-lg font-semibold">
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          {selectedCoin && chartData.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4">
                {selectedCoin.name} ({selectedCoin.symbol}) - 7 Day Chart
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search cryptocurrencies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-green-400"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-green-400"
              >
                <option value="rank">Sort by Rank</option>
                <option value="name">Sort by Name</option>
                <option value="price">Sort by Price</option>
                <option value="change">Sort by Change</option>
                <option value="marketCap">Sort by Market Cap</option>
              </select>
            </div>
            <div className="text-sm text-gray-400">
              Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "N/A"}
            </div>
          </div>

          {/* Crypto Table */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    24h Change
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Market Cap
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {filteredCoins.map((coin) => (
                  <tr
                    key={coin.coinId}
                    className="hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={coin.image}
                          alt={coin.name}
                          className="w-8 h-8 rounded-full mr-3"
                        />
                        <div>
                          <div className="text-sm font-medium text-white">
                            {coin.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {coin.symbol}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatCurrency(coin.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatLargeNumber(coin.marketCap)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div
                        className={`flex items-center ${
                          coin.change24h >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {coin.change24h >= 0 ? (
                          <TrendingUp className="w-4 h-4 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 mr-1" />
                        )}
                        {formatPercentage(coin.change24h)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatLargeNumber(coin.marketCap)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedCoin(coin)}
                        className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Chart</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoTracker;
