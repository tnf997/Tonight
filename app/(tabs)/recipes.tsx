import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Recipe = {
  id: string;
  name: string;
  time_minutes: number | null;
  meal_type: string;
  shared_to_feed: boolean;
  save_count: number;
};

const MEAL_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Dessert', value: 'dessert' },
  { label: 'Appetizer', value: 'appetizer' },
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
];

const MEAL_LABELS: Record<string, string> = {
  dinner: 'Dinner',
  dessert: 'Dessert',
  appetizer: 'Appetizer/Snack',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
};

export default function RecipesScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);
  const [pendingShareId, setPendingShareId] = useState<string | null>(null);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('recipes')
      .select('id, name, time_minutes, meal_type, shared_to_feed, save_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) setRecipes(data as Recipe[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchRecipes(); }, [fetchRecipes]));

  async function handleSharePress(id: string) {
    const seen = await AsyncStorage.getItem('share_disclaimer_seen');
    if (seen) {
      confirmShare(id);
    } else {
      setPendingShareId(id);
      setDisclaimerVisible(true);
    }
  }

  async function confirmShare(id: string) {
    await AsyncStorage.setItem('share_disclaimer_seen', 'true');
    setDisclaimerVisible(false);
    setPendingShareId(null);
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, shared_to_feed: true } : r)));
    await supabase.from('recipes').update({ shared_to_feed: true }).eq('id', id);
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete recipe?', 'This removes it permanently, including from your swipe deck.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setRecipes((prev) => prev.filter((r) => r.id !== id));
          await supabase.from('recipes').delete().eq('id', id);
        },
      },
    ]);
  }

  const filtered = activeTab === 'all'
    ? recipes
    : recipes.filter((r) => r.meal_type === activeTab);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My recipes</Text>
        <Pressable style={styles.iconBtn} onPress={() => router.push('/settings' as any)}>
          <Feather name="settings" size={26} color="#3A3570" />
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={MEAL_TABS}
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={{ paddingHorizontal: 18, gap: 6 }}
        renderItem={({ item }) => {
          const isActive = activeTab === item.value;
          return (
            <Pressable
              onPress={() => setActiveTab(item.value)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        }}
      />

      {loading ? (
        <ActivityIndicator color="#3A3570" style={{ marginTop: 20 }} />
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>
          {activeTab === 'all'
            ? 'No recipes yet. Tap the + button to add your first one.'
            : `No ${MEAL_LABELS[activeTab] ?? activeTab} recipes yet.`}
        </Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 10 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/recipe-detail?id=${item.id}` as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeName}>{item.name}</Text>
                <View style={styles.metaRow}>
                  {item.time_minutes != null && (
                    <Text style={styles.recipeMeta}>{item.time_minutes} min</Text>
                  )}
                  {item.time_minutes != null && <Text style={styles.recipeMeta}> · </Text>}
                  <Text style={styles.recipeMeta}>{MEAL_LABELS[item.meal_type] ?? item.meal_type}</Text>
                </View>
              </View>
              <View style={styles.rowActions}>
                {!item.shared_to_feed && (
                  <Pressable style={styles.iconBtn} onPress={() => handleSharePress(item.id)}>
                    <Feather name="share-2" size={22} color="#9C9180" />
                  </Pressable>
                )}
                {item.shared_to_feed && (
                  <View style={styles.sharedBadge}>
                    <Feather name="globe" size={18} color="#3A3570" />
                    {item.save_count > 0 && (
                      <Text style={styles.sharedCount}>{item.save_count}</Text>
                    )}
                  </View>
                )}
                <Pressable style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
                  <Feather name="trash-2" size={22} color="#9C9180" />
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={disclaimerVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Feather name="share-2" size={22} color="#D85A30" style={{ marginBottom: 8 }} />
            <Text style={styles.modalTitle}>Sharing is permanent</Text>
            <Text style={styles.modalBody}>
              Once shared, other users can see and save this recipe. It can't be made private again.
            </Text>
            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => { setDisclaimerVisible(false); setPendingShareId(null); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={() => pendingShareId && confirmShare(pendingShareId)}
              >
                <Text style={styles.modalConfirmText}>Share recipe</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA', paddingTop: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '500', color: '#3A3570' },
  tabScroll: { flexGrow: 0, marginBottom: 4 },
  tab: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    backgroundColor: 'transparent',
  },
  tabActive: { backgroundColor: '#E2E0EE', borderWidth: 0 },
  tabText: { fontSize: 11, color: '#9C9180' },
  tabTextActive: { fontSize: 11, color: '#3A3570', fontWeight: '500' },
  emptyText: { fontSize: 12, color: '#9C9180', paddingHorizontal: 18, marginTop: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  recipeName: { fontSize: 13, color: '#3A322A' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  recipeMeta: { fontSize: 11, color: '#9C9180' },
  rowActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sharedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sharedCount: { fontSize: 11, color: '#3A3570' },
  iconBtn: { padding: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  modalCard: { backgroundColor: '#FFFEFA', borderRadius: 16, padding: 20, alignItems: 'center', width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '500', color: '#3A322A', marginBottom: 8 },
  modalBody: { fontSize: 12, color: '#6B6049', textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  modalBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  modalCancel: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 0.5, borderColor: '#E2E0EE', alignItems: 'center' },
  modalCancelText: { fontSize: 13, color: '#6B6049' },
  modalConfirm: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: '#D85A30', alignItems: 'center' },
  modalConfirmText: { fontSize: 13, color: '#FFFEFA', fontWeight: '500' },
});