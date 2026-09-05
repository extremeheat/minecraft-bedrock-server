# minecraft-bedrock-server
[![NPM version](https://img.shields.io/npm/v/minecraft-bedrock-server.svg)](http://npmjs.com/package/minecraft-bedrock-server)
[![Build Status](https://github.com/extremeheat/minecraft-bedrock-server/workflows/CI/badge.svg)](https://github.com/extremeheat/minecraft-bedrock-server/actions?query=workflow%3A%22CI%22)
[![Discord](https://img.shields.io/badge/chat-on%20discord-brightgreen.svg)](https://discord.gg/GsEFRM8)
[![Try it on gitpod](https://img.shields.io/badge/try-on%20gitpod-brightgreen.svg)](https://gitpod.io/#https://github.com/extremeheat/minecraft-bedrock-server)


Command line program (CLI) and API for starting and working with Minecraft Bedrock Edition servers.

## Running & Installation

Start a server through the command line:

`npx minecraft-bedrock-server -v 1.18.0`

Or with npm to use programmatically:

`npm install minecraft-bedrock-server`

## Usage

### via command line

`npx minecraft-bedrock-server --help`

`npx minecraft-bedrock-server --version 1.18.0 --online --path ./my1.18server`

To query a version's Bedrock protocol metadata, start a temporary server and print
its RakNet PONG response as JSON:

```sh
npx minecraft-bedrock-server -v 1.19.1 --dump-pong-details
```

This includes the raw PONG payload and any fields available from the response,
including `protocolVersion`, `versionName`, MOTDs, player counts, game mode,
and IPv4/IPv6 ports. Incomplete or non-standard PONG responses are returned
with the fields that could be extracted.

any extraneous -- options will be placed inside the `server.properties` file, e.g. `--level-name coolWorld`.

### via code

see index.d.ts

```js
const bedrockServer = require('minecraft-bedrock-server')

const onStart = () => console.log('Server started!')

bedrockServer.startServer('1.18.0', onStart, { 'server-port': 19132, 'online-mode': true, path: './bds' })
```

#### Get latest server data
From minecraft.net downloads
```js
bedrockServer.getLatestVersions().then(console.log)
```
to get
```coffee
Versions {
  linux: {
    version4: '1.20.72.01',
    version3: '1.20.72',
    url: 'https://minecraft.azureedge.net/bin-linux/bedrock-server-1.20.72.01.zip'
  },
  windows: {
    version4: '1.20.72.01',
    version3: '1.20.72',
    url: 'https://minecraft.azureedge.net/bin-win/bedrock-server-1.20.72.01.zip'
  },
  macos: null,
  preview: {
    ...
    macos: null
  }
}
```


#### Get PONG details

A helper CLI and API is avaliable to get server pong details.

**via CLI**

```
npx minecraft-bedrock-server -v 1.19.1 --dump-pong-details
```

**via code**

The underlying API `getPongDetails` downloads and starts the requested server version, sends a
RakNet unconnected ping, and stops the server after receiving its response:

```js
const details = await bedrockServer.getPongDetails('1.19.1', {
  path: './bds-1.19.1',
  'server-port': 19132,
  'server-portv6': 19133
})
```

The above log or return data in this structure:

```js
{
  rawPong: 'MCPE;Dedicated Server;527;1.19.1;0;10;...',
  edition: 'MCPE',
  motd: 'Dedicated Server',
  protocolVersion: 527,
  versionName: '1.19.1',
  playerCount: 0,
  maxPlayerCount: 10,
  serverUniqueId: '...',
  motd2: 'Bedrock level',
  gameMode: 'Survival',
  gameModeNumeric: 1,
  portIPv4: 19132,
  portIPv6: 19133
}
```

For malformed or incomplete responses, `rawPong` and any successfully parsed
fields are still returned; unavailable fields may be `undefined`.

### Help screen

```
minecraft-bedrock-server - v1.2.0
Minecraft Bedrock Server runner
Options:
  --version, -v Version to download (use "latest" for latest)  
  --port        Port to listen on for IPv4  (default: 19132)
  --port6       Port to listen on for IPv6  (default: 19133)
  --online      Whether to run in online mode  
  --path        Custom path to the server directory  
  --dump-pong-details  Start a server and print its RakNet PONG details as JSON
  --versions    Passing --versions will list all versions  
  --download    Download (but not run) the server binary for this platfrom (default: linux)  
Usage:
  minecraft-bedrock-server --version latest      Start a server on the latest version
  minecraft-bedrock-server --versions            List all avaliable versions
  minecraft-bedrock-server -v 1.20.0 --download  Download (but not run) v1.20
```

## API

See the exported [TypeScript defs for method docs](src/index.d.ts).

## Testing
`npm test`

## History

See [history](HISTORY.md)
