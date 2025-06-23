import { screenStocks } from './helpers/screen-stocks';
import { generateSignal } from './helpers/generate-signal';
import { simulateTrade } from './helpers/trade';
import { calculateDailyReturn } from './helpers/misc';
import { Portfolio, Tick, Trade } from './types';

const stocks = [
  'FRC',  'SEDG', 'KMX',  'DISH',
  'KR',   'WBD',  'ANET', 'LRCX',
  'STLD', 'AMAT', 'GOOG', 'GOOGL',
  'ACN',  'CTSH', 'NUE',  'DXC',
  'INTC', 'ENPH', 'TSLA', 'ALB',
  'ORCL', 'DRI',  'AMD',  'PCG',
  'CME',  'APA',  'MGM',  'AVGO',
  'PEAK', 'LLY'
];

type TradingDayProps = {
  startingCash: number;
  isBackTest?: boolean;
}

export class TradingDay {
  private isBackTest?: boolean;

  readonly shortSMAPeriod = 5; // 5-minute SMA
  readonly longSMAPeriod = 20; // 10-minute SMA (revert from 20)
  readonly stopLossPct = 0.005 // 0.75% (test vs. 0.005)
  readonly takeProfitPct = 0.02;

  private cash: number;
  private accountValue: number;
  private initialAccountValue: number;

  private selectedStocks: string[] = stocks;
  private portfolios: { [symbol: string]: Portfolio } = {};
  private priceHistories: { [symbol: string]: number[] } = {};
  private highHistories: { [symbol: string]: number[] } = {};
  private lowHistories: { [symbol: string]: number[] } = {};
  private lastPriceTime: { [symbol: string]: number } = {};

  private trades: Trade[] = [];

  constructor(props: TradingDayProps) {
    this.isBackTest = props.isBackTest;

    this.cash = props.startingCash;
    this.accountValue = props.startingCash;
    this.initialAccountValue = props.startingCash;
  }

  setCash(cash: number) {
    this.cash = cash;
  }

  async selectStocks(): Promise<string[]> {
    // this.selectedStocks = await screenStocks();

    this.selectedStocks.forEach(symbol => {
      this.portfolios[symbol] = {
        shares: 0,
        symbol,
        value: 0,
        avgEntryPrice: 0,
      };

      this.priceHistories[symbol] = [];
      this.highHistories[symbol] = [];
      this.lowHistories[symbol] = [];
      this.lastPriceTime[symbol] = Date.now();
    });

    return this.selectedStocks;
  }

  getSelectedStocks(): string[] {
    return this.selectedStocks;
  }

  processTick({ price, symbol, timestamp, low, high }: Tick) {
    if (!this.priceHistories[symbol]) {
      console.warn(`Unknown symbol: ${symbol}.`);
      return;
    }

    const currentTime = Date.parse(timestamp);

    if (currentTime - this.lastPriceTime[symbol] >= 60 * 1000 || this.isBackTest) {
      if (this.portfolios[symbol].shares > 0) {
        this.portfolios[symbol].value = this.portfolios[symbol].shares * price;
        // console.debug(`Updated portfolio for ${symbol}: shares=${this.portfolios[symbol].shares}, price=${price.toFixed(2)}, value=${this.portfolios[symbol].value.toFixed(2)}`);
      }

      if (this.priceHistories[symbol].length >= this.longSMAPeriod) {
        const signal = generateSignal(
          this.highHistories[symbol],
          this.lowHistories[symbol],
          this.priceHistories[symbol],
          this.shortSMAPeriod,
          this.longSMAPeriod,
          14,
          25,
          symbol,
          price,
        );

        const previousShares = this.portfolios[symbol].shares;

        this.portfolios[symbol] = simulateTrade(
          this.portfolios[symbol],
          signal,
          this.cash,
          this.setCash.bind(this),
          this.stopLossPct,
          this.takeProfitPct,
          this.initialAccountValue
        );

        this.accountValue = this.cash + this.selectedStocks.reduce((sum, s) => sum + (this.portfolios[s].value || 0), 0);

        if (signal.action !== 'hold') {
          const quantity = signal.action === 'buy'
            ? this.portfolios[symbol].shares - previousShares
            : previousShares;

          if (quantity !== 0) {
            this.trades.push({ ...signal, quantity });
            // this.accountValue = this.cash + this.selectedStocks.reduce((sum, s) => sum + this.portfolios[s].value, 0);
            // console.log(`Trade: ${signal.action.toUpperCase()} ${quantity} shares of ${symbol} at $${price.toFixed(2)}, Time: ${timestamp}`);
            // console.log(`[Summary] Time: ${timestamp}, Total Cash: $${this.cash.toFixed(2)}, Total Portfolio Value: $${this.accountValue.toFixed(2)}, Daily Return: ${calculateDailyReturn(this.initialAccountValue, this.accountValue).toFixed(2)}%`);
          }
        }
      }

      this.priceHistories[symbol].push(price);
      this.lowHistories[symbol].push(low);
      this.highHistories[symbol].push(high);
      this.lastPriceTime[symbol] = currentTime;
    }
  }

  end(): number {
    this.accountValue = this.cash + this.selectedStocks.reduce((sum, s) => sum + (this.portfolios[s].value || 0), 0);

    console.log(`\nSimulation Summary:`);
    console.log(`Trades: ${this.trades.length}`);

    console.log(`Final Portfolio Value: $${this.accountValue.toFixed(2)}`);
    console.log(`Finash Cash: $${this.cash}`);
    console.log(`Total Return: ${calculateDailyReturn(this.initialAccountValue, this.accountValue).toFixed(2)}% over trading day`);

    return this.accountValue;
  }
}
