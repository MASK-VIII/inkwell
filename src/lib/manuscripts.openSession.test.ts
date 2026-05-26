import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sessionStore = new Map<string, string>()

function mockLocation(href: string) {
  const u = new URL(href, 'http://localhost')
  const location = {
    href: u.href,
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
  }
  vi.stubGlobal('window', {
    location,
    history: {
      replaceState: (_state: unknown, _title: string, url: string) => {
        const next = new URL(url, 'http://localhost')
        location.href = next.href
        location.pathname = next.pathname
        location.search = next.search
        location.hash = next.hash
      },
    },
  })
}

describe('open project session helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    sessionStore.clear()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => sessionStore.get(k) ?? null,
      setItem: (k: string, v: string) => {
        sessionStore.set(k, v)
      },
      removeItem: (k: string) => {
        sessionStore.delete(k)
      },
      clear: () => sessionStore.clear(),
    })
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolveOpenProjectId prefers tab session over URL query', async () => {
    mockLocation('http://localhost/app?project=url-book')
    const { resolveOpenProjectId, setTabSessionProjectId, INKWELL_OPEN_PROJECT_QUERY_KEY } =
      await import('./manuscripts')
    expect(INKWELL_OPEN_PROJECT_QUERY_KEY).toBe('project')
    setTabSessionProjectId('tab-book')
    expect(resolveOpenProjectId()).toBe('tab-book')
  })

  it('resolveOpenProjectId falls back to URL when tab session is empty', async () => {
    mockLocation('http://localhost/?project=url-only')
    const { resolveOpenProjectId } = await import('./manuscripts')
    expect(resolveOpenProjectId()).toBe('url-only')
  })

  it('syncOpenProjectQueryParam sets and clears project without dropping other params', async () => {
    mockLocation('http://localhost/app?checkout=basic#bookshelf')
    const { syncOpenProjectQueryParam, INKWELL_OPEN_PROJECT_QUERY_KEY } = await import('./manuscripts')
    syncOpenProjectQueryParam('book-42')
    expect(window.location.search).toContain('checkout=basic')
    expect(window.location.search).toContain(`${INKWELL_OPEN_PROJECT_QUERY_KEY}=book-42`)
    expect(window.location.hash).toBe('#bookshelf')
    syncOpenProjectQueryParam(null)
    expect(window.location.search).toContain('checkout=basic')
    expect(window.location.search).not.toContain(INKWELL_OPEN_PROJECT_QUERY_KEY)
  })

  it('resolveResumeBodyChapterId skips Contents and resumes body chapter', async () => {
    const { resolveResumeBodyChapterId, rememberOpenChapter } = await import('./manuscripts')
    const { applyBookMasterPages, CONTENTS_MASTER_ID } = await import('./masterPages')
    const { defaultBookAssembly, defaultBookMeta, defaultTheme, defaultWritingGoals } = await import('../types')
    const p = applyBookMasterPages({
      version: 3,
      id: 'book-1',
      kind: 'book',
      linkedBookId: null,
      book: defaultBookMeta(),
      goals: defaultWritingGoals(),
      chapters: [{ id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } }],
      theme: defaultTheme(),
      assembly: defaultBookAssembly(),
      seriesBible: [],
    })
    rememberOpenChapter('book-1', CONTENTS_MASTER_ID)
    expect(resolveResumeBodyChapterId(p)).toBe(1)
    rememberOpenChapter('book-1', 1)
    expect(resolveResumeBodyChapterId(p)).toBe(1)
  })

  it('ensureAtLeastOneProject tries indexed active before sorted most-recent fallback', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    })
    const { createBookProject, setActiveProjectId } = await import('./manuscripts')
    const bookA = createBookProject({ activate: false })
    const bookB = createBookProject({ activate: false })
    store.delete(`inkwell-project-v3:${bookB.id}`)
    setActiveProjectId(bookB.id)
    vi.resetModules()
    const { ensureAtLeastOneProject: ensureAfterHydrateGap } = await import('./manuscripts')
    const opened = ensureAfterHydrateGap()
    expect(opened.id).toBe(bookA.id)
  })

  it('saveProject shelf meta title skips master page chapter titles', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    })
    const { createBookProject, loadProjectIndex } = await import('./manuscripts')
    createBookProject({ activate: false })
    const meta = loadProjectIndex().projects[0]
    expect(meta?.title).toBe('Untitled book')
  })
})
