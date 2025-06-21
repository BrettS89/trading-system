import axios from 'axios';
import { sp500 } from './sp500';

const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;
const ALPACA_REST_URL = 'https://data.alpaca.markets/v2';

export async function screenStocks(): Promise<string[]> {
  const response = await axios.get(`${ALPACA_REST_URL}/stocks/snapshots`, {
    headers: {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
    },
    params: {
      symbols: sp500,
    },
  });

  const stocks = Object.entries(response.data)
    .map(([symbol, snapshot]: [string, any]) => {
      const dailyBar = snapshot.dailyBar;
      const volume = dailyBar.v;
      const dailyRange = (dailyBar.h - dailyBar.l) / dailyBar.c;
      return { symbol, volume, dailyRange };
    })
    .filter(stock => stock.volume > 100000 && stock.dailyRange > 0.03) // High volume, >2.5% range
    .sort((a, b) => b.dailyRange - a.dailyRange) // Sort by daily range (descending)
    .map(stock => stock.symbol);

  return stocks.slice(0, 30);
}
