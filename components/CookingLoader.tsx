import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

function FallingVeggie({
  color,
  shape,
  left,
  delay,
  duration,
}: {
  color: string;
  shape: 'circle' | 'oval';
  left: number;
  delay: number;
  duration: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(duration * 2 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-46, 26] });
  const opacity = anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      style={[
        shape === 'circle' ? styles.circle : styles.oval,
        { borderColor: color, left, transform: [{ translateY }], opacity },
      ]}
    />
  );
}

export default function CookingLoader() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.dropZone}>
        <FallingVeggie color="#D85A30" shape="carrot" left={10} delay={0} duration={950} />
        <FallingVeggie color="#EF9F27" shape="lemon" left={38} delay={300} duration={950} />
        <FallingVeggie color="#639922" shape="bay leaf" left={66} delay={600} duration={950} />
      </View>
      <View style={styles.pot}>
        <View style={[styles.handle, { left: -8 }]} />
        <View style={[styles.handle, { right: -8 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', height: 110 },
  dropZone: { width: 90, height: 60 },
  circle: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  oval: { position: 'absolute', width: 12, height: 20, borderRadius: 8, borderWidth: 2 },
  pot: {
    width: 90,
    height: 36,
    borderWidth: 2.5,
    borderColor: '#6B6049',
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  handle: {
    position: 'absolute',
    top: -4,
    width: 10,
    height: 14,
    borderWidth: 2,
    borderColor: '#6B6049',
    borderRadius: 4,
  },
});