#!/usr/bin/env node
const { startServer } = require('./index')
const { version } = require('./package.json')

const opt = require('basic-args')({
  name: 'minecraft-bedrock-server',
  description: 'Minecraft Bedrock Server runner',
  version,
  options: {
    version: { type: String, description: 'Version to connect as', alias: 'v' },
    port: { type: Number, description: 'Port to listen on', default: 19132 },
    online: { type: Boolean, description: 'Whether to run in online mode' },
    path: { type: String, description: 'Custom path to the server directory', default: null }
  }
})

startServer(opt.version, /* onStart callback */ null, { 'server-port': opt.port, 'online-mode': Boolean(opt.online), path: opt.path ? opt.path : undefined })
