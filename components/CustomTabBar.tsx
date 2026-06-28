import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const icons: Record<string, any> = {
  pantry: 'list',
  index: 'home',
  feed: 'users',
  recipes: 'book',
};

export default function CustomTabBar({ state, navigation }: any) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  function goTo(path: string) {
    setMenuOpen(false);
    router.push(path as any);
  }

  return (
    <>
      <View style={styles.wrapper} pointerEvents="box-none">
        <View style={styles.pill}>
          {state.routes.map((route: any, index: number) => {
            const isFocused = state.index === index;
            const iconName = icons[route.name] ?? 'circle';
            return (
              <Pressable
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                style={styles.tabButton}
              >
                <Feather name={iconName} size={26} color={isFocused ? '#3A3570' : '#9C9180'} />
              </Pressable>
            );
          })}
        </View>
        <Pressable style={styles.plusButton} onPress={() => setMenuOpen(true)}>
          <Feather name="plus" size={26} color="#FFFEFA" />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            <Pressable style={styles.menuRow} onPress={() => goTo('/modal')}>
              <Feather name="book" size={18} color="#3A3570" />
              <Text style={styles.menuText}>Add a recipe</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuRow} onPress={() => goTo('/add-ingredient')}>
              <Feather name="list" size={18} color="#3A3570" />
              <Text style={styles.menuText}>Add an ingredient</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 44,
    backgroundColor: '#FFFEFA',
    borderRadius: 999,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: '#3A3570',
  },
  tabButton: { alignItems: 'center', justifyContent: 'center' },
  plusButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3A3570',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuCard: { backgroundColor: '#FFFEFA', borderRadius: 18, marginHorizontal: 18, marginBottom: 110, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 18 },
  menuDivider: { height: 0.5, backgroundColor: '#E2E0EE' },
  menuText: { fontSize: 14, color: '#3A322A' },
});