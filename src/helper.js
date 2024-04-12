const fs = require('fs')
const nbt = require('prismarine-nbt')
const { join } = require('path')

function addResourcePack (serverPath, packPath, packName) {
  const serverPackPath = join(serverPath, packPath.includes('.') ? 'development_resource_packs' : 'resource_packs')
  packName = packName || packPath.split('/').pop().split('.').shift()
  fs.copyFileSync(packPath, join(serverPackPath, packName))
}

function addBehaviorPack (serverPath, packPath, packName) {
  const serverPackPath = join(serverPath, packPath.includes('.') ? 'development_behavior_packs' : 'behavior_packs')
  packName = packName || packPath.split('/').pop().split('.').shift()
  fs.copyFileSync(packPath, join(serverPackPath, packName))
}

function addQuickScript (serverPath, { name, manifest, scripts }, eraseExisting = true, enable = true) {
  const serverPacksPath = join(serverPath, 'development_behavior_packs')
  name = name || manifest.header.name
  const packPath = join(serverPacksPath, name)
  if (eraseExisting) {
    fs.rmdirSync(packPath, { recursive: true })
  }
  // make a directory for this pack
  fs.mkdirSync(join(serverPacksPath, name), { recursive: true })
  // write the manifest
  fs.writeFileSync(join(packPath, 'manifest.json'), JSON.stringify(manifest, null, 2))
  // write each of the scripts (a Record<relative path string, current path string>)
  for (const [relativePath, currentPath] of Object.entries(scripts)) {
    fs.copyFileSync(currentPath, join(packPath, relativePath))
  }
  // enable the pack
  if (enable) {
    enableBehaviorPack(serverPath, manifest.header.uuid, manifest.header.version)
  }
}

function clearBehaviorPacks (serverPath, erase = true) {
  if (erase) {
    const serverPacksPath1 = join(serverPath, 'development_behavior_packs')
    fs.rmdirSync(serverPacksPath1, { recursive: true })
    const serverPacksPath2 = join(serverPath, 'behavior_packs')
    fs.rmdirSync(serverPacksPath2, { recursive: true })
  }
  // remove each world's world_behavior_packs.json
  const worlds = fs.readdirSync(join(serverPath, 'worlds'))
  for (const world of worlds) {
    const worldPath = join(serverPath, 'worlds', world)
    const worldBehaviorPacksPath = join(worldPath, 'world_behavior_packs.json')
    if (fs.existsSync(worldBehaviorPacksPath)) {
      fs.unlinkSync(worldBehaviorPacksPath)
    }
  }
}

function disableBehaviorPack (serverPath, uuid) {
  const worlds = fs.readdirSync(join(serverPath, 'worlds'))
  for (const world of worlds) {
    const worldPath = join(serverPath, 'worlds', world)
    const worldBehaviorPacksPath = join(worldPath, 'world_behavior_packs.json')
    if (fs.existsSync(worldBehaviorPacksPath)) {
      const now = JSON.parse(fs.readFileSync(worldBehaviorPacksPath))
      const index = now.findIndex(pack => pack.pack_id === uuid)
      if (index !== -1) {
        now.splice(index, 1)
        fs.writeFileSync(worldBehaviorPacksPath, JSON.stringify(now, null, 2))
      }
    }
  }
}

function enableBehaviorPack (serverPath, uuid, version) {
  const worlds = fs.readdirSync(join(serverPath, 'worlds'))
  for (const world of worlds) {
    const worldPath = join(serverPath, 'worlds', world)
    const worldBehaviorPacksPath = join(worldPath, 'world_behavior_packs.json')
    if (fs.existsSync(worldBehaviorPacksPath)) {
      const now = JSON.parse(fs.readFileSync(worldBehaviorPacksPath))
      now.push({ pack_id: uuid, version })
      fs.writeFileSync(worldBehaviorPacksPath, JSON.stringify(now, null, 2))
    } else {
      fs.writeFileSync(worldBehaviorPacksPath, JSON.stringify([{ pack_id: uuid, version }], null, 2))
    }
  }
}

function toggleExperiments (serverPath, list, worldName) {
  if (!worldName) {
    const worlds = fs.readdirSync(join(serverPath, 'worlds'))
    for (const world of worlds) {
      toggleExperiments(serverPath, list, world)
    }
    return
  }
  const worldPath = join(serverPath, 'worlds', worldName)
  const levelDatPath = join(worldPath, 'level.dat')
  const oldLevelBuf = fs.readFileSync(levelDatPath)
  const levelDat = nbt.parseUncompressed(oldLevelBuf.slice(8), 'little')
  const experiments = levelDat.value.value.Experiments.value
  experiments.experiments_ever_used = nbt.byte(1)
  experiments.saved_with_toggled_experiments = nbt.byte(1)
  for (const [key, value] of Object.entries(list)) {
    experiments[key] = nbt.byte(value ? 1 : 0)
  }
  const tagBody = nbt.writeUncompressed(levelDat, 'little')
  const tagHead = oldLevelBuf.slice(0, 8)
  tagHead.writeUInt32LE(tagBody.length, 4)
  fs.writeFileSync(levelDatPath, Buffer.concat([tagHead, tagBody]))
}

function injectServerHelpers (server) {
  server.addResourcePack = addResourcePack.bind(null, server.path)
  server.addBehaviorPack = addBehaviorPack.bind(null, server.path)
  server.addQuickScript = addQuickScript.bind(null, server.path)
  server.clearBehaviorPacks = clearBehaviorPacks.bind(null, server.path)
  server.disableBehaviorPack = disableBehaviorPack.bind(null, server.path)
  server.enableBehaviorPack = enableBehaviorPack.bind(null, server.path)
  server.toggleExperiments = toggleExperiments.bind(null, server.path)
}

module.exports = {
  injectServerHelpers
}
