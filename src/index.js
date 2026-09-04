const http = require('https')
const fs = require('fs')
const cp = require('child_process')
const dgram = require('dgram')
const crypto = require('crypto')
const { join, resolve } = require('path')
const debug = process.env.CI ? console.debug : require('debug')('minecraft-bedrock-server')
const https = require('https')
const helpers = require('./helper')

const serversJsonURL = 'https://net-secondary.web.minecraft-services.net/api/v1.0/download/links'

function head (url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'HEAD', timeout: 1000 }, resolve)
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); debug('HEAD request timeout'); reject(new Error('timeout')) })
    req.end()
  })
}

function get (url, outPath) {
  const file = fs.createWriteStream(outPath)
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 1000 * 20 }, response => {
      if (response.statusCode !== 200) return reject(new Error('Server returned code ' + response.statusCode))
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    })
  })
}

async function getLatestVersions () {
  const json = await fetch(serversJsonURL).then(res => res.json())
  const links = json.result.links

  function forOS (os) {
    const entry = links.find(link => link.downloadType === os)
    if (!entry) return null
    const url = entry.downloadUrl
    const version4 = url.match(/bedrock-server-(\d+\.\d+\.\d+\.\d+)\.zip/)[1]
    const version3 = version4.split('.').slice(0, 3).join('.')
    return { version4, version3, url }
  }

  return {
    linux: forOS('serverBedrockLinux'),
    windows: forOS('serverBedrockWindows'),
    macos: forOS('serverBedrockMacOS'),
    preview: {
      linux: forOS('serverBedrockPreviewLinux'),
      windows: forOS('serverBedrockPreviewWindows'),
      macos: forOS('serverBedrockPreviewMacOS')
    }
  }
}

const activeDownloads = new Map()

// Download + extract vanilla server into the server directory, without touching the process cwd
function download (os, version, root, path) {
  const vp = version.split('.')
  if (vp.length < 3) {
    if (version.startsWith('1')) {
      throw new Error('minecraft-bedrock-server: A version string should contain at least 3 dots on Minecraft Bedrock Edition. Please add a .0 suffix: ' + version)
    } else if (vp.length === 2) {
      version = '1.' + version
    }
  }
  const verStr = version.split('.').slice(0, 3).join('.')
  const dir = resolve(root, path || 'bds-' + version)

  // De-duplicate concurrent downloads into the same directory
  if (activeDownloads.has(dir)) return activeDownloads.get(dir)
  const promise = downloadInto(os, version, verStr, dir)
    .finally(() => activeDownloads.delete(dir))
  activeDownloads.set(dir, promise)
  return promise
}

async function downloadInto (os, version, verStr, dir) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 1) {
    debug('Already downloaded', version)
    return { version: verStr, path: dir }
  }
  fs.mkdirSync(dir, { recursive: true })

  const url = (os, version) => `https://www.minecraft.net/bedrockdedicatedserver/bin-${os}/bedrock-server-${version}.zip`

  let found = false

  // Find the latest server build for version (major.minor.patch.BUILD)
  const toTry = []
  for (let i = 0; i < 10; i++) toTry.push(String(i))
  for (let i = 0; i < 20; i++) toTry.push(String(i).padStart(2, '0'))

  for (const build of toTry) {
    const u = url(os, `${verStr}.${build}`)
    debug('Opening', u, Date.now())
    let ret
    try { ret = await head(u) } catch (e) { continue }
    if (ret.statusCode === 200) {
      found = u
      debug('Found server', ret.statusCode)
      break
    }
  }
  if (!found) throw Error('did not find server bin for ' + os + ' ' + version)
  console.info('🔻 Downloading', found)
  await get(found, join(dir, 'bds.zip'))
  console.info('⚡ Unzipping')
  // Unzip server
  if (process.platform === 'linux') cp.execSync('unzip -u bds.zip', { cwd: dir })
  else cp.execSync('tar -xf bds.zip', { cwd: dir })
  return { version: verStr, path: dir }
}

function eraseServer (version, options) {
  // Remove the server and try again
  const path = resolve(options.root || '.', options.path || 'bds-' + version)
  debug('Removing server', path)
  fs.rmSync(path, { recursive: true, force: true })
}

const defaultOptions = {
  'level-generator': '2',
  'server-port': '19130',
  'online-mode': 'false',
  'allow-list': 'false'
}
const internalOptions = ['path', 'root']

// Setup the server
function configure (dir, options = {}) {
  const opts = { ...defaultOptions, ...options }
  let config = fs.readFileSync(join(dir, 'server.properties'), 'utf-8')
  config = config.split('## node options')[0].trim()
  config += '\n## node options'
  config += '\nplayer-idle-timeout=1\nallow-cheats=true\ndefault-player-permission-level=operator'
  for (const o in opts) {
    if (internalOptions.includes(o)) continue
    config += `\n${o}=${opts[o]}`
  }
  fs.writeFileSync(join(dir, 'server.properties'), config)
  if (process.platform === 'linux') {
    cp.execSync('chmod +777 ./bedrock_server', { cwd: dir })
  }
}

function run (dir, inheritStdout = true) {
  const exe = process.platform === 'win32' ? 'bedrock_server.exe' : './bedrock_server'
  return cp.spawn(exe, inheritStdout ? { stdio: 'inherit', cwd: dir } : { cwd: dir })
}

async function downloadServer (version, options) {
  const platFix = {
    win32: 'win',
    windows: 'win',
    linux: 'linux',
    macos: 'darwin'
  }
  if (options.platform && !platFix[options.platform]) {
    throw new Error('Unsupported specified platform: ' + options.platform)
  }
  const platform = options.platform || process.platform
  const serverOs = platFix[platform] || 'linux'
  return download(serverOs, version, options.root || '.', options.path)
}

