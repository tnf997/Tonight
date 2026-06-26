import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];

useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === null) return;
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });
    return () => unsubscribe();
  }, []);

 useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? 0 : -100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#A32D2D',
    paddingTop: 50,
    paddingBottom: 10,
    alignItems: 'center',
    zIndex: 999,
  },
  text: {
    color: '#FFFEFA',
    fontSize: 13,
    fontWeight: '500',
  },
});