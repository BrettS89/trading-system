import { screenStocks } from './helpers/screen-stocks';
import { generateSignal3 } from './helpers/generate-signal';
import { simulateTrade } from './helpers/trade';
import { calculateDailyReturn } from './helpers/misc';
import { Portfolio, Tick, Trade } from './types';

type TradingDayProps = {
  startingCash: number;
}

export class TradingDay {
  readonly shortSMAPeriod = 5; // 5-minute SMA
  readonly longSMAPeriod = 20; // 20-minute SMA
  readonly stopLossPct = 0.005; // 0.5%
  readonly takeProfitPct = 0.02; // 2%

  private cash: number;
  private accountValue: number;
  private initialAccountValue: number;

  private selectedStocks: string[] = [];
  private portfolios: { [symbol: string]: Portfolio } = {};
  private priceHistories: { [symbol: string]: number[] } = {};
  private lastPriceTime: { [symbol: string]: number } = {};

  private trades: Trade[] = [];

  constructor(props: TradingDayProps) {
    this.cash = props.startingCash;
    this.accountValue = props.startingCash;
    this.initialAccountValue = props.startingCash;
  }

  setCash(cash: number) {
    this.cash = cash;
  }

  async selectStocks(): Promise<string[]> {
    this.selectedStocks = await screenStocks();

    this.selectedStocks.forEach(symbol => {
      this.portfolios[symbol] = {
        shares: 0,
        symbol,
        value: 0,
        avgEntryPrice: 0,
      };

      this.priceHistories[symbol] = [];
      this.lastPriceTime[symbol] = Date.now();
    });

    return this.selectedStocks;
  }

  getSelectedStocks(): string[] {
    return this.selectedStocks;
  }

  processTick({ price, symbol, timestamp }: Tick) {
    if (!this.priceHistories[symbol]) {
      console.warn(`Unknown symbol: ${symbol}.`);
      return;
    }

    const currentTime = Date.parse(timestamp);

    if (currentTime - this.lastPriceTime[symbol] >= 60 * 1000) {
      this.priceHistories[symbol].push(price);
      this.lastPriceTime[symbol] = currentTime;

      if (this.priceHistories[symbol].length >= this.longSMAPeriod) {
        const signal = generateSignal3(
          this.priceHistories[symbol].slice(-this.longSMAPeriod),
          this.shortSMAPeriod,
          this.longSMAPeriod,
          symbol,
          price
        );

        const previousShares = this.portfolios[symbol].shares;

        this.portfolios[symbol] = simulateTrade(
          this.portfolios[symbol],
          signal,
          this.cash,
          this.setCash.bind(this),
          this.stopLossPct,
          this.takeProfitPct
        );

        if (signal.action !== 'hold') {
          const quantity = signal.action === 'buy'
            ? this.portfolios[symbol].shares - previousShares
            : previousShares;

          if (quantity !== 0) {
            this.trades.push({ ...signal, quantity });
            this.accountValue = this.cash + this.selectedStocks.reduce((sum, s) => sum + this.portfolios[s].value, 0);
            console.log(`Trade: ${signal.action.toUpperCase()} ${quantity} shares of ${symbol} at $${price.toFixed(2)}, Time: ${timestamp}`);
            console.log(`[Summary] Time: ${timestamp}, Total Cash: $${this.cash.toFixed(2)}, Total Portfolio Value: $${this.accountValue.toFixed(2)}, Daily Return: ${calculateDailyReturn(this.initialAccountValue, this.accountValue).toFixed(2)}%`);
          }
        }
      }
    }
  }

  updatePortfolioAndAccount() {

  }

  end(): number {
    console.log(`\nSimulation Summary:`);
    console.log(`Final Total Cash: $${this.cash.toFixed(2)}`);
    console.log(`Total Return: ${calculateDailyReturn(this.initialAccountValue, this.accountValue).toFixed(2)}% over trading day`);

    return this.accountValue;
  }
}