let lastHandle

// Run the server
async function startServer (version, onStart, options = {}) {
  const os = process.platform === 'win32' ? 'win' : process.platform
  if (os !== 'win' && os !== 'linux') {
    throw Error('unsupported os ' + os)
  }

  const ver = await download(os, version, options.root || '.', options.path)
  debug('Configuring server', ver.version)
  configure(ver.path, options)
  debug('Starting server', ver.version)
  const handle = lastHandle = run(ver.path, !onStart)
  handle.on('error', (...a) => {
    console.warn('*** THE MINECRAFT PROCESS CRASHED ***', a)
    handle.kill('SIGKILL')
  })
  if (onStart) {
    let stdout = ''
    function processLine (data) {
      stdout += data
      if (stdout.includes('Server started')) {
        onStart()
        handle.stdout.off('data', processLine)
      }
    }
    handle.stdout.on('data', processLine)
    handle.stdout.pipe(process.stdout)
    handle.stderr.pipe(process.stdout)
  }
  return handle
}

// Start the server and wait for it to be ready, with a timeout
function startServerAndWait (version, withTimeout, options) {
  if (isNaN(withTimeout)) throw Error('timeout must be a number')
  let handle
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      handle?.kill()
      reject(new Error(`Server did not start on time (${withTimeout}ms, now ${Date.now()})`))
    }, withTimeout)

    startServer(version, function onReady () {
      clearTimeout(timeout)
      resolve(handle)
    }, options).then((h) => {
      handle = h
    }).catch(reject)
  })
}

// Start the server and wait for it to be ready, with a timeout, and retry once
async function startServerAndWait2 (version, withTimeout, options) {
  try {
    return await startServerAndWait(version, withTimeout, options)
  } catch (e) {
    console.log(e)
    console.log('^ Trying once more to start server in 10 seconds...')
    lastHandle?.kill()
    await new Promise(resolve => setTimeout(resolve, 10000))
    eraseServer(version, options)
    return await startServerAndWait(version, withTimeout, options)
  }
}

const raknetMagic = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex')

function parsePongDetails (buffer) {
  const stringLength = buffer.length >= 35 ? buffer.readUInt16BE(33) : 0
  const rawPong = buffer.subarray(35, Math.min(buffer.length, 35 + stringLength)).toString()
  const [
    edition,
    motd,
    protocolVersion,
    versionName,
    playerCount,
    maxPlayerCount,
    serverUniqueId,
    motd2,
    gameMode,
    gameModeNumeric,
    portIPv4,
    portIPv6
  ] = rawPong.split(';')
  const number = value => value && Number.isFinite(Number(value)) ? Number(value) : undefined
  return {
    rawPong,
    edition,
    motd,
    protocolVersion: number(protocolVersion),
    versionName,
    playerCount: number(playerCount),
    maxPlayerCount: number(maxPlayerCount),
    serverUniqueId,
    motd2,
    gameMode,
    gameModeNumeric: number(gameModeNumeric),
    portIPv4: number(portIPv4),
    portIPv6: number(portIPv6)
  }
}

function requestPong (port, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4')
    const ping = Buffer.alloc(33)
    ping[0] = 0x01
    ping.writeBigInt64BE(BigInt(Date.now()), 1)
    raknetMagic.copy(ping, 9)
    crypto.randomBytes(8).copy(ping, 25)
    let bestPong
    const timer = setTimeout(() => {
      socket.close()
      if (bestPong) resolve(bestPong)
      else reject(new Error('Timed out waiting for RakNet PONG'))
    }, timeout)
    socket.on('message', (message) => {
      const pong = parsePongDetails(message)
      if (pong.rawPong) {
        clearTimeout(timer)
        socket.close()
        resolve(pong)
      } else {
        bestPong = pong
      }
    })
    socket.on('error', (error) => {
      clearTimeout(timer)
      socket.close()
      reject(error)
    })
    socket.send(ping, port, '127.0.0.1')
  })
}

async function getPongDetails (version, options = {}) {
  const { timeout = 1000 * 60 * 5, pingTimeout = 5000, ...serverOptions } = options
  const port = Number(options['server-port'] || 19132)
  const handle = await startServerAndWait(version, timeout, serverOptions)
  try {
    return await requestPong(port, pingTimeout)
  } finally {
    handle.kill()
  }
}

class BedrockVanillaServer {
  constructor (path, version, options) {
    this.path = path || '.'
    this.version = version
    this.options = options
    helpers.injectServerHelpers(this)
  }

  async startAndWaitReady (timeout = 1000 * 60 * 5) {
    this.activeHandle = await startServerAndWait(this.version, timeout, this.options)
    this.activeHandle.stop = () => this.stop()
    this.activeHandle.on('exit', () => { this.activeHandle = null })
    return this.activeHandle
  }

  async stop () {
    return new Promise((resolve) => {
      if (this.activeHandle) {
        this.activeHandle.on('exit', resolve)
        this.activeHandle.stdin.write('stop\n')
        setTimeout(() => {
          this.activeHandle.kill()
          this.activeHandle = null
        }, 1000)
      } else {
        resolve()
      }
    })
  }
}

async function prepare (version, options) {
  const dl = await downloadServer(version, options || {})
  return new BedrockVanillaServer(dl.path, dl.version, options || {})
}

module.exports = { getLatestVersions, downloadServer, startServer, startServerAndWait, startServerAndWait2, getPongDetails, parsePongDetails, prepare }
