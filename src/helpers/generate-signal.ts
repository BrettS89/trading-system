import { ADX, EMA, RSI } from 'technicalindicators';

// Define the Trade type
interface Trade {
  action: 'buy' | 'sell' | 'hold';
  price: number;
  quantity: number;
  timestamp: string;
  symbol: string;
  stopLoss?: number;
  takeProfit?: number;
}

export function generateSignal(
  highPrices: number[],      // Array of high prices
  lowPrices: number[],       // Array of low prices
  closePrices: number[],     // Array of close prices
  volume: number[],          // Array of volume data
  shortPeriod: number = 5,   // Short EMA period (5 minutes)
  longPeriod: number = 20,   // Long EMA period (20 minutes)
  adxPeriod: number = 14,    // ADX period (14 minutes)
  adxThreshold: number = 25, // ADX threshold for trend strength
  rsiPeriod: number = 14,    // RSI period (14 minutes)
  volumePeriod: number = 7,  // Volume MA period (7 minutes)
  volumeMultiplier: number = 1.3, // Volume threshold multiplier
  stopLossPct: number = 0.01, // Stop-loss percentage (0.5%)
  takeProfitPct: number = 0.015, // Take-profit percentage (1%)
  symbol: string,            // Trading symbol (e.g., 'AAPL')
  currentPrice: number       // Current price
): Trade {
  // Determine minimum required data length
  const minLength = Math.max(shortPeriod + 1, longPeriod + 1, adxPeriod, rsiPeriod, volumePeriod);

  // Validate input data
  if (
    !highPrices ||
    !lowPrices ||
    !closePrices ||
    !volume ||
    highPrices.length < minLength ||
    lowPrices.length < minLength ||
    closePrices.length < minLength ||
    volume.length < minLength ||
    isNaN(currentPrice) ||
    currentPrice <= 0
  ) {
    return { action: 'hold', price: currentPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }

  // Calculate EMAs
  const shortEMA = calculateEMA(closePrices, shortPeriod);
  const longEMA = calculateEMA(closePrices, longPeriod);

  // Calculate ADX
  const adxInput = { high: highPrices, low: lowPrices, close: closePrices, period: adxPeriod };
  const adxValues = ADX.calculate(adxInput);

  // Calculate RSI
  const rsiValues = RSI.calculate({ period: rsiPeriod, values: closePrices });

  // Calculate Volume Moving Average
  const volumeSlice = volume.slice(-volumePeriod);
  const volumeMA = volumeSlice.reduce((sum, vol) => sum + vol, 0) / volumePeriod;
  const latestVolume = volume[volume.length - 1];

  // Check if there’s enough data for signal generation
  if (
    shortEMA.length < 2 ||
    longEMA.length < 2 ||
    adxValues.length < 1 ||
    rsiValues.length < 1
  ) {
    return { action: 'hold', price: currentPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }

  // Get the latest and previous EMA values
  const prevShortEMA = shortEMA[shortEMA.length - 2];
  const latestShortEMA = shortEMA[shortEMA.length - 1];
  const prevLongEMA = longEMA[longEMA.length - 2];
  const latestLongEMA = longEMA[longEMA.length - 1];

  // Get the latest ADX and RSI values
  const latestADX = adxValues[adxValues.length - 1].adx;
  const latestRSI = rsiValues[rsiValues.length - 1];

  // Calculate stop-loss and take-profit prices
  const stopLossPrice = currentPrice * (1 - stopLossPct);
  const takeProfitPrice = currentPrice * (1 + takeProfitPct);

  // Buy condition: Short EMA crosses above long EMA, ADX > 25, RSI > 50, and volume > threshold
  if (
    prevShortEMA <= prevLongEMA &&
    latestShortEMA > latestLongEMA &&
    latestADX > adxThreshold &&
    latestRSI > 50 &&
    latestVolume > volumeMA * volumeMultiplier
  ) {
    return {
      action: 'buy',
      price: currentPrice,
      quantity: 0,
      timestamp: new Date().toISOString(),
      symbol,
      stopLoss: stopLossPrice,
      takeProfit: takeProfitPrice,
    };
  }
  // Sell condition: Short EMA crosses below long EMA, ADX > 25, RSI < 50, and volume > threshold
  else if (
    prevShortEMA >= prevLongEMA &&
    latestShortEMA < latestLongEMA &&
    latestADX > adxThreshold &&
    latestRSI < 50 &&
    latestVolume > volumeMA * volumeMultiplier
  ) {
    return {
      action: 'sell',
      price: currentPrice,
      quantity: 0,
      timestamp: new Date().toISOString(),
      symbol,
      stopLoss: currentPrice * (1 + stopLossPct), // Adjusted for sell
      takeProfit: currentPrice * (1 - takeProfitPct), // Adjusted for sell
    };
  }
  // Default to hold if conditions aren’t met
  else {
    return { action: 'hold', price: currentPrice, quantity: 0, timestamp: new Date().toISOString(), symbol };
  }
}

// Helper function to calculate EMA using technicalindicators
function calculateEMA(prices: number[], period: number): number[] {
  const emaValues = EMA.calculate({ period: period, values: prices });
  return Array(period - 1).fill(NaN).concat(emaValues);
}