require('dotenv').config();
import fs from 'fs';
import axios from 'axios';
import { screenStocks } from './helpers/screen-stocks';
import { Tick, BarData } from './types';

const ALPACA_API_KEY = process.env.ALPACA_API_KEY!;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET!;
const ALPACA_REST_URL = 'https://data.alpaca.markets/v2';

const fetchData = async (start: string, end: string, stocks: any, nextPageToken?: any): Promise<any> => {
  const response = await axios.get(`${ALPACA_REST_URL}/stocks/bars`, {
    headers: {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
    },
    params: {
      symbols: stocks,
      timeframe: '1Min',
      start,
      end,
      page_token: nextPageToken,
      feed: 'iex',
      limit: 10000,
    },
  });

  return response.data;
};

export const getHistoricalData = async (start: string, end: string) => {
  const selectedStocks = (await screenStocks()).join(',');

  let daysBars = [];
  let lastDate: string;

  const ticks: Tick[] = [];

  let nextPageToken: string | undefined;
  let started = false;

  while (nextPageToken || !started) {
    started = true;

    const data = await fetchData(start, end, selectedStocks, nextPageToken);

    nextPageToken = data.next_page_token;
  
    const barData = data.bars as BarData;
  
    for (const symbol in barData) {
      barData[symbol].forEach(el => {
        ticks.push({
          symbol: symbol,
          price: el.c,
          timestamp: el.t,
          high: el.h,
          low: el.l,
          volume: el.v,
        });
      });
    }
    
    const sorted = ticks.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    sorted.forEach(el => {
      const date = el.timestamp.split('T')[0];

      if (date !== lastDate) {
        if (lastDate) {
            fs.writeFileSync(`./src/data/${lastDate}.json`, JSON.stringify(daysBars));
            daysBars = [];
        }
      }

      daysBars.push(el);
      lastDate = date;
    });

  }

  fs.writeFileSync(`./src/data/${lastDate}.json`, JSON.stringify(daysBars));
};

const arr = [
  {
    start: '2024-01-02T09:30:00-04:00',
    end: '2024-02-01T16:00:00-04:00',
  },
  {
    start: '2024-02-02T09:30:00-04:00',
    end: '2024-03-01T16:00:00-04:00',
  },
  {
    start: '2024-03-02T09:30:00-04:00',
    end: '2024-04-01T16:00:00-04:00',
  },
  {
    start: '2024-04-02T09:30:00-04:00',
    end: '2024-05-01T16:00:00-04:00',
  },
  {
    start: '2024-05-02T09:30:00-04:00',
    end: '2024-06-01T16:00:00-04:00',
  },
  {
    start: '2024-06-02T09:30:00-04:00',
    end: '2024-07-01T16:00:00-04:00',
  },
  {
    start: '2024-07-02T09:30:00-04:00',
    end: '2024-08-01T16:00:00-04:00',
  },
  {
    start: '2024-08-02T09:30:00-04:00',
    end: '2024-09-01T16:00:00-04:00',
  },
  {
    start: '2024-09-02T09:30:00-04:00',
    end: '2024-10-01T16:00:00-04:00',
  },
  {
    start: '2024-10-02T09:30:00-04:00',
    end: '2024-11-01T16:00:00-04:00',
  },
  {
    start: '2024-11-02T09:30:00-04:00',
    end: '2024-12-01T16:00:00-04:00',
  },
  {
    start: '2024-12-02T09:30:00-04:00',
    end: '2024-12-31T16:00:00-04:00',
  }
];

const run = async () => {
  for (let el of arr) {
    await getHistoricalData(el.start, el.end);
  }
}; 

run();