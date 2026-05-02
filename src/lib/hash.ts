export function hashStringDjb2(input: string): string {
  // Simple, fast, stable (not cryptographic).
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i)
  return (h >>> 0).toString(16)
}

