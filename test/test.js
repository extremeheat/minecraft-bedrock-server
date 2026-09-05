/* eslint-env mocha */
const cp = require('child_process')
const bedrockServer = require('minecraft-bedrock-server')
const fs = require('fs')
const assert = require('assert')
const { join } = require('path')
const versions = ['1.16.210', '1.18.0', '1.21.80']

for (const version of versions) {
  describe(`${version}`, function () {
    this.timeout(90000)
    it('should start a minecraft server', async () => {
      const path = join(__dirname, '/bds-' + version)
      try { fs.rmSync(path, { recursive: true }) } catch (e) {}
      const [v4, v6] = [19132 + ((Math.random() * 1000) | 0), 19133 + ((Math.random() * 1000) | 0)]
      const handle = await bedrockServer.startServerAndWait(version, 80000, { path, 'server-port': v4, 'server-portv6': v6 })
      const ok = fs.existsSync(path)
      assert(ok, 'server did not start')
      handle.kill()
    })
  })
}

describe('helpers work', function () {
  this.timeout(90000)
  it('works on 1.18.0', async function () {
    const server = await bedrockServer.prepare('1.18.0')
    const handle = await server.startAndWaitReady(60000)
    await server.clearBehaviorPacks()
    await server.toggleExperiments({
      gametest: true
    })
    handle.kill()
  })
})

describe('auxiliary methods', function () {
  it('parses RakNet PONG details', function () {
    const details = 'MCPE;Dedicated Server;527;1.19.1;0;10;13253860892328930865;Bedrock level;Survival;1;19132;19133;'
    const packet = Buffer.alloc(35 + Buffer.byteLength(details))
    packet[0] = 0x1c
    packet.writeUInt16BE(Buffer.byteLength(details), 33)
    packet.write(details, 35)
    assert.deepStrictEqual(bedrockServer.parsePongDetails(packet), {
      rawPong: details,
      edition: 'MCPE',
      motd: 'Dedicated Server',
      protocolVersion: 527,
      versionName: '1.19.1',
      playerCount: 0,
      maxPlayerCount: 10,
      serverUniqueId: '13253860892328930865',
      motd2: 'Bedrock level',
      gameMode: 'Survival',
      gameModeNumeric: 1,
      portIPv4: 19132,
      portIPv6: 19133
    })
  })

  it('keeps available fields from a malformed PONG', function () {
    const details = 'MCPE;Partial Server;594'
    const packet = Buffer.alloc(35 + Buffer.byteLength(details))
    packet[0] = 0x1c
    packet.writeUInt16BE(1000, 33)
    packet.write(details, 35)
    const parsed = bedrockServer.parsePongDetails(packet)
    assert.strictEqual(parsed.rawPong, details)
    assert.strictEqual(parsed.edition, 'MCPE')
    assert.strictEqual(parsed.motd, 'Partial Server')
    assert.strictEqual(parsed.protocolVersion, 594)
    assert.strictEqual(parsed.versionName, undefined)
    assert.strictEqual(parsed.playerCount, undefined)
  })

  it('extracts PONG details from a real server', async function () {
    this.timeout(90000)
    const path = join(__dirname, 'bds-1.21.80')
    const executable = process.platform === 'win32' ? 'bedrock_server.exe' : 'bedrock_server'
    if (!fs.existsSync(join(path, executable))) this.skip()
    const port = 19132 + ((Math.random() * 1000) | 0)
    const details = await bedrockServer.getPongDetails('1.21.80', {
      path,
      'server-port': port,
      'server-portv6': port + 1
    })
    assert(details.rawPong)
    assert(details.protocolVersion > 0)
    assert.strictEqual(details.portIPv4, port)
  })

  it('getLatestVersions works', async function () {
    const versions = await bedrockServer.getLatestVersions()
    console.log('Versions', versions)
    assert(versions.linux.version3, 'Linux version exists')
    assert(versions.linux.url, 'Linux URL exists')
    assert(versions.windows.version3, 'Windows version exists')
    assert(versions.windows.url, 'Windows URL exists')
    assert(versions.preview.linux.version3, 'Preview Linux version exists')
    assert(versions.preview.linux.url, 'Preview Linux URL exists')
    assert(versions.preview.windows.version3, 'Preview Windows version exists')
    assert(versions.preview.windows.url, 'Preview Windows URL exists')
  })
})

describe('cli', function () {
  it('works', function () {
    const helpStr = cp.execSync('npx minecraft-bedrock-server --help').toString()
    assert(helpStr)
  })
})

// For libssl1.0 missing see:
// https://stackoverflow.com/a/73603200/11173996
