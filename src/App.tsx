import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ClipLoader } from 'react-spinners';
import { motion } from 'framer-motion';
import {
    AppBar,
    Toolbar,
    Typography,
    Autocomplete,
    TextField,
    Button,
    Container,
    Paper,
    Card,
    CardContent,
    Grid,
    Box,
    Switch,
    useTheme,
    useMediaQuery,
    CssBaseline,
    Link,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import './App.css';
import staticTickers from '../data/tickers.json';

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

interface Ticker {
    symbol: string;
    name: string;
    exchange: string;
}

interface TickersResponse {
    data: Ticker[];
}

function App() {
    const [data, setData] = useState<EODDataPoint[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [symbol, setSymbol] = useState<string>('AAPL');
    const [trend, setTrend] = useState<string>('');
    const [movingAverage, setMovingAverage] = useState<number[]>([]);
    const [volatility, setVolatility] = useState<string>('');
    const [darkMode, setDarkMode] = useState<boolean>(true);
    const [tickers, setTickers] = useState<Ticker[]>(staticTickers.data);

    // Create MUI theme
    const theme = createTheme({
        palette: {
            mode: darkMode ? 'dark' : 'light',
            primary: { main: '#00f6ff' },
            secondary: { main: '#82ff94' },
            error: { main: '#ff4d4d' },
            background: {
                default: darkMode ? '#1a1a2e' : '#f5f5f5',
                paper: darkMode ? '#222235' : '#ffffff',
            },
        },
        typography: {
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            h1: { fontSize: '2.2rem', fontWeight: 600 },
            h2: { fontSize: '1.5rem', fontWeight: 500 },
            body1: { fontSize: '1rem' },
        },
        components: {
            MuiCard: {
                styleOverrides: {
                    root: {
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: darkMode
                                ? '0 6px 20px rgba(0, 246, 255, 0.3)'
                                : '0 6px 20px rgba(0, 0, 0, 0.2)',
                        },
                    },
                },
            },
        },
    });

    // Fetch tickers from Marketstack API or use static data
    useEffect(() => {
        const fetchTickers = async () => {
            try {
                const apiKey = import.meta.env.VITE_MARKETSTACK_API_KEY;
                if (!apiKey || apiKey === 'undefined') {
                    console.warn('API key missing, using static tickers.');
                    return;
                }
                const response = await fetch(
                    `http://api.marketstack.com/v1/tickers?access_key=${apiKey}&limit=1000`
                );
                if (!response.ok) {
                    throw new Error(`Failed to fetch tickers: ${response.status}`);
                }
                const result: TickersResponse = await response.json();
                setTickers(result.data);
                // Optionally save to localStorage to cache
                localStorage.setItem('tickers', JSON.stringify(result.data));
            } catch (err) {
                console.error('Error fetching tickers:', err);
                // Fallback to static data or cached data
                const cachedTickers = localStorage.getItem('tickers');
                if (cachedTickers) {
                    setTickers(JSON.parse(cachedTickers));
                }
            }
        };

        // Check if cached data exists
        const cachedTickers = localStorage.getItem('tickers');
        if (cachedTickers) {
            setTickers(JSON.parse(cachedTickers));
        } else {
            fetchTickers();
        }
    }, []);

    // Fetch End-of-Day data from Marketstack API
    const fetchData = async () => {
        if (!symbol.trim()) {
            setError('Please enter or select a valid stock symbol.');
            setLoading(false);
            return;
        }
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

    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, []);

    // Handle Enter key press or selection
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            fetchData();
        }
    };

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

    // Theme toggle
    const handleThemeToggle = () => {
        setDarkMode(!darkMode);
    };

    // Responsive check
    const themeObj = useTheme();
    const isMobile = useMediaQuery(themeObj.breakpoints.down('sm'));

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Toolbar>
                        <Typography variant="h5" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
              <span style={{ position: 'relative', bottom: '-3px' }}>
                <img
                    src="/favicon.png"
                    alt="MarketView Logo"
                    style={{ width: 32, height: 32, marginRight: 8 }}
                    data-testid="favicon-logo"
                />
              </span>
                            <span>MarketView</span>
                        </Typography>
                        <Switch
                            checked={darkMode}
                            onChange={handleThemeToggle}
                            icon={<Brightness7Icon />}
                            checkedIcon={<Brightness4Icon />}
                            aria-label="Toggle dark mode"
                        />
                    </Toolbar>
                </AppBar>

                {/* Main Content */}
                <Container maxWidth="lg" sx={{ flexGrow: 1, py: 4 }}>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                        {/* Symbol Input */}
                        <Box sx={{ display: 'flex', gap: 2, mb: 4, justifyContent: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                            <Autocomplete
                                id="stock-search"
                                options={tickers}
                                getOptionLabel={(option) => `${option.symbol} - ${option.name}`}
                                filterOptions={(options, { inputValue }) =>
                                    options.filter(
                                        (option) =>
                                            option.symbol.toLowerCase().includes(inputValue.toLowerCase()) ||
                                            option.name.toLowerCase().includes(inputValue.toLowerCase())
                                    )
                                }
                                onChange={(event, value) => setSymbol(value ? value.symbol : '')}
                                onKeyDown={handleKeyDown}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Search Stock or Company"
                                        placeholder="e.g., AAPL or Apple"
                                        variant="outlined"
                                        size="small"
                                        sx={{ width: isMobile ? '100%' : 300 }}
                                        inputProps={{
                                            ...params.inputProps,
                                            'aria-label': 'Search stock or company',
                                            'data-testid': 'symbol-input',
                                        }}
                                    />
                                )}
                                sx={{ width: isMobile ? '100%' : 300 }}
                            />
                            <Button
                                variant="contained"
                                onClick={fetchData}
                                disabled={loading}
                                sx={{ px: 3 }}
                                aria-label="Fetch stock data"
                                data-testid="fetch-button"
                            >
                                {loading ? 'Loading...' : 'Fetch Data'}
                            </Button>
                        </Box>

                        {loading && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }} data-testid="loader">
                                <ClipLoader color={theme.palette.primary.main} size={50} />
                            </Box>
                        )}
                        {error && (
                            <Typography color="error" align="center" sx={{ my: 2 }} data-testid="error-message">
                                {error}
                            </Typography>
                        )}

                        {!loading && !error && data.length > 0 && (
                            <>
                                {/* Chart Section */}
                                <Paper elevation={3} sx={{ p: 3, mb: 4, background: theme.palette.background.paper }} data-testid="chart-container">
                                    <Typography variant="h2" gutterBottom data-testid="chart-title">
                                        End-of-Day Price for {symbol} (Last 100 Days)
                                    </Typography>
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                                        <ResponsiveContainer width="100%" height={400}>
                                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                                                    tickFormatter={(date) => new Date(date).toLocaleDateString()}
                                                />
                                                <YAxis
                                                    domain={['auto', 'auto']}
                                                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                                                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: theme.palette.background.paper,
                                                        border: `1px solid ${theme.palette.divider}`,
                                                        color: theme.palette.text.primary,
                                                    }}
                                                    formatter={(value: number) => `$${value.toFixed(2)}`}
                                                />
                                                <Legend wrapperStyle={{ color: theme.palette.text.secondary }} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="close"
                                                    stroke={theme.palette.primary.main}
                                                    name="Close Price"
                                                    strokeWidth={2}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="movingAverage"
                                                    stroke={theme.palette.secondary.main}
                                                    name="7-Day Moving Average"
                                                    strokeWidth={2}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </motion.div>
                                </Paper>

                                {/* Trends Analysis Section */}
                                <Box sx={{ mb: 4 }} data-testid="report-container">
                                    <Typography variant="h2" gutterBottom data-testid="report-title">
                                        Trends Analysis for {symbol}
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {[
                                            { label: 'Price Trend', value: trend, className: trend.includes('Upward') ? 'trend-up' : 'trend-down' },
                                            { label: 'Highest Price', value: `$${high}` },
                                            { label: 'Lowest Price', value: `$${low}` },
                                            { label: '7-Day Moving Average (Latest)', value: `$${movingAverage[0]?.toFixed(2) || 'N/A'}` },
                                            { label: 'Volatility (Daily Returns)', value: `${volatility}%` },
                                        ].map((item, index) => (
                                            <Grid item xs={12} sm={6} md={4} key={index}>
                                                <Card data-testid={`trend-card-${index}`}>
                                                    <CardContent sx={{ textAlign: 'center' }}>
                                                        <Typography variant="body1" component="div" sx={{ fontWeight: 600, mb: 1 }}>
                                                            {item.label}
                                                        </Typography>
                                                        <Typography
                                                            variant="body1"
                                                            className={item.className}
                                                            data-testid={`trend-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                                                        >
                                                            {item.value}
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                            </>
                        )}
                    </motion.div>
                </Container>

                {/* Footer */}
                <Box component="footer" sx={{ py: 3, mt: 'auto', borderTop: '1px solid', borderColor: 'divider', background: theme.palette.background.paper }}>
                    <Container maxWidth="lg">
                        <Typography variant="body2" color="text.secondary" align="center">
                            © {new Date().getFullYear()} MarketView Dashboard. Powered by{' '}
                            <Link href="https://marketstack.com" target="_blank" color="primary">
                                Marketstack
                            </Link>
                            .{' '}
                            <Link href="https://github.com" target="_blank" color="primary">
                                View Source
                            </Link>
                        </Typography>
                    </Container>
                </Box>
            </Box>
        </ThemeProvider>
    );
}

export default App;