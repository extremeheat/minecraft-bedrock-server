#!/usr/bin/env node
const { startServer } = require('./index')
const { version } = require('./package.json')

const opt = require('basic-args')({
  name: 'minecraft-bedrock-server',
  description: 'Minecraft Bedrock Server runner',
  version,
  options: {
    version: { type: String, description: 'Version to connect as', alias: 'v' },
    port: { type: Number, description: 'Port to listen on for IPv4', default: 19132 },
    port6: { type: Number, description: 'Port to listen on for IPv6', default: 19133 },
    online: { type: Boolean, description: 'Whether to run in online mode' },
    path: { type: String, description: 'Custom path to the server directory', default: null }
  }
})

const customOptions = opt._ || {}

startServer(opt.version, /* onStart callback */ null, { 'server-port': opt.port, 'server-portv6': opt.port6, 'online-mode': Boolean(opt.online), path: opt.path ? opt.path : undefined, ...customOptions })
