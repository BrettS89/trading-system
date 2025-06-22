require('dotenv').config();
import fs from 'fs';
import { TradingDay } from './trading-day';
import { Tick } from './types';
import { calculateDailyReturn } from './helpers/misc';

const runBacktest = async () => {
  const dates = fs.readdirSync('./src/data').filter(el => el.includes('2024'));

  const startingCash = 10000;
  let cash = startingCash;

  let i = 0;

  for (const date of dates) {
    const tradingDay = new TradingDay({ startingCash: cash, isBackTest: true });
    await tradingDay.selectStocks();

    const json = fs.readFileSync(`./src/data/${date}`, 'utf-8');

    const bars = JSON.parse(json) as Tick[];

    bars.forEach(bar => tradingDay.processTick(bar));

    cash = tradingDay.end();

    console.log(`Date: ${dates[i]}`);
    i++;
  }

  console.log(`\nBacktest Returns: ${calculateDailyReturn(startingCash, cash).toFixed(2)}% over trading simulation`);
};

runBacktest();
