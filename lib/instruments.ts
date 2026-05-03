export const INSTRUMENTS: Record<string, string[]> = {
  forex_majors: [
    "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD",
  ],
  forex_minors: [
    "EURGBP", "EURJPY", "GBPJPY", "AUDJPY", "EURAUD", "GBPAUD", "EURCAD",
    "GBPCAD", "AUDCAD", "NZDJPY", "CHFJPY", "EURNZD", "GBPNZD",
  ],
  metals: ["XAUUSD", "XAGUSD", "XPTUSD"],
  indices: [
    "NAS100", "US30", "SPX500", "GER40", "UK100", "FRA40", "JPN225", "AUS200", "HK50",
  ],
  crypto: ["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "ADAUSD", "DOGEUSD", "BNBUSD"],
  commodities: ["WTIUSD", "BCOUSD", "NATGAS"],
};

export const ALL_INSTRUMENTS: string[] = Object.values(INSTRUMENTS).flat();

export const INSTRUMENT_CATEGORIES: Record<string, string> = {
  forex_majors: "Forex Majors",
  forex_minors: "Forex Minors",
  metals: "Metals",
  indices: "Indices",
  crypto: "Crypto",
  commodities: "Commodities",
};
