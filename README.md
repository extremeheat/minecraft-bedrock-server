# basic-args
[![NPM version](https://img.shields.io/npm/v/minecraft-bedrock-server.svg)](http://npmjs.com/package/minecraft-bedrock-server)
[![Build Status](https://github.com/extremeheat/node-basic-args/workflows/CI/badge.svg)](https://github.com/extremeheat/minecraft-bedrock-server/actions?query=workflow%3A%22CI%22)
[![Discord](https://img.shields.io/badge/chat-on%20discord-brightgreen.svg)](https://discord.gg/GsEFRM8)
[![Try it on gitpod](https://img.shields.io/badge/try-on%20gitpod-brightgreen.svg)](https://gitpod.io/#https://github.com/extremeheat/minecraft-bedrock-server)


Simple command line/software interface for starting a Minecraft bedrock server

## Running & Installation

Start a server through the command line:
`npx minecraft-bedrock-server -v 1.18.0`

Or with npm to use programmatically:1
`npm install minecraft-bedrock-server`

## Usage

### via command line
`npx minecraft-bedrock-server --help`
`npx minecraft-bedrock-server --version 1.18.0 --online --path ./my1.18server`

### via code

```js
const bedrockServer = require('minecraft-bedrock-server')

const onStart = () => console.log('Server started!')

bedrockServer.startServer('1.18.0', onStart, { 'server-port': opt.port, 'online-mode': Boolean(opt.online), path: opt.path ? opt.path : undefined })
```

### Help screen

```
minecraft-bedrock-server - v1.0.0
Minecraft Bedrock Server runner

Options:
  --version, -v Version to connect as
  --port        Port to listen on  (default: 19132)
  --online      Whether to run in online mode
  --path        Custom path to the server directory
```

## Testing

```npm test```

## History

See [history](HISTORY.md)
