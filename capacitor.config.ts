import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.fishfinderpro.app',
  appName: 'SeamCast',
  webDir: 'public',
  server: {
    url: 'https://www.seamcast.online',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
