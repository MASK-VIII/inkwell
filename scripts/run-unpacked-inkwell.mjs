/** Quick test: run the last desktop pack without NSIS (Windows). */
import { spawn } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const marker = join(root, '.inkwell-last-pack-dir')

let exe = join(root, 'release', 'win-unpacked', 'Inkwell.exe')
try {
  await access(exe)
} catch {
  try {
    const tmpRoot = (await readFile(marker, 'utf8')).trim()
    exe = join(tmpRoot, 'win-unpacked', 'Inkwell.exe')
    await access(exe)
  } catch {
    console.error('No unpacked Inkwell.exe under release/ or last temp pack.')
    console.error('Run npm run build:desktop first.')
    process.exit(1)
  }
}

console.log('Starting:', exe)
spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
