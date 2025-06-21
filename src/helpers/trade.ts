import { Portfolio, Trade } from '../types';

export function simulateTrade(portfolio: Portfolio, signal: Trade, totalCash: number, setTotalCash: (cash: number) => void, stopLossPct: number, takeProfitPct: number): Portfolio {
  const updatedPortfolio = { ...portfolio };
  const maxTradeSize = totalCash * 0.02;

  let quantity = 0;

  if (signal.action === 'buy' && totalCash > 0) {
    quantity = Math.floor(maxTradeSize / signal.price);
    if (quantity * signal.price <= totalCash) {
      // Update average entry price
      const totalCost = updatedPortfolio.shares * updatedPortfolio.avgEntryPrice + quantity * signal.price;
      setTotalCash(totalCash - quantity * signal.price);
      updatedPortfolio.shares += quantity;
      updatedPortfolio.avgEntryPrice = updatedPortfolio.shares > 0 ? totalCost / updatedPortfolio.shares : 0;
    }
  } else if (signal.action === 'sell' && portfolio.shares > 0) {
    quantity = portfolio.shares; // Sell all shares
    setTotalCash(totalCash + quantity * signal.price);
    updatedPortfolio.shares = 0;
    updatedPortfolio.avgEntryPrice = 0; // Reset entry price
  }

  // Check stop-loss or take-profit
  if (portfolio.shares > 0) {
    const entryPrice = updatedPortfolio.avgEntryPrice; // Use average entry price
    const stopLossPrice = entryPrice * (1 - stopLossPct);
    const takeProfitPrice = entryPrice * (1 + takeProfitPct);
    if (signal.price <= stopLossPrice || signal.price >= takeProfitPrice) {
      setTotalCash(totalCash + portfolio.shares * signal.price);
      updatedPortfolio.shares = 0;
      updatedPortfolio.avgEntryPrice = 0;
    }
  }

  updatedPortfolio.value = updatedPortfolio.shares * signal.price;
  
  return updatedPortfolio;
}
