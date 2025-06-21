require('dotenv').config();
import axios from 'axios';
import { screenStocks } from './helpers/screen-stocks';
import { generateSignal3 } from './helpers/generate-signal';
import { simulateTrade } from './helpers/trade';
import { Trade, Portfolio } from './types';
import { SMA, RSI } from 'technicalindicators';

const ALPACA_API_KEY = process.env.ALPACA_API_KEY!;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET!;
const ALPACA_REST_URL = 'https://data.alpaca.markets/v2';

interface AlpacaBar {
  t: string;
  c: number;
}

function calculateSMA(prices: number[], period: number): number[] {
  return SMA.calculate({ period, values: prices });
}

async function backtestStrategy(start: string, end: string) {
  let startingValue = 10000;
  let totalCash = startingValue;
  let totalPortfolioValue = startingValue;

  const selectedStocks = await screenStocks();
  console.log('Backtest stocks:', selectedStocks);

  const portfolios: { [symbol: string]: Portfolio } = {};
  selectedStocks.forEach(symbol => {
    portfolios[symbol] = {
      shares: 0,
      symbol,
      value: 0,
      avgEntryPrice: 0,
      totalLoss: 0,
    };
  });

  const shortSMAPeriod = 5;
  const longSMAPeriod = 10;
  const stopLossPct = 0.0075;
  const takeProfitPct = 0.02;
  const maxPositionPct = 0.3;

  const priceHistories: { [symbol: string]: number[] } = {};
  const timestamps: { [symbol: string]: string[] } = {};
  selectedStocks.forEach(symbol => {
    priceHistories[symbol] = [];
    timestamps[symbol] = [];
  });
  const dailyValues: number[] = [totalPortfolioValue];
  let trades: Trade[] = [];

  // Fetch bars for all stocks in one call
  let nextPageToken: string | null = null;
  let iteration = 0;
  const maxIterations = 100;
  try {
    do {
      console.debug(`Fetching bars for all stocks, iteration ${iteration + 1}, next_page_token: ${nextPageToken || 'none'}`);
      const response = await axios.get(`${ALPACA_REST_URL}/stocks/bars`, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        },
        params: {
          symbols: selectedStocks.join(','),
          timeframe: '1Min',
          start,
          end,
          page_token: nextPageToken,
          feed: 'iex',
        },
      });
      const barsBySymbol: { [symbol: string]: AlpacaBar[] } = response.data.bars || {};
      let totalBarsFetched = 0;
      for (const symbol of selectedStocks) {
        const bars = barsBySymbol[symbol] || [];
        totalBarsFetched += bars.length;
        priceHistories[symbol] = priceHistories[symbol].concat(bars.map(bar => bar.c));
        timestamps[symbol] = timestamps[symbol].concat(bars.map(bar => bar.t));
      }
      console.debug(`Fetched ${totalBarsFetched} total bars across ${selectedStocks.length} stocks`);
      if (totalBarsFetched === 0) {
        console.debug(`Empty bars for all stocks, stopping pagination`);
        break;
      }
      const prevToken = nextPageToken;
      nextPageToken = response.data.next_page_token || null;
      if (nextPageToken === prevToken && totalBarsFetched > 0) {
        // console.warn(`Same next_page_token (${nextPageToken}) returned for ${symbol}, stopping to avoid infinite loop`);
        break;
      }
      iteration++;
      if (iteration >= maxIterations) {
        console.warn(`Max iterations (${maxIterations}) reached for all stocks, stopping pagination`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (nextPageToken);

    // Validate fetched data
    for (const symbol of selectedStocks) {
      if (priceHistories[symbol].length === 0) {
        console.warn(`No historical data for ${symbol}`);
      } else {
        // console.log(`Fetched ${priceHistories[symbol].length} bars for ${symbol}`);
      }
    }
  } catch (error) {
    console.error(`Error fetching bars for all stocks:`, error);
    return;
  }

  // Process bars for each stock
  for (const symbol of selectedStocks) {
    if (priceHistories[symbol].length === 0) continue;
    let currentDay = '';
    let signalCount = 0;
    for (let i = 0; i < priceHistories[symbol].length; i++) {
      const price = priceHistories[symbol][i];
      const timestamp = timestamps[symbol][i];
      let date: Date;
      try {
        date = new Date(timestamp);
        if (isNaN(date.getTime())) throw new Error('Invalid timestamp');
      } catch (error) {
        console.warn(`Invalid timestamp for ${symbol} at index ${i}: ${timestamp}`);
        continue;
      }
      const day = date.toISOString().split('T')[0];
      const hours = date.getHours();
      const minutes = date.getMinutes();

      // Sell-off at 3:55 PM EDT or day change
      if (currentDay !== '' && (day !== currentDay || (hours === 15 && minutes >= 55) || hours > 15)) {
        if (portfolios[symbol].shares > 0) {
          const latestPrice = i > 0 ? priceHistories[symbol][i - 1] : price;
          if (latestPrice <= 0) {
            // console.warn(`Invalid price for sell-off of ${symbol} at ${timestamp}`);
            continue;
          }
          const signal: Trade = {
            action: 'sell',
            price: latestPrice,
            quantity: portfolios[symbol].shares,
            timestamp: date.toISOString(),
            symbol,
          };
          portfolios[symbol] = simulateTrade(
            portfolios[symbol],
            signal,
            totalCash,
            (cash: number) => { totalCash = cash; },
            stopLossPct,
            takeProfitPct
          );
          trades.push(signal);
          // console.log(`Backtest End-of-day sell: SOLD ${signal.quantity} shares of ${symbol} at $${signal.price.toFixed(2)}, Time: ${signal.timestamp}, Total Cash: $${totalCash.toFixed(2)}`);
          totalPortfolioValue = totalCash;
          dailyValues.push(totalPortfolioValue);
          // console.log(`Backtest Daily Sell-off for ${currentDay}: Total Portfolio Value: $${totalPortfolioValue.toFixed(2)}, Daily Return: ${dailyValues.length > 1 ? calculateDailyReturn(dailyValues[dailyValues.length - 2], totalPortfolioValue).toFixed(2) : '0.00'}%`);
        }
        portfolios[symbol].totalLoss = 0;
      }
      currentDay = day;

      if (i >= longSMAPeriod - 1) {
        const signal = generateSignal3(priceHistories[symbol].slice(0, i + 1), shortSMAPeriod, longSMAPeriod, symbol, price);
        signalCount++;
        // console.debug(`Signal ${signalCount} for ${symbol}: ${signal.action} at $${signal.price.toFixed(2)}, Time: ${signal.timestamp}`);

        if (signal.action === 'buy') {
          const totalPositionValue = selectedStocks.reduce((sum, s) => sum + (portfolios[s]?.value || 0), 0);
          if (totalPositionValue >= startingValue * maxPositionPct) {
            // console.debug(`Skipped buy for ${symbol}: Total position value $${totalPositionValue.toFixed(2)} exceeds ${maxPositionPct * 100}% limit`);
            continue;
          }
        }

        const previousShares = portfolios[symbol].shares;

        const tradeLoss = signal.action === 'sell' && previousShares > 0 ? (previousShares * signal.price - portfolios[symbol].value) : 0;
        portfolios[symbol].totalLoss = (portfolios[symbol].totalLoss || 0) + tradeLoss;
        if (portfolios[symbol].totalLoss > startingValue * 0.01) {
          console.log(`Backtest: Paused trading for ${symbol}: Loss exceeds 1%`);
          continue;
        }

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
            totalPortfolioValue = totalCash + selectedStocks.reduce((sum, s) => sum + (portfolios[s]?.value || 0), 0);
            dailyValues.push(totalPortfolioValue);
            // console.log(`Backtest Trade: ${signal.action.toUpperCase()} ${quantity} shares of ${symbol} at $${signal.price.toFixed(2)}, Time: ${signal.timestamp}, RSI: ${RSI.calculate({ period: 14, values: priceHistories[symbol].slice(0, i + 1) }).slice(-1)[0].toFixed(2)}, 5MA: ${calculateSMA(priceHistories[symbol].slice(0, i + 1), shortSMAPeriod).slice(-1)[0].toFixed(2)}, 10MA: ${calculateSMA(priceHistories[symbol].slice(0, i + 1), longSMAPeriod).slice(-1)[0].toFixed(2)}, Total Cash: $${totalCash.toFixed(2)}`);
          } else {
            // console.debug(`Skipped trade for ${symbol}: Zero quantity, Action: ${signal.action}, Cash: $${totalCash.toFixed(2)}`);
          }
        }
      }
    }
  }

  const totalReturn = ((totalPortfolioValue - startingValue) / startingValue) * 100;
  console.log(`\nBacktest Summary:`);
  console.log(`Final Total Cash: $${totalCash.toFixed(2)}`);
  console.log(`Total Portfolio Value: $${totalPortfolioValue.toFixed(2)}`);
  console.log(`Total Return: ${totalReturn.toFixed(2)}%`);
  console.log(`Trades Executed:`, trades.length);
}

backtestStrategy('2025-01-03T09:30:00-04:00', '2025-01-05T16:00:00-04:00');