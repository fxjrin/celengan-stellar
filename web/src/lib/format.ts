export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function formatXlm(balance: string): string {
  const n = Number(balance)
  if (Number.isNaN(n)) return balance
  return n.toLocaleString('en-US', { maximumFractionDigits: 7 })
}
