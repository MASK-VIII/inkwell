/**
 * Approximate local library footprint for Account UI (not authoritative for quota;
 * cloud quota uses compressed zip size from exportLibraryZip).
 */

import { loadProject, loadProjectIndex } from './manuscripts'

/** Serialized JSON uses quoted data URLs for embedded images / covers. */
const QUOTED_DATA_IMAGE_RE = /"data:image\/[^"]+"/g

function countDataImageSubstringBytes(json: string): number {
  let total = 0
  let m: RegExpExecArray | null
  QUOTED_DATA_IMAGE_RE.lastIndex = 0
  while ((m = QUOTED_DATA_IMAGE_RE.exec(json)) !== null) {
    total += Math.max(0, m[0].length - 2)
  }
  return total
}

export type LibraryFootprintEstimate = {
  /** Sum of serialized project JSON lengths (uncompressed). */
  totalProjectJsonBytes: number
  /** Rough sum of data:image/* substring lengths across projects. */
  estimatedImageBytes: number
  /** Remainder attributed to text/metadata (approximate). */
  estimatedManuscriptMetadataBytes: number
}

/**
 * Walk all projects in the local index and estimate image vs rest from JSON shape.
 */
export function estimateLibraryFootprint(): LibraryFootprintEstimate {
  const idx = loadProjectIndex()
  let totalProjectJsonBytes = 0
  let estimatedImageBytes = 0

  for (const meta of idx.projects) {
    const p = loadProject(meta.id)
    if (!p) continue
    const json = JSON.stringify(p)
    totalProjectJsonBytes += json.length
    estimatedImageBytes += countDataImageSubstringBytes(json)
  }

  const estimatedManuscriptMetadataBytes = Math.max(0, totalProjectJsonBytes - estimatedImageBytes)

  return {
    totalProjectJsonBytes,
    estimatedImageBytes,
    estimatedManuscriptMetadataBytes,
  }
}
