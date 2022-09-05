import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import pathConfig from './paths.json' assert { type: 'json' }
import { __dirname } from './dirname-shim.js'

const destPath = path.resolve(__dirname, pathConfig.artifactsDir)

// Edge-specific manifest mods
const patchManifest = () => {
  const fileOpts = { encoding: 'utf8' }
  const manifestPath = path.join(destPath, 'Shut Up', 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, fileOpts))

  manifest.options_ui.page = 'options/index-wrapper.html'
  manifest.options_ui.open_in_tab = true

  fs.writeFileSync(manifestPath, JSON.stringify(manifest), fileOpts)
}

const build = async () => {
  patchManifest()

  const archivePath = path.join(destPath, 'Shut Up.zip')
  const output = fs.createWriteStream(archivePath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  const globBase = 'Shut Up/**/*'
  const globWd = destPath

  output.on('close', () => {
    console.log(`Wrote archive to ${archivePath}.`)
    console.log(`Compressed payload is ${archive.pointer()} bytes.`)
  })

  archive.on('error', err => {
    throw err
  })

  archive.pipe(output)
  archive.glob(globBase, { cwd: globWd })
  archive.finalize()
}

build()
