export const calculateDailyReturn = (initialValue: number, finalValue: number): number =>
  ((finalValue - initialValue) / initialValue) * 100;

export const getTimeToMarketClose = (): number => {
  const marketClose = new Date();

  marketClose.setHours(16, 0, 0, 0);

  return marketClose.getTime() - Date.now();
};
