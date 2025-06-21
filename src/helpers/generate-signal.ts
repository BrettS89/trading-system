import { SMA, RSI } from 'technicalindicators';
import { Trade } from '../types';

function calculateSMA(prices: number[], period: number): number[] {
  return SMA.calculate({ period, values: prices });
}

// Generate trading signal based on SMA crossover
// export function generateSignal(prices: number[], shortPeriod: number, longPeriod: number, symbol: string): Trade {
//   const shortSMA = calculateSMA(prices, shortPeriod);
//   const longSMA = calculateSMA(prices, longPeriod);
//   const latestPrice = prices[prices.length - 1];

//   if (shortSMA.length === 0 || longSMA.length === 0) {
//     return { action: 'hold', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
//   }

//   const latestShortSMA = shortSMA[shortSMA.length - 1];
//   const latestLongSMA = longSMA[longSMA.length - 1];

//   if (latestShortSMA > latestLongSMA) {
//     return { action: 'buy', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
//   } else if (latestShortSMA < latestLongSMA) {
//     return { action: 'sell', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
//   }
//   return { action: 'hold', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
// }

export function generateSignal(prices: number[], shortPeriod: number, longPeriod: number, symbol: string): Trade {
  const shortSMA = calculateSMA(prices, shortPeriod);
  const longSMA = calculateSMA(prices, longPeriod);
  const rsi = RSI.calculate({ period: 14, values: prices }).slice(-1)[0];
  const latestPrice = prices[prices.length - 1];
  if (shortSMA.length === 0 || longSMA.length === 0) {
    return { action: 'hold', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }
  const latestShortSMA = shortSMA[shortSMA.length - 1];
  const latestLongSMA = longSMA[longSMA.length - 1];
  if (latestShortSMA > latestLongSMA && rsi > 50) { // Buy only if RSI bullish
    return { action: 'buy', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  } else if (latestShortSMA < latestLongSMA && rsi < 50) { // Sell only if RSI bearish
    return { action: 'sell', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }
  return { action: 'hold', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
}

export function generateSignal3(prices: number[], shortPeriod: number, longPeriod: number, symbol: string, currentPrice: number): Trade {
  const shortSMA = calculateSMA(prices, shortPeriod); // 5MA
  const longSMA = calculateSMA(prices, longPeriod); // 10MA
  const rsi = RSI.calculate({ period: 14, values: prices }).slice(-1)[0];
  const latestPrice = currentPrice;

  if (shortSMA.length < 2 || longSMA.length < 2 || isNaN(rsi)) {
    return { action: 'hold', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }

  const latestShortSMA = shortSMA[shortSMA.length - 1];
  const prevShortSMA = shortSMA[shortSMA.length - 2];
  const latestLongSMA = longSMA[longSMA.length - 1];
  const prevLongSMA = longSMA[longSMA.length - 2];

  // Buy: 5MA crosses above 10MA and RSI > 60
  if (prevShortSMA <= prevLongSMA && latestShortSMA > latestLongSMA && rsi > 60) {
    return { action: 'buy', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }

  // Alert: Price crosses under 5MA
  if (prices[prices.length - 2] >= shortSMA[shortSMA.length - 2] && latestPrice < latestShortSMA) {
    // console.log(`Alert: Price crossed under 5MA for ${symbol} at $${latestPrice.toFixed(2)}`);
  }

  // Sell: Price crosses below 10MA and RSI < 40
  if (prices[prices.length - 2] >= longSMA[longSMA.length - 2] && latestPrice < latestLongSMA && rsi < 40) {
    return { action: 'sell', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }

  return { action: 'hold', price: latestPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
}