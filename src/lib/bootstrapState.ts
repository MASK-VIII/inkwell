import { loadProjectIndex } from './manuscripts'

const STORAGE_BOOTSTRAP = 'inkwell-bootstrap-v1'
const LEGACY_V1 = 'inkwell-manuscripts-v1'
const LEGACY_V2 = 'inkwell-project-v2'

/** Bump when tutorial steps or copy change so users see the new tour once. */
export const CURRENT_TUTORIAL_VERSION = 1

export type WriterPresetId = 'author'

export type InkwellBootstrap = {
  version: 1
  writerPreset?: WriterPresetId
  /** Sign-in gate completed (field name kept for v1 localStorage compatibility). */
  welcomeDone: boolean
  /** When true, skip auto-completing the gate from an existing library (user chose Sign out). */
  preferSignInGate?: boolean
  /** Last tutorial content version the user completed or skipped. */
  tutorialVersion: number
}

function emptyBootstrap(): InkwellBootstrap {
  return { version: 1, welcomeDone: false, tutorialVersion: 0 }
}

function hasLegacyInkwellData(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (localStorage.getItem(LEGACY_V1)) return true
    if (localStorage.getItem(LEGACY_V2)) return true
  } catch {
    /* ignore */
  }
  return false
}

/** True if this browser already had a library or legacy storage before bootstrap existed. */
export function hasExistingInkwellLibrary(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const idx = loadProjectIndex()
    if (idx.projects.length > 0) return true
  } catch {
    /* ignore */
  }
  return hasLegacyInkwellData()
}

function parseBootstrap(raw: string | null): InkwellBootstrap | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as Partial<InkwellBootstrap>
    if (o && o.version === 1 && typeof o.welcomeDone === 'boolean' && typeof o.tutorialVersion === 'number') {
      const writerPreset: WriterPresetId | undefined = o.writerPreset === 'author' ? 'author' : undefined
      const preferSignInGate = o.preferSignInGate === true
      return {
        version: 1,
        writerPreset,
        welcomeDone: o.welcomeDone,
        preferSignInGate: preferSignInGate ? true : undefined,
        tutorialVersion: Number.isFinite(o.tutorialVersion) ? o.tutorialVersion : 0,
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function saveBootstrap(state: InkwellBootstrap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_BOOTSTRAP, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

/**
 * Read persisted bootstrap; if the user already had projects or legacy keys, migrate so
 * `welcomeDone` is set and they never see the first-run sign-in gate.
 */
export function readBootstrap(): InkwellBootstrap {
  if (typeof window === 'undefined') return { ...emptyBootstrap(), welcomeDone: true, tutorialVersion: CURRENT_TUTORIAL_VERSION }
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_BOOTSTRAP)
  } catch {
    return emptyBootstrap()
  }
  let state = parseBootstrap(raw) ?? emptyBootstrap()
  if (hasExistingInkwellLibrary() && !state.welcomeDone && !state.preferSignInGate) {
    state = {
      ...state,
      welcomeDone: true,
      writerPreset: state.writerPreset ?? 'author',
      tutorialVersion: Math.max(state.tutorialVersion, CURRENT_TUTORIAL_VERSION),
    }
    saveBootstrap(state)
  }
  return state
}

export function shouldShowSignIn(bootstrap: InkwellBootstrap): boolean {
  return !bootstrap.welcomeDone
}

export function shouldShowTutorial(bootstrap: InkwellBootstrap): boolean {
  return bootstrap.tutorialVersion < CURRENT_TUTORIAL_VERSION
}

/** Complete the sign-in gate; defaults internal writer preset to author for future shelf defaults. */
export function markSignInComplete(): InkwellBootstrap {
  const prev = readBootstrap()
  const preset: WriterPresetId = 'author'
  applyWriterPreset(preset)
  const next: InkwellBootstrap = {
    ...prev,
    version: 1,
    writerPreset: preset,
    welcomeDone: true,
    preferSignInGate: undefined,
  }
  saveBootstrap(next)
  return next
}

/** Return to the sign-in gate without clearing projects (local session only). */
export function markSignedOut(): InkwellBootstrap {
  const prev = readBootstrap()
  const next: InkwellBootstrap = {
    ...prev,
    version: 1,
    welcomeDone: false,
    preferSignInGate: true,
  }
  saveBootstrap(next)
  return next
}

export function markTutorialSeen(version: number = CURRENT_TUTORIAL_VERSION): void {
  const prev = readBootstrap()
  saveBootstrap({
    ...prev,
    version: 1,
    tutorialVersion: Math.max(prev.tutorialVersion, version),
  })
}

/** Hook for future shelf defaults per writer type; Author uses current bookshelf as-is. */
export function applyWriterPreset(_preset: WriterPresetId): void {
  void _preset
}

// --- Dev-only: replay sign-in gate / tutorial (stripped from production builds) ---

const DEV_SESSION_FORCE_SIGNIN = 'inkwell-dev-force-signin'
/** @deprecated session key — read once so devs mid-migration still get the forced gate. */
const DEV_SESSION_FORCE_SIGNIN_LEGACY = 'inkwell-dev-force-welcome'

/** Next full reload will open the sign-in gate even if this profile already has a library. */
export function devScheduleReplaySignIn(): void {
  if (!import.meta.env.DEV) return
  try {
    sessionStorage.setItem(DEV_SESSION_FORCE_SIGNIN, '1')
  } catch {
    /* ignore */
  }
  window.location.reload()
}

export function devClearForceSignInFlag(): void {
  if (!import.meta.env.DEV) return
  try {
    sessionStorage.removeItem(DEV_SESSION_FORCE_SIGNIN)
    sessionStorage.removeItem(DEV_SESSION_FORCE_SIGNIN_LEGACY)
  } catch {
    /* ignore */
  }
}

export function devIsForceSignInActive(): boolean {
  if (!import.meta.env.DEV || typeof sessionStorage === 'undefined') return false
  try {
    return (
      sessionStorage.getItem(DEV_SESSION_FORCE_SIGNIN) === '1' ||
      sessionStorage.getItem(DEV_SESSION_FORCE_SIGNIN_LEGACY) === '1'
    )
  } catch {
    return false
  }
}

/** Lower stored tutorial version so the getting-started tour can open again (same session). */
export function devResetTutorialForReplay(): void {
  if (!import.meta.env.DEV) return
  const b = readBootstrap()
  try {
    localStorage.setItem(
      STORAGE_BOOTSTRAP,
      JSON.stringify({
        ...b,
        version: 1,
        tutorialVersion: 0,
      } satisfies InkwellBootstrap),
    )
  } catch {
    /* ignore */
  }
}
