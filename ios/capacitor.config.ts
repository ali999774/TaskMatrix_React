import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.milestonepediatrics.taskmatrix',
  appName: 'TaskMatrix',
  webDir: '../dist',
  server: {
    hostname: 'localhost',
  },
  ios: {
    scheme: 'taskmatrix',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;
