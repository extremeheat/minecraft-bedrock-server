const http = require('https')
const fs = require('fs')
const cp = require('child_process')
const debug = process.env.CI ? console.debug : require('debug')('minecraft-bedrock-server')
const https = require('https')

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

let lock = false

// Download + extract vanilla server and enter the directory
async function download (os, version, root, path) {
  if (lock) {
    throw Error('Already downloading server')
  }
  lock = true
  process.chdir(root)
  const verStr = version.split('.').slice(0, 3).join('.')
  const dir = path || 'bds-' + version

  if (fs.existsSync(dir) && fs.readdirSync(dir).length) {
    process.chdir(dir) // Enter server folder
    debug('Already downloaded', version)
    lock = false
    return verStr
  }
  try { fs.mkdirSync(dir) } catch { }

  process.chdir(dir) // Enter server folder
  const url = (os, version) => `https://minecraft.azureedge.net/bin-${os}/bedrock-server-${version}.zip`

  let found = false

  for (let i = 0; i < 8; i++) { // Check for the latest server build for version (major.minor.patch.BUILD)
    const u = url(os, `${verStr}.${String(i).padStart(2, '0')}`)
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
  await get(found, 'bds.zip')
  console.info('⚡ Unzipping')
  // Unzip server
  if (process.platform === 'linux') cp.execSync('unzip -u bds.zip && chmod +777 ./bedrock_server')
  else cp.execSync('tar -xf bds.zip')
  lock = false
  return verStr
}

function eraseServer (version, options) {
  // Remove the server and try again
  const currentDir = process.cwd()
  process.chdir(options.root || __dirname)
  const path = options.path ? options.path : 'bds-' + version
  debug('Removing server', path)
  fs.rmSync(path, { recursive: true, force: true })
  process.chdir(currentDir)
}

const defaultOptions = {
  'level-generator': '2',
  'server-port': '19130',
  'online-mode': 'false'
}
const internalOptions = ['path', 'root']

// Setup the server
function configure (options = {}) {
  const opts = { ...defaultOptions, ...options }
  let config = fs.readFileSync('./server.properties', 'utf-8')
  config = config.split('## node options')[0].trim()
  config += '\n## node options'
  config += '\nplayer-idle-timeout=1\nallow-cheats=true\ndefault-player-permission-level=operator'
  for (const o in opts) {
    if (internalOptions.includes(o)) continue
    config += `\n${o}=${opts[o]}`
  }
  fs.writeFileSync('./server.properties', config)
}

function run (inheritStdout = true) {
  const exe = process.platform === 'win32' ? 'bedrock_server.exe' : './bedrock_server'
  return cp.spawn(exe, inheritStdout ? { stdio: 'inherit' } : {})
}

let lastHandle

// Run the server
async function startServer (version, onStart, options = {}) {
  const os = process.platform === 'win32' ? 'win' : process.platform
  if (os !== 'win' && os !== 'linux') {
    throw Error('unsupported os ' + os)
  }

  const currentDir = process.cwd()
  // Take the options.path and determine if it's an absolute path or not
  const path = options.path
  const pathRoot = options.root || __dirname

  await download(os, version, pathRoot, path) // and enter the directory
  debug('Configuring server', version)
  configure(options)
  debug('Starting server', version)
  const handle = lastHandle = run(!onStart)
  handle.on('error', (...a) => {
    console.warn('*** THE MINECRAFT PROCESS CRASHED ***', a)
    handle.kill('SIGKILL')
  })
  if (onStart) {
    let stdout = ''
    handle.stdout.on('data', data => {
      stdout += data
      if (stdout.includes('Server started')) onStart()
    })
    handle.stdout.pipe(process.stdout)
    handle.stderr.pipe(process.stdout)
  }
  process.chdir(currentDir)
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
    await eraseServer(version, options)
    return await startServerAndWait(version, withTimeout, options)
  }
}

module.exports = { startServer, startServerAndWait, startServerAndWait2 }
