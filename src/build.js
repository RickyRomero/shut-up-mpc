import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { __dirname } from './dirname-shim.js'
import pathConfig from './paths.json'

const destPath = path.resolve(__dirname, pathConfig.artifactsDir)

const build = async () => {
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
