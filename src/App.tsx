import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ClipLoader } from 'react-spinners';
import './App.css';

// Define types for Marketstack API response
interface EODDataPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface MarketstackResponse {
    data: EODDataPoint[];
}

function App() {
    const [data, setData] = useState<EODDataPoint[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [symbol, setSymbol] = useState<string>('AAPL');
    const [trend, setTrend] = useState<string>('');
    const [movingAverage, setMovingAverage] = useState<number[]>([]);
    const [volatility, setVolatility] = useState<string>('');

    // Fetch End-of-Day data from Marketstack API
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiKey = import.meta.env.VITE_MARKETSTACK_API_KEY;
            if (!apiKey || apiKey === 'undefined') {
                throw new Error('API key is missing or invalid. Please check your .env file.');
            }
            const response = await fetch(
                `http://api.marketstack.com/v1/eod?access_key=${apiKey}&symbols=${symbol}&limit=100`
            );
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Forbidden: Check if your plan supports this endpoint or if you’ve hit the request limit.');
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please try again later.');
                } else {
                    throw new Error(`API request failed with status ${response.status}`);
                }
            }
            const result: MarketstackResponse = await response.json();
            if (result.data.length === 0) {
                throw new Error(`No data returned for symbol ${symbol}.`);
            }
            setData(result.data);

            // Trend analysis: Percentage change
            if (result.data.length > 1) {
                const latestPrice = result.data[0].close;
                const earliestPrice = result.data[result.data.length - 1].close;
                const percentageChange = ((latestPrice - earliestPrice) / earliestPrice * 100).toFixed(2);
                setTrend(
                    latestPrice > earliestPrice
                        ? `Upward trend: +${percentageChange}%`
                        : `Downward trend: ${percentageChange}%`
                );

                // Calculate 7-day simple moving average
                const windowSize = 7;
                const ma = result.data.map((_, index, arr) => {
                    if (index >= windowSize - 1) {
                        const window = arr.slice(index - windowSize + 1, index + 1);
                        const avg = window.reduce((sum, point) => sum + point.close, 0) / windowSize;
                        return avg;
                    }
                    return null;
                }).filter((val): val is number => val !== null);
                setMovingAverage(ma);

                // Calculate volatility (standard deviation of daily returns)
                const returns = result.data.slice(0, -1).map((point, i) => {
                    const nextPoint = result.data[i + 1];
                    return (point.close - nextPoint.close) / nextPoint.close;
                });
                const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
                const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
                const volatility = Math.sqrt(variance) * 100;
                setVolatility(volatility.toFixed(2));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data on mount and when symbol changes
    useEffect(() => {
        fetchData();
    }, []);

    // Calculate high/low for the report
    const getHighLow = () => {
        if (!data.length) return { high: 0, low: 0 };
        const prices = data.map((point) => point.close);
        return {
            high: Math.max(...prices).toFixed(2),
            low: Math.min(...prices).toFixed(2),
        };
    };

    const { high, low } = getHighLow();

    // Prepare chart data with moving average
    const chartData = data.slice().reverse().map((point, index) => ({
        ...point,
        movingAverage: movingAverage[movingAverage.length - 1 - index] || null,
    }));

    return (
        <div className="app-container">
            <h1>Marketstack End-of-Day Dashboard</h1>

            {/* Symbol Input */}
            <div className="input-container">
                <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="Enter stock symbol (e.g., AAPL)"
                />
                <button onClick={fetchData} disabled={loading}>
                    {loading ? 'Loading...' : 'Fetch Data'}
                </button>
            </div>

            {loading && (
                <div className="loader">
                    <ClipLoader color="#8884d8" size={50} />
                </div>
            )}
            {error && <p className="error">{error}</p>}

            {!loading && !error && data.length > 0 && (
                <>
                    {/* Chart Section */}
                    <div className="chart-container">
                        <h2>End-of-Day Price for {symbol} (Last 100 Days)</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                                <YAxis domain={['auto', 'auto']} />
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                                <Legend />
                                <Line type="monotone" dataKey="close" stroke="#8884d8" name="Close Price" />
                                <Line type="monotone" dataKey="movingAverage" stroke="#82ca9d" name="7-Day Moving Average" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Trends Analysis Section */}
                    <div className="report-container">
                        <h2>Trends Analysis for {symbol}</h2>
                        <p><strong>Price Trend:</strong> {trend}</p>
                        <p><strong>Highest Price:</strong> ${high}</p>
                        <p><strong>Lowest Price:</strong> ${low}</p>
                        <p><strong>7-Day Moving Average (Latest):</strong> ${movingAverage[0]?.toFixed(2) || 'N/A'}</p>
                        <p><strong>Volatility (Daily Returns):</strong> {volatility}%</p>
                    </div>
                </>
            )}
        </div>
    );
}

export default App;