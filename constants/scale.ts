import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const isIPad = Platform.OS === 'ios' && SCREEN_WIDTH >= 768;

const FONT_SCALE = isIPad ? 1.35 : 1;
const SPACING_SCALE = isIPad ? 1.3 : 1;

export function scaleFont(size: number) {
  return size * FONT_SCALE;
}

export function scaleSpacing(size: number) {
  return size * SPACING_SCALE;
}