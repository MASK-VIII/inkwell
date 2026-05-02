declare module 'hypher' {
  type LanguagePatterns = {
    patterns: Record<number, string>
    leftmin: number
    rightmin: number
    exceptions?: string
  }

  class Hypher {
    constructor(language: LanguagePatterns)
    hyphenate(word: string): string[]
    hyphenateText(str: string, minLength?: number): string
  }
  export default Hypher
}

declare module 'hyphenation.en-us/lib/en-us.js' {
  const patterns: {
    patterns: Record<number, string>
    leftmin: number
    rightmin: number
    exceptions?: string
  }
  export default patterns
}
