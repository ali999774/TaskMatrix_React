import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.milestonepediatrics.taskmatrix',
  appName: 'TaskMatrix',
  webDir: 'dist',
  ios: {
    scheme: 'taskmatrix',
    path: 'ios',
    keyboardResize: 'none',
  },
};

export default config;
