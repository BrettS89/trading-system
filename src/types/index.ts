// Interface for portfolio state
export interface Portfolio {
  shares: number; // Number of shares held
  symbol: string; // Stock symbol (e.g., 'AAPL')
  value: number; // Value of shares (shares * current price)
  avgEntryPrice: number; // New: Track weighted average entry price
  totalLoss?: number;
}

// Interface for a trade
export interface Trade {
  action: 'buy' | 'sell' | 'hold';
  price: number;
  quantity: number;
  timestamp: string;
  symbol: string;
}

export type Tick = {
  symbol: string;
  price: number;
  timestamp: string;
}
