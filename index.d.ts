declare module "minecraft-bedrock-server" {
  // Return the name of the latest available Minecraft Bedrock server version.
  function fetchLatestStable()

  // Starts the server
  // Options is an array of server.properties options.
  // `options.path` is the path to where the server will be started.
  function startServer(version, onStart, options): Promise<ChildProcess>

  // Starts the server and waits
  function startServerAndWait(version, withTimeout, options): Promise<ChildProcess>
}
