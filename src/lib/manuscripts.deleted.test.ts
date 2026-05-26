import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultBookAssembly, defaultBookMeta, defaultTheme, defaultWritingGoals } from '../types'

const localStore = new Map<string, string>()

function seedBook(id: string, title: string) {
  return {
    version: 3 as const,
    id,
    kind: 'book' as const,
    linkedBookId: null,
    book: { ...defaultBookMeta(), title },
    goals: defaultWritingGoals(),
    chapters: [{ id: 1, title: 'Chapter 1', content: { type: 'doc', content: [] } }],
    theme: defaultTheme(),
    assembly: defaultBookAssembly(),
    seriesBible: [],
  }
}

describe('deleted project recovery', () => {
  beforeEach(() => {
    vi.resetModules()
    localStore.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => localStore.get(k) ?? null,
      setItem: (k: string, v: string) => {
        localStore.set(k, v)
      },
      removeItem: (k: string) => {
        localStore.delete(k)
      },
      clear: () => localStore.clear(),
      get length() {
        return localStore.size
      },
      key: (i: number) => [...localStore.keys()][i] ?? null,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('archives, lists, restores, and purges deleted projects', async () => {
    const {
      archiveDeletedProject,
      deleteProject,
      listDeletedProjects,
      loadProject,
      purgeDeletedProject,
      restoreDeletedProject,
      saveProject,
    } = await import('./manuscripts')

    const book = seedBook('book-a', 'My Novel')
    saveProject(book)
    archiveDeletedProject(book)
    deleteProject('book-a')

    expect(loadProject('book-a')).toBeNull()
    const listed = listDeletedProjects()
    expect(listed).toHaveLength(1)
    expect(listed[0]?.title).toBe('My Novel')
    expect(listed[0]?.kind).toBe('book')

    const restored = restoreDeletedProject('book-a')
    expect(restored?.book.title).toBe('My Novel')
    expect(loadProject('book-a')?.book.title).toBe('My Novel')
    expect(listDeletedProjects()).toHaveLength(0)

    archiveDeletedProject(restored!)
    deleteProject('book-a')
    purgeDeletedProject('book-a')
    expect(listDeletedProjects()).toHaveLength(0)
  })

  it('keeps only the most recent deleted entries up to the cap', async () => {
    const { archiveDeletedProject, deleteProject, listDeletedProjects, saveProject } = await import('./manuscripts')

    for (let i = 0; i < 15; i++) {
      const book = seedBook(`book-${i}`, `Title ${i}`)
      saveProject(book)
      archiveDeletedProject(book)
      deleteProject(book.id)
    }

    expect(listDeletedProjects().length).toBeLessThanOrEqual(12)
    expect(listDeletedProjects()[0]?.title).toBe('Title 14')
  })
})
