import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.fishfinderpro.app',
  appName: 'Fishfinder Pro',
  webDir: 'public',
  server: {
    url: 'https://www.fishfinder-pro.online',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
