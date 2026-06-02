import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  // Headings
  h1: { fontFamily, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  h2: { fontFamily, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontFamily, fontSize: 18, fontWeight: '600', letterSpacing: -0.2 },
  h4: { fontFamily, fontSize: 16, fontWeight: '600', letterSpacing: 0 },

  // Body
  bodyLg: { fontFamily, fontSize: 16, fontWeight: '400', letterSpacing: 0.1 },
  body:   { fontFamily, fontSize: 14, fontWeight: '400', letterSpacing: 0.1 },
  bodySm: { fontFamily, fontSize: 13, fontWeight: '400', letterSpacing: 0.1 },

  // Labels
  label:   { fontFamily, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  labelSm: { fontFamily, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },

  // Caption
  caption: { fontFamily, fontSize: 12, fontWeight: '400', letterSpacing: 0.2 },

  // Button
  btn:   { fontFamily, fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  btnSm: { fontFamily, fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },

  // Number / Score
  score: { fontFamily, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  scoreSm: { fontFamily, fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
};
