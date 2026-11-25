import bank from './bank.json'
export const seed=bank
export const sources=Array.from(new Set(seed.map(q=>q.source)))
export const topics=Array.from(new Set(seed.map(q=>q.topic)))
