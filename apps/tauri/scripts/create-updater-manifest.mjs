import fs from 'node:fs/promises'
import path from 'node:path'

const arguments_ = process.argv.slice(2)
const mergeManifests = arguments_.includes('--merge')
const bundleDirectories = arguments_.filter((argument) => argument !== '--merge')
if (bundleDirectories.length === 0 && mergeManifests) {
  throw new Error('At least one artifact directory is required when merging updater manifests.')
}
if (bundleDirectories.length === 0) {
  bundleDirectories.push('src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis')
}
const repository = process.env.GITHUB_REPOSITORY
const tag = process.env.GITHUB_REF_NAME

if (!repository || !tag) {
  throw new Error('GITHUB_REPOSITORY and GITHUB_REF_NAME are required to create latest.json.')
}

const version = tag.replace(/^v/, '')
const platforms = {}
for (const directory of bundleDirectories) {
  const bundleDirectory = path.resolve(directory)
  const artifacts = await fs.readdir(bundleDirectory, { recursive: true })
  const assetUrl = (artifact) =>
    new URL(
      `/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(path.basename(artifact))}`,
      'https://github.com'
    ).toString()
  const addPlatform = async (platform, artifact) => {
    if (platforms[platform]) throw new Error(`Duplicate updater platform: ${platform}`)
    const payload = await fs.lstat(path.join(bundleDirectory, artifact))
    if (!payload.isFile() || payload.size === 0) throw new Error(`Invalid or empty updater payload: ${artifact}`)
    const signature = (await fs.readFile(path.join(bundleDirectory, `${artifact}.sig`), 'utf8')).trim()
    if (!signature) throw new Error(`Updater signature is empty: ${artifact}.sig`)
    platforms[platform] = { signature, url: assetUrl(artifact) }
  }

  const linuxBundles = artifacts.filter((artifact) => /\.(AppImage|deb|rpm)$/.test(artifact))
  if (linuxBundles.length > 0) {
    if (linuxBundles.length !== 3) throw new Error(`Expected one AppImage, DEB and RPM in ${bundleDirectory}.`)
    const architectures = new Set()
    for (const artifact of linuxBundles) {
      const match = path.basename(artifact).match(/^FileTerm-(.+)-linux-(x86_64|arm64)\.(AppImage|deb|rpm)$/)
      if (!match || match[1] !== version) throw new Error(`Invalid Linux updater asset: ${artifact}`)
      const [, , architecture, format] = match
      architectures.add(architecture)
      const platform = `linux-${architecture === 'arm64' ? 'aarch64' : 'x86_64'}-${format.toLowerCase()}`
      await addPlatform(platform, artifact)
    }
    if (architectures.size !== 1) throw new Error(`Mixed Linux architectures in ${bundleDirectory}.`)
    continue
  }

  const archives = artifacts.filter((artifact) => artifact.endsWith('.app.tar.gz'))
  if (archives.length > 0) {
    if (archives.length !== 1) throw new Error(`Expected one macOS updater archive in ${bundleDirectory}.`)
    const archive = archives[0]
    const architecture = archive.match(/-macos-(arm64|x64)\.app\.tar\.gz$/)?.[1]
    if (!architecture) throw new Error(`Unknown macOS updater architecture: ${archive}`)
    const platform = architecture === 'arm64' ? 'darwin-aarch64' : 'darwin-x86_64'
    await addPlatform(platform, archive)
    continue
  }

  const installers = artifacts.filter((artifact) => artifact.endsWith('-setup.exe'))
  if (installers.length !== 1) {
    throw new Error(`Expected exactly one NSIS installer in ${bundleDirectory}, found ${installers.length}.`)
  }

  const installer = installers[0]
  const architecture =
    installer.includes('windows-arm64-') || bundleDirectory.includes('aarch64-pc-windows-msvc') ? 'arm64' : 'x64'
  const platform = architecture === 'arm64' ? 'windows-aarch64' : 'windows-x86_64'
  const portableExecutables = artifacts.filter((artifact) => artifact.endsWith('-portable.exe'))
  if (portableExecutables.length !== 1) {
    throw new Error(
      `Expected exactly one portable executable in ${bundleDirectory}, found ${portableExecutables.length}.`
    )
  }
  const portable = portableExecutables[0]
  await addPlatform(platform, installer)
  await addPlatform(`${platform}-portable`, portable)
}

const manifest = {
  version,
  notes: process.env.FILETERM_UPDATE_NOTES ?? `FileTerm ${version}`,
  pub_date: new Date().toISOString(),
  platforms
}

const outputPath = mergeManifests
  ? path.resolve('latest.json')
  : path.join(path.resolve(bundleDirectories[0]), 'latest.json')
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`[FileTerm] created signed updater manifest${mergeManifests ? 's' : ''}: ${outputPath}`)
