import { ADX } from 'technicalindicators';
import { EMA, RSI } from 'technicalindicators'; // For EMA calculation

// Define the Trade type (adjust as needed)
interface Trade {
  action: 'buy' | 'sell' | 'hold';
  price: number;
  quantity: number;
  timestamp: string;
  symbol: string;
}

export function generateSignal(
  highPrices: number[],      // Array of high prices
  lowPrices: number[],       // Array of low prices
  closePrices: number[],     // Array of close prices
  shortPeriod: number,       // Short EMA period (e.g., 5)
  longPeriod: number,        // Long EMA period (e.g., 20)
  adxPeriod: number,         // ADX period (e.g., 14)
  adxThreshold: number,      // ADX threshold (e.g., 25)
  symbol: string,            // Trading symbol (e.g., 'AAPL')
  currentPrice: number       // Current price
): Trade {
  // Determine minimum required data length
  const minLength = Math.max(shortPeriod + 1, longPeriod + 1, adxPeriod);
  // Validate input data
  if (
    !highPrices ||
    !lowPrices ||
    !closePrices ||
    highPrices.length < minLength ||
    lowPrices.length < minLength ||
    closePrices.length < minLength ||
    isNaN(currentPrice) ||
    currentPrice <= 0
  ) {
    return { action: 'hold', price: currentPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }

  // Calculate EMAs
  const shortEMA = calculateEMA(closePrices, shortPeriod);
  const longEMA = calculateEMA(closePrices, longPeriod);

  // Calculate ADX
  // const adxInput = { high: highPrices, low: lowPrices, close: closePrices, period: adxPeriod };
  // const adxValues = ADX.calculate(adxInput);

  const rsiValues = RSI.calculate({ period: 9, values: closePrices });

  // Check if there’s enough data for signal generation
  if (shortEMA.length < 2 || longEMA.length < 2) {
    return { action: 'hold', price: currentPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }

  // Get the latest and previous EMA values
  const prevShortEMA = shortEMA[shortEMA.length - 2];
  const latestShortEMA = shortEMA[shortEMA.length - 1];
  const prevLongEMA = longEMA[longEMA.length - 2];
  const latestLongEMA = longEMA[longEMA.length - 1];

  // Get the latest ADX value
  // const latestADX = adxValues[adxValues.length - 1].adx;
  const latestRSI = rsiValues[rsiValues.length - 1];

  // Buy condition: Short EMA crosses above long EMA and ADX > threshold
  if (prevShortEMA <= prevLongEMA && latestShortEMA > latestLongEMA && latestRSI > 70) {
    // console.log(latestRSI)
    return { action: 'buy', price: currentPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }
  // Sell condition: Short EMA crosses below long EMA and ADX > threshold
  else if (prevShortEMA >= prevLongEMA && latestShortEMA < latestLongEMA && latestRSI < 30) {
    return { action: 'sell', price: currentPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }
  // Default to hold if conditions aren’t met
  else {
    return { action: 'hold', price: currentPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }
}

// Helper function to calculate EMA (adjust if you have your own implementation)
function calculateEMA(prices: number[], period: number): number[] {
  const emaValues = EMA.calculate({ period: period, values: prices });
  return Array(period - 1).fill(NaN).concat(emaValues);
}