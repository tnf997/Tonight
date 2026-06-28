import Feather from '@expo/vector-icons/Feather';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
            bottom: insets.bottom + 12,
            left: 20,
            right: 86,
            height: 56,
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
            tabBarIcon: ({ color }) => <Feather name="moon" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="recipes"
          options={{
            tabBarIcon: ({ color }) => <Feather name="book-open" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="pantry"
          options={{
            tabBarIcon: ({ color }) => <Feather name="shopping-bag" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            tabBarIcon: ({ color }) => <Feather name="globe" size={22} color={color} />,
          }}
        />
      </Tabs>

      <Pressable
        style={[styles.addBtn, { bottom: insets.bottom + 12 }]}
        onPress={() => router.push('/modal' as any)}
      >
        <Feather name="plus" size={22} color="#FFFEFA" />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
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