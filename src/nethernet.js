const crypto = require('crypto')
const { ProtoDef } = require('protodef')

// Nethernet LAN discovery framing, as used by PrismarineJS/node-nethernet.
// Only discovery is needed here; no signalling or WebRTC connection is opened.
const appId = Buffer.alloc(8)
appId.writeUInt32LE(0xdeadbeef)
const key = crypto.createHash('sha256').update(appId).digest()
const proto = new ProtoDef(false)
// Advertisement schemas shared with PrismarineJS/bedrock-protocol.
proto.addTypes(require('./advertisement.json'))

function checksum (buffer) {
  return crypto.createHmac('sha256', key).update(buffer).digest()
}

function createNethernetPing () {
  const packet = Buffer.alloc(20)
  packet.writeUInt16LE(18) // payload length, followed by type 0 (discovery request)
  crypto.randomBytes(8).copy(packet, 4) // sender network ID
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null)
  return Buffer.concat([checksum(packet), cipher.update(packet), cipher.final()])
}

function parseNethernetPong (buffer) {
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, null)
  const packet = Buffer.concat([decipher.update(buffer.subarray(32)), decipher.final()])
  if (!crypto.timingSafeEqual(buffer.subarray(0, 32), checksum(packet))) throw new Error('Invalid discovery checksum')
  // BDS includes the two-byte length prefix in its count; other senders exclude it.
  // Read the checksum-verified datagram and the advertisement's own length instead.
  if (packet.length < 24 || packet.readUInt16LE(2) !== 1) {
    throw new Error('Not a Nethernet discovery response')
  }
  const length = packet.readUInt32LE(20)
  if (length !== packet.length - 24) throw new Error('Incomplete discovery response')
  const rawPong = packet.subarray(24).toString()
  if (!rawPong || !/^(?:[0-9a-f]{2})+$/i.test(rawPong)) throw new Error('Invalid advertisement encoding')
  const advertisement = Buffer.from(rawPong, 'hex')
  const advertisementVersion = advertisement[0]
  const { value } = proto.read(advertisement, 0, `advertisement_v${advertisementVersion}`)
  return {
    transport: 'nethernet',
    rawPong,
    advertisementVersion,
    motd: value.motd,
    protocolVersion: value.protocol,
    versionName: value.gameVersion,
    playerCount: value.playerCount,
    maxPlayerCount: value.playersMax,
    serverUniqueId: packet.readBigUInt64LE(4).toString(),
    motd2: value.levelName,
    gameModeNumeric: value.gamemodeId
  }
}

module.exports = { createNethernetPing, parseNethernetPong }
