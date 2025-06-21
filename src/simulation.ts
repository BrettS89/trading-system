require('dotenv').config();
import WebSocket from 'ws';
import { TradingDay } from './trading-day';
import { getTimeToMarketClose } from './helpers/misc';

const ALPACA_WS_URL = 'wss://stream.data.alpaca.markets/v2/iex';

const alpacaAuthObject = {
  action: 'auth',
  key: process.env.ALPACA_API_KEY,
  secret: process.env.ALPACA_API_SECRET,
};

async function run() {
  const tradingDay = new TradingDay({ startingCash: 10000 });
  const selectedStocks = await tradingDay.selectStocks();

  const ws = new WebSocket(ALPACA_WS_URL);

  ws.on('open', () => {
    console.log('Connected to Alpaca WebSocket');
    ws.send(JSON.stringify(alpacaAuthObject));
    ws.send(JSON.stringify({ action: 'subscribe', trades: selectedStocks }));
  });

  ws.on('message', (data: string) => {
    const message = JSON.parse(data);

    if (message[0]?.T !== 't') return;

    tradingDay.processTick({
      symbol: message[0].S,
      price: message[0].p,
      timestamp: message[0].t,
    });
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    ws.close();
  });

  // Run until market close (4:00 PM EDT)
  await new Promise(resolve =>
    setTimeout(resolve, getTimeToMarketClose())
  );

  ws.close();

  tradingDay.end();
}

run();
