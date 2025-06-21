import { config } from 'dotenv';
config();
import WebSocket from 'ws';
import { screenStocks } from './helpers/screen-stocks';
import { generateSignal } from './helpers/generate-signal';
import { simulateTrade } from './helpers/trade';
import { Trade, Portfolio } from './types';

let startingValue = 10000;
let totalCash = startingValue;
let totalPortfolioValue = startingValue;

const ALPACA_WS_URL = 'wss://stream.data.alpaca.markets/v2/iex';
const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;

const calculateDailyReturn = (initialValue: number, finalValue: number): number =>
  ((finalValue - initialValue) / initialValue) * 100;

async function runSimulation() {
  const selectedStocks = await screenStocks();
  console.log('Selected stocks:', selectedStocks);

  const portfolios: { [symbol: string]: Portfolio } = {};

  selectedStocks.forEach(symbol => {
    portfolios[symbol] = {
      shares: 0,
      symbol,
      value: 0,
      avgEntryPrice: 0,
    };
  });

  // Trading parameters
  const shortSMAPeriod = 5; // 5-minute SMA
  const longSMAPeriod = 20; // 20-minute SMA
  const stopLossPct = 0.005; // 0.5%
  const takeProfitPct = 0.02; // 2%

  // Track prices and portfolio values
  const priceHistories: { [symbol: string]: number[] } = {};
  const lastPriceTime: { [symbol: string]: number } = {};
  selectedStocks.forEach(symbol => {
    priceHistories[symbol] = [];
    lastPriceTime[symbol] = Date.now(); // Initialize to current time
  });

  const dailyValues: number[] = [totalPortfolioValue];
  let trades: Trade[] = [];

  // Periodic summary (every 10 minutes)
  // let lastSummaryTime = Date.now();
  // const summaryInterval = 10 * 60 * 1000; // 10 minutes in ms
  // setInterval(() => {
  //   if (dailyValues.length > 0) {
  //     const now = new Date().toISOString();
  //     console.log(`[Summary] Time: ${now}, Total Cash: $${totalCash.toFixed(2)}, Total Portfolio Value: $${totalPortfolioValue.toFixed(2)}, Daily Return: ${calculateDailyReturn(dailyValues[0], totalPortfolioValue).toFixed(2)}%`);
  //   }
  //   lastSummaryTime = Date.now();
  // }, summaryInterval);

  const ws = new WebSocket(ALPACA_WS_URL);

  ws.on('open', () => {
    console.log('Connected to Alpaca WebSocket');
    ws.send(JSON.stringify({
      action: 'auth',
      key: ALPACA_API_KEY,
      secret: ALPACA_API_SECRET,
    }));
    ws.send(JSON.stringify({
      action: 'subscribe',
      trades: selectedStocks,
    }));
  });

  ws.on('message', (data: string) => {
    const message = JSON.parse(data);

    if (message[0]?.T === 't') {
      const symbol = message[0].S; // Correct: uppercase 'S'
      const price = message[0].p;
      const timestamp = message[0].t;
      const currentTime = new Date(timestamp).getTime();

      // Skip if symbol not in priceHistories
      if (!priceHistories[symbol]) {
        console.warn(`Unknown symbol: ${symbol}. Expected: ${selectedStocks.join(', ')}`);
        return;
      }

      // Throttle to one price per minute
      if (currentTime - lastPriceTime[symbol] >= 60 * 1000) {
        priceHistories[symbol].push(price);
        lastPriceTime[symbol] = currentTime;
        // console.debug(`Added price for ${symbol}: $${price.toFixed(2)}, History length: ${priceHistories[symbol].length}`); // Debug log

        if (priceHistories[symbol].length >= longSMAPeriod) {
          const signal = generateSignal(priceHistories[symbol].slice(-longSMAPeriod), shortSMAPeriod, longSMAPeriod, symbol);
          const previousShares = portfolios[symbol].shares;
          portfolios[symbol] = simulateTrade(
            portfolios[symbol],
            signal,
            totalCash,
            (cash: number) => { totalCash = cash; },
            stopLossPct,
            takeProfitPct
          );

          if (signal.action !== 'hold') {
            const quantity = signal.action === 'buy' ? portfolios[symbol].shares - previousShares : previousShares;
            if (quantity !== 0) {
              trades.push({ ...signal, quantity });
              totalPortfolioValue = totalCash + selectedStocks.reduce((sum, s) => sum + portfolios[s].value, 0);
              dailyValues.push(totalPortfolioValue);
              console.log(`Trade: ${signal.action.toUpperCase()} ${quantity} shares of ${symbol} at $${price.toFixed(2)}, Time: ${timestamp}`);
              console.log(`[Summary] Time: ${timestamp}, Total Cash: $${totalCash.toFixed(2)}, Total Portfolio Value: $${totalPortfolioValue.toFixed(2)}, Daily Return: ${calculateDailyReturn(dailyValues[0], totalPortfolioValue).toFixed(2)}%`);
            }
          }
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    ws.close();
  });

  // Run until market close (4:00 PM EDT)
  const marketClose = new Date();
  marketClose.setHours(16, 0, 0, 0);
  const timeToClose = marketClose.getTime() - Date.now();
  await new Promise(resolve => setTimeout(resolve, timeToClose));
  ws.close();

  const totalReturn = calculateDailyReturn(startingValue, totalPortfolioValue);
  console.log(`\nSimulation Summary:`);
  console.log(`Final Total Cash: $${totalCash.toFixed(2)}`);
  console.log(`Total Return: ${totalReturn.toFixed(2)}% over trading day`);
  console.log(`Trades Executed:`, trades);
}

runSimulation();
