import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mtm.huntima',
  appName: 'Huntima',
  webDir: 'dist',
  // Uncomment during development to live-reload inside the native shell.
  // Use your machine's LAN IP — `localhost` resolves to the device itself.
  // server: { url: 'http://192.168.1.XX:5173', cleartext: true },
}

export default config
