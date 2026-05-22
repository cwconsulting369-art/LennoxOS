import aevumPreset from '@aevum/design-tokens/tailwind-preset';

export default {
  presets: [aevumPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@aevum/ui-kit/src/**/*.{ts,tsx}',
  ],
};
