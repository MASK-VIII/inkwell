import Hypher from 'hypher'
import enUs from 'hyphenation.en-us/lib/en-us.js'

let cached: InstanceType<typeof Hypher> | null = null

export function getEnglishHypher(): InstanceType<typeof Hypher> {
  if (!cached) cached = new Hypher(enUs)
  return cached
}
