// Synthetic reference text for evaluations. Every product here is invented on purpose:
// these cases test whether the system stays faithful to its evidence, without pretending
// to know real Inogen specifications. No figure below describes any real device.
export interface CorpusProduct {
  name: string;
  weightLbs: number;
  settings: number;
  batteryHours: number;
  warrantyYears: number;
  price: number;
}

export const CORPUS_PRODUCTS: CorpusProduct[] = [
  { name: "Aero A1",  weightLbs: 3.1, settings: 3, batteryHours: 11, warrantyYears: 2, price: 1810 },
  { name: "Aero A2",  weightLbs: 3.4, settings: 4, batteryHours: 12, warrantyYears: 2, price: 2020 },
  { name: "Aero A3",  weightLbs: 3.7, settings: 5, batteryHours: 13, warrantyYears: 3, price: 2240 },
  { name: "Aero A4",  weightLbs: 4.2, settings: 5, batteryHours: 14, warrantyYears: 3, price: 2460 },
  { name: "Aero A5",  weightLbs: 4.6, settings: 6, batteryHours: 15, warrantyYears: 3, price: 2680 },
  { name: "Breeze B1", weightLbs: 5.3, settings: 6, batteryHours: 16, warrantyYears: 4, price: 2890 },
  { name: "Breeze B2", weightLbs: 5.8, settings: 7, batteryHours: 17, warrantyYears: 4, price: 3110 },
  { name: "Breeze B3", weightLbs: 6.4, settings: 7, batteryHours: 18, warrantyYears: 4, price: 3340 },
  { name: "Breeze B4", weightLbs: 7.2, settings: 8, batteryHours: 19, warrantyYears: 5, price: 3560 },
  { name: "Breeze B5", weightLbs: 7.9, settings: 8, batteryHours: 21, warrantyYears: 5, price: 3780 },
];

export const CORPUS_TEXT = CORPUS_PRODUCTS.map((p) =>
  `${p.name}: weighs ${p.weightLbs} lbs. Has ${p.settings} settings. Battery lasts up to ${p.batteryHours} hours. ` +
  `Warranty is ${p.warrantyYears} years. List price $${p.price.toLocaleString("en-US")}.`,
).join("\n");

export const CORPUS_VERSION = "synthetic-corpus-v1";
