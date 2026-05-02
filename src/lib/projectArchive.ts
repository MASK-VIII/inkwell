import JSZip from 'jszip'
import type { InkwellProject, ProjectIndex, ProjectMeta } from '../types'
import {
  loadProject,
  saveProject,
  loadProjectIndex,
  normalizeProjectMeta,
  normalizeImportedProject,
  saveProjectIndex,
} from './manuscripts'

const ARCHIVE_FORMAT = 'inkwell-archive'
const ARCHIVE_VERSION = 1

export type InkwellArchiveManifest = {
  format: typeof ARCHIVE_FORMAT
  version: number
  exportedAt: number
  /** Single project export */
  projectId?: string
  /** Library export: all project ids included */
  projectIds?: string[]
}

/**
 * Export one book/note as a portable .inkwell.zip (project JSON + manifest).
 */
export async function exportProjectZip(project: InkwellProject): Promise<Blob> {
  const zip = new JSZip()
  const manifest: InkwellArchiveManifest = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: Date.now(),
    projectId: project.id,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('project.json', JSON.stringify(project, null, 2))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } })
}

/**
 * Full local library backup: index + each project payload as JSON (uncompressed inside zip for resilience).
 */
export async function exportLibraryZip(): Promise<Blob> {
  const idx = loadProjectIndex()
  const zip = new JSZip()
  const ids = idx.projects.map((p) => p.id)
  const manifest: InkwellArchiveManifest = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: Date.now(),
    projectIds: ids,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('index.json', JSON.stringify(idx, null, 2))
  const projectsFolder = zip.folder('projects')
  for (const id of ids) {
    const p = loadProject(id)
    if (p) projectsFolder?.file(`${id}.json`, JSON.stringify(p, null, 2))
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } })
}

export type ImportArchiveResult =
  | { ok: true; project: InkwellProject; mode: 'single' }
  | { ok: true; imported: number; mode: 'library' }
  | { ok: false; error: string }

function parseProjectJson(raw: string, fallbackId: string): InkwellProject | null {
  try {
    const parsed = JSON.parse(raw) as Partial<InkwellProject>
    if (!parsed || parsed.version !== 3) return null
    return normalizeImportedProject(parsed, parsed.id ?? fallbackId)
  } catch {
    return null
  }
}

/**
 * Import .inkwell.zip — single project or library bundle.
 */
export async function importInkwellArchive(file: File): Promise<ImportArchiveResult> {
  const ab = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(ab)
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) return { ok: false, error: 'Missing manifest.json' }
  let manifest: InkwellArchiveManifest
  try {
    manifest = JSON.parse(await manifestFile.async('string')) as InkwellArchiveManifest
  } catch {
    return { ok: false, error: 'Invalid manifest.json' }
  }
  if (manifest.format !== ARCHIVE_FORMAT) return { ok: false, error: 'Not an Inkwell archive' }

  const projFile = zip.file('project.json')
  if (projFile) {
    const raw = await projFile.async('string')
    const idFromName = manifest.projectId ?? crypto.randomUUID?.() ?? `import_${Date.now()}`
    const project = parseProjectJson(raw, idFromName)
    if (!project) return { ok: false, error: 'Invalid project.json' }
    const saved = saveProject(project)
    return { ok: true, project: saved, mode: 'single' }
  }

  const indexFile = zip.file('index.json')
  if (indexFile) {
    let indexParsed: ProjectIndex
    try {
      indexParsed = JSON.parse(await indexFile.async('string')) as ProjectIndex
    } catch {
      return { ok: false, error: 'Invalid index.json' }
    }
    const folder = zip.folder('projects')
    if (!folder) return { ok: false, error: 'Missing projects folder' }
    let count = 0
    for (const f of Object.values(folder.files)) {
      if (f.dir || !f.name.endsWith('.json')) continue
      const raw = await f.async('string')
      const base = f.name.replace(/^.*\//, '').replace(/\.json$/, '')
      const project = parseProjectJson(raw, base)
      if (project) {
        saveProject(project)
        count++
      }
    }
    if (indexParsed?.version === 1 && Array.isArray(indexParsed.projects) && count > 0) {
      saveProjectIndex({
        version: 1,
        projects: indexParsed.projects.map((row) => normalizeProjectMeta(row as ProjectMeta)),
      })
    }
    return { ok: true, imported: count, mode: 'library' }
  }

  return { ok: false, error: 'Archive has no project.json or library index' }
}
