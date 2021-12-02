/* eslint-env mocha */
const bedrockServer = require('minecraft-bedrock-server')
const fs = require('fs')
const assert = require('assert')
const { join } = require('path')
const versions = ['1.16.210', '1.18.0']

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
