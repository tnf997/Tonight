import Feather from '@expo/vector-icons/Feather';
import { Tabs, useRouter } from 'expo-router';
import { Dimensions, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PILL_WIDTH = Math.round(SCREEN_WIDTH / 3);

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pillLeft = Math.round((SCREEN_WIDTH - PILL_WIDTH) / 2) - 36;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: '#3A3570',
          tabBarInactiveTintColor: '#9C9180',
          tabBarStyle: {
            position: 'absolute',
            bottom: insets.bottom + 16,
            left: pillLeft,
            width: PILL_WIDTH,
            height: 112,
            borderRadius: 999,
            backgroundColor: '#FFFEFA',
            borderWidth: 1.5,
            borderColor: '#3A3570',
            elevation: 8,
            shadowColor: '#3A3570',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            paddingBottom: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color }) => <Feather name="moon" size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="recipes"
          options={{
            tabBarIcon: ({ color }) => <Feather name="book-open" size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="pantry"
          options={{
            tabBarIcon: ({ color }) => <Feather name="shopping-bag" size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            tabBarIcon: ({ color }) => <Feather name="globe" size={26} color={color} />,
          }}
        />
      </Tabs>

      <Pressable
        style={[styles.addBtn, { bottom: insets.bottom + 16, left: pillLeft + PILL_WIDTH + 12 }]}
        onPress={() => router.push('/modal' as any)}
      >
        <Feather name="plus" size={26} color="#FFFEFA" />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3A3570',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A3570',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});