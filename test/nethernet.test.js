/* eslint-env mocha */
const assert = require('assert')
const crypto = require('crypto')
const { createNethernetPing, parseNethernetPong } = require('../src/nethernet')

// Captured from an offline vanilla BDS 1.26.51.1 LAN advertisement.
const advertisement = '071044656469636174656420536572766572a22207312e32362e35310d426564726f636b206c6576656c00140000000001103766653466343861656438336232623508'
const key = crypto.createHash('sha256').update(Buffer.from('efbeadde00000000', 'hex')).digest()
function seal (packet) {
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null)
  return Buffer.concat([crypto.createHmac('sha256', key).update(packet).digest(), cipher.update(packet), cipher.final()])
}
function response (data = advertisement) {
  const packet = Buffer.alloc(24 + data.length)
  packet.writeUInt16LE(packet.length - 2)
  packet.writeUInt16LE(1, 2)
  packet.writeBigUInt64LE(18446744073709551615n, 4)
  packet.writeUInt32LE(data.length, 20)
  packet.write(data, 24)
  return packet
}

describe('Nethernet discovery', () => {
  it('sends a discovery request with a valid checksum and random network ID', () => {
    const ping = createNethernetPing()
    const decipher = crypto.createDecipheriv('aes-256-ecb', key, null)
    const packet = Buffer.concat([decipher.update(ping.subarray(32)), decipher.final()])
    assert.strictEqual(packet.length, 20)
    assert.strictEqual(packet.readUInt16LE(0), 18)
    assert.strictEqual(packet.readUInt16LE(2), 0)
    assert(ping.subarray(0, 32).equals(crypto.createHmac('sha256', key).update(packet).digest()))
    assert(!ping.equals(createNethernetPing()))
  })

  it('decodes real v7 metadata without a Minecraft version database', () => {
    assert.deepStrictEqual(parseNethernetPong(seal(response())), {
      transport: 'nethernet',
      rawPong: advertisement,
      advertisementVersion: 7,
      motd: 'Dedicated Server',
      protocolVersion: 2193,
      versionName: '1.26.51',
      playerCount: 0,
      maxPlayerCount: 10,
      serverUniqueId: '18446744073709551615',
      motd2: 'Bedrock level',
      gameModeNumeric: 0
    })
  })

  it('accepts the BDS length prefix that includes itself', () => {
    const packet = response()
    packet.writeUInt16LE(packet.length)
    assert.strictEqual(parseNethernetPong(seal(packet)).versionName, '1.26.51')
  })

  it('does not invent version metadata missing from v4 advertisements', () => {
    const pong = parseNethernetPong(seal(response('0401410142000000000008000000')))
    assert.strictEqual(pong.motd, 'A')
    assert.strictEqual(pong.motd2, 'B')
    assert.strictEqual(pong.versionName, undefined)
    assert.strictEqual(pong.protocolVersion, undefined)
  })

  it('rejects corrupted, unrelated and truncated datagrams', () => {
    const corrupt = seal(response())
    corrupt[0] ^= 1
    assert.throws(() => parseNethernetPong(corrupt), /checksum/)
    assert.throws(() => parseNethernetPong(createNethernetPing()), /discovery response/)
    assert.throws(() => parseNethernetPong(Buffer.alloc(3)))
    const truncated = response()
    truncated.writeUInt32LE(9999, 20)
    assert.throws(() => parseNethernetPong(seal(truncated)), /Incomplete/)
    assert.throws(() => parseNethernetPong(seal(response('not hex'))), /encoding/)
  })
})
