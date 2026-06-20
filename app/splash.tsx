import { supabase } from '@/lib/supabase';
import { PlayfairDisplay_500Medium, useFonts } from '@expo-google-fonts/playfair-display';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const FOODS = [
  require('../assets/images/splash-food-1.png'),
  require('../assets/images/splash-food-2.png'),
];

const STARS = [
  { top: 0.05, left: 0.08, size: 3, delay: 0, duration: 800 },
  { top: 0.03, left: 0.32, size: 2, delay: 200, duration: 600 },
  { top: 0.08, left: 0.61, size: 4, delay: 500, duration: 900 },
  { top: 0.12, left: 0.82, size: 2, delay: 100, duration: 700 },
  { top: 0.17, left: 0.07, size: 3, delay: 400, duration: 500 },
  { top: 0.21, left: 0.77, size: 2, delay: 300, duration: 800 },
  { top: 0.27, left: 0.44, size: 3, delay: 700, duration: 600 },
  { top: 0.74, left: 0.11, size: 2, delay: 250, duration: 700 },
  { top: 0.81, left: 0.54, size: 4, delay: 150, duration: 500 },
  { top: 0.87, left: 0.77, size: 2, delay: 600, duration: 900 },
  { top: 0.91, left: 0.27, size: 3, delay: 350, duration: 600 },
  { top: 0.15, left: 0.50, size: 2, delay: 450, duration: 800 },
  { top: 0.60, left: 0.90, size: 3, delay: 550, duration: 500 },
  { top: 0.45, left: 0.05, size: 2, delay: 650, duration: 700 },
];

function Star({ top, left, size, delay, duration }: {
  top: number; left: number; size: number; delay: number; duration: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.3, duration, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: duration * 0.7, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.8, duration: duration * 0.7, useNativeDriver: true }),
        ]),
        Animated.delay(300),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const starSize = size * 2;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: top * H,
        left: left * W,
        width: starSize,
        height: starSize,
        opacity,
        transform: [{ scale }],
      }}
    >
      <View style={{ width: starSize, height: 1.5, backgroundColor: '#F2E9D8', position: 'absolute', top: starSize / 2, left: 0 }} />
      <View style={{ width: 1.5, height: starSize, backgroundColor: '#F2E9D8', position: 'absolute', top: 0, left: starSize / 2 }} />
      <View style={{ width: starSize * 0.7, height: 1.5, backgroundColor: '#F2E9D8', position: 'absolute', top: starSize / 2, left: starSize * 0.15, transform: [{ rotate: '45deg' }] }} />
      <View style={{ width: starSize * 0.7, height: 1.5, backgroundColor: '#F2E9D8', position: 'absolute', top: starSize / 2, left: starSize * 0.15, transform: [{ rotate: '-45deg' }] }} />
    </Animated.View>
  );
}

export default function SplashScreen() {
  const [fontsLoaded] = useFonts({ PlayfairDisplay_500Medium });
  const [foodIndex, setFoodIndex] = useState(0);
  const foodOpacity = useRef(new Animated.Value(1)).current;
  const hasNavigated = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(foodOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(foodOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setFoodIndex((prev) => (prev + 1) % FOODS.length), 300);
    }, 1200);

    let destination = '/login';

    const minTimer = new Promise<void>((resolve) => setTimeout(resolve, 2000));

    const sessionCheck = new Promise<void>((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        subscription.unsubscribe();
        destination = session ? '/(tabs)' : '/login';
        resolve();
      });
    });

    Promise.all([minTimer, sessionCheck]).then(() => {
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        router.replace(destination as any);
      }
    });

    const fallback = setTimeout(() => {
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        router.replace('/login');
      }
    }, 3500);

    return () => {
      clearInterval(interval);
      clearTimeout(fallback);
    };
  }, []);

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {STARS.map((s, i) => <Star key={i} {...s} />)}
      <Animated.View style={{ opacity: foodOpacity }}>
        <Image
          source={FOODS[foodIndex]}
          style={styles.food}
          contentFit="contain"
        />
      </Animated.View>
      <Text style={styles.title}>Tonight</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1A38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  food: {
    width: 220,
    height: 220,
  },
  title: {
    marginTop: 16,
    color: '#F2E9D8',
    fontSize: 42,
    fontFamily: 'PlayfairDisplay_500Medium',
    letterSpacing: 2,
  },
});