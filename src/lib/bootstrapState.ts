import { isInkwellLocalOnlyMode } from './localPersonalMode'
import { loadProjectIndex } from './manuscripts'

const STORAGE_BOOTSTRAP = 'inkwell-bootstrap-v1'
const LEGACY_V1 = 'inkwell-manuscripts-v1'
const LEGACY_V2 = 'inkwell-project-v2'

/** Bump when tutorial steps or copy change so users see the new tour once. */
export const CURRENT_TUTORIAL_VERSION = 3

/** Bump when the Notes tour copy or steps change (separate from main getting-started). */
export const CURRENT_NOTES_TUTORIAL_VERSION = 5

export type WriterPresetId = 'author'

export type InkwellBootstrap = {
  version: 1
  writerPreset?: WriterPresetId
  /**
   * First-run “welcome” / gate completion (name kept for v1 localStorage).
   * Anonymous free use does not require completing the gate; see `shouldShowSignIn`.
   */
  welcomeDone: boolean
  /**
   * When true (e.g. after app Sign out), show the sign-in gate again on next load.
   * New installs leave this unset so `/app` opens the workspace without forcing `#signin`.
   */
  preferSignInGate?: boolean
  /** Last tutorial content version the user completed or skipped. */
  tutorialVersion: number
  /** When set, first-run tour resumes at this step after “Remind me later” (does not bump `tutorialVersion`). */
  tutorialStepId?: string
  /** Last Notes tour content version completed or skipped (independent of `tutorialVersion`). */
  notesTutorialVersion?: number
  /** Mid–Notes tour resume id (see `notesTutorialSteps`). */
  notesTutorialStepId?: string
}

function emptyBootstrap(): InkwellBootstrap {
  return { version: 1, welcomeDone: false, tutorialVersion: 0, notesTutorialVersion: 0 }
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
      const tutorialStepId =
        typeof o.tutorialStepId === 'string' && o.tutorialStepId.trim() ? o.tutorialStepId.trim() : undefined
      const notesTutorialVersion =
        typeof o.notesTutorialVersion === 'number' && Number.isFinite(o.notesTutorialVersion) ?
          o.notesTutorialVersion
        : 0
      const notesTutorialStepId =
        typeof o.notesTutorialStepId === 'string' && o.notesTutorialStepId.trim() ?
          o.notesTutorialStepId.trim()
        : undefined
      return {
        version: 1,
        writerPreset,
        welcomeDone: o.welcomeDone,
        preferSignInGate: preferSignInGate ? true : undefined,
        tutorialVersion: Number.isFinite(o.tutorialVersion) ? o.tutorialVersion : 0,
        tutorialStepId,
        notesTutorialVersion,
        notesTutorialStepId,
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
 * `welcomeDone` is set. That avoids treating existing libraries as “stuck” on the gate.
 */
export function readBootstrap(): InkwellBootstrap {
  if (typeof window === 'undefined')
    return {
      ...emptyBootstrap(),
      welcomeDone: true,
      tutorialVersion: CURRENT_TUTORIAL_VERSION,
      tutorialStepId: undefined,
      notesTutorialVersion: 0,
    }
  let raw: string | null
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

/** True only when the user explicitly returned to the gate (e.g. Sign out), not for every new profile. */
export function shouldShowSignIn(bootstrap: InkwellBootstrap): boolean {
  if (isInkwellLocalOnlyMode()) return false
  return !bootstrap.welcomeDone && bootstrap.preferSignInGate === true
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
    tutorialStepId: undefined,
  })
}

/** Persist mid-tour step for resume; does not mark the tutorial version complete. */
export function saveTutorialResumeStep(stepId: string): void {
  const prev = readBootstrap()
  saveBootstrap({
    ...prev,
    version: 1,
    tutorialStepId: stepId,
  })
}

export function clearTutorialResumeStep(): void {
  const prev = readBootstrap()
  if (!prev.tutorialStepId) return
  saveBootstrap({ ...prev, version: 1, tutorialStepId: undefined })
}

export function shouldShowNotesTutorial(bootstrap: InkwellBootstrap): boolean {
  const v = bootstrap.notesTutorialVersion ?? 0
  return v < CURRENT_NOTES_TUTORIAL_VERSION
}

export function markNotesTutorialSeen(version: number = CURRENT_NOTES_TUTORIAL_VERSION): void {
  const prev = readBootstrap()
  saveBootstrap({
    ...prev,
    version: 1,
    notesTutorialVersion: Math.max(prev.notesTutorialVersion ?? 0, version),
    notesTutorialStepId: undefined,
  })
}

export function saveNotesTutorialResumeStep(stepId: string): void {
  const prev = readBootstrap()
  saveBootstrap({
    ...prev,
    version: 1,
    notesTutorialStepId: stepId,
  })
}

export function clearNotesTutorialResumeStep(): void {
  const prev = readBootstrap()
  if (!prev.notesTutorialStepId) return
  saveBootstrap({ ...prev, version: 1, notesTutorialStepId: undefined })
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
        tutorialStepId: undefined,
        notesTutorialVersion: 0,
        notesTutorialStepId: undefined,
      } satisfies InkwellBootstrap),
    )
  } catch {
    /* ignore */
  }
}
