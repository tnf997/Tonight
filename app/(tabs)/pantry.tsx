import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const ACTION_WIDTH = 80;
const SNAP_OPEN = -ACTION_WIDTH;
const SNAP_CLOSED = 0;

type PantryItem = {
  id: string;
  item_name: string;
  category: string;
  storage_location: 'cold' | 'frozen' | 'shelf';
  status: 'have' | 'need';
};

const filters: { label: string; value: 'all' | 'cold' | 'frozen' | 'shelf' | 'need' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Cold', value: 'cold' },
  { label: 'Frozen', value: 'frozen' },
  { label: 'Shelf', value: 'shelf' },
  { label: 'Need', value: 'need' },
];

function PantryRow({
  item,
  onToggle,
  onDelete,
}: {
  item: PantryItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(SNAP_CLOSED)).current;
  const currentX = useRef(SNAP_CLOSED);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        return Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        translateX.stopAnimation((val) => {
          currentX.current = val;
          translateX.setOffset(val);
          translateX.setValue(0);
        });
      },
      onPanResponderMove: (_evt, gesture) => {
        const next = Math.min(0, Math.max(SNAP_OPEN, gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        translateX.flattenOffset();
        const current = currentX.current + gesture.dx;
        const midpoint = SNAP_OPEN / 2;
        const target = current < midpoint ? SNAP_OPEN : SNAP_CLOSED;
        Animated.spring(translateX, {
          toValue: target,
          useNativeDriver: true,
          bounciness: 0,
        }).start(() => { currentX.current = target; });
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        Animated.spring(translateX, {
          toValue: SNAP_CLOSED,
          useNativeDriver: true,
          bounciness: 0,
        }).start(() => { currentX.current = SNAP_CLOSED; });
      },
    })
  ).current;

  function closeRow() {
    Animated.spring(translateX, {
      toValue: SNAP_CLOSED,
      useNativeDriver: true,
      bounciness: 0,
    }).start(() => { currentX.current = SNAP_CLOSED; });
  }

  return (
    <View style={rowStyles.wrapper}>
      <View style={rowStyles.actions}>
        <Pressable
          style={rowStyles.deleteBtn}
          onPress={() => { closeRow(); onDelete(); }}
        >
          <Feather name="trash-2" size={18} color="#FFFEFA" />
          <Text style={rowStyles.actionText}>Delete</Text>
        </Pressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[rowStyles.row, { transform: [{ translateX }] }]}
      >
        <Text style={rowStyles.itemName} numberOfLines={1} ellipsizeMode="tail">
          {item.item_name}
        </Text>
        <Pressable
          onPress={onToggle}
          style={[rowStyles.toggle, item.status === 'have' ? rowStyles.toggleHave : rowStyles.toggleNeed]}
        >
          {item.status === 'have' && <Feather name="check" size={14} color="#FFFEFA" />}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  wrapper: { marginBottom: 6, borderRadius: 12, overflow: 'hidden' },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#A32D2D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionText: { color: '#FFFEFA', fontSize: 11, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  itemName: { flex: 1, fontSize: 13, color: '#3A322A' },
  toggle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 8,
  },
  toggleHave: { backgroundColor: '#639922' },
  toggleNeed: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#EF9F27' },
});

export default function PantryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'cold' | 'frozen' | 'shelf' | 'need'>('all');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pantry_items')
      .select('id, item_name, category, storage_location, status')
      .order('item_name', { ascending: true });
    if (!error && data) setItems(data as PantryItem[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchItems(); }, [fetchItems]));

  async function toggleStatus(item: PantryItem) {
    const newStatus = item.status === 'have' ? 'need' : 'have';
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)));
    await supabase.from('pantry_items').update({ status: newStatus }).eq('id', item.id);
  }

  async function handleDelete(item: PantryItem) {
    Alert.alert('Delete ingredient?', `Remove ${item.item_name} from your pantry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          await supabase.from('pantry_items').delete().eq('id', item.id);
        },
      },
    ]);
  }

  const filtered = items.filter((i) => {
    if (activeFilter === 'need') return i.status === 'need' && i.item_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'all' || i.storage_location === activeFilter;
    const matchesSearch = i.item_name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const showAddPrompt = search.trim().length > 0 && filtered.length === 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#3A3570" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pantry</Text>

      <View style={styles.tabRow}>
        {filters.map((f) => {
          const isActive = activeFilter === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => setActiveFilter(f.value)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search ingredients"
        value={search}
        onChangeText={setSearch}
      />

      {showAddPrompt && (
        <Pressable
          style={styles.addPromptBtn}
          onPress={() => router.push(`/add-ingredient?prefill=${encodeURIComponent(search.trim())}` as any)}
        >
          <Feather name="plus" size={14} color="#FFFEFA" />
          <Text style={styles.addPromptText}>Add "{search.trim()}" to pantry</Text>
        </Pressable>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <PantryRow
            item={item}
            onToggle={() => toggleStatus(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA', paddingTop: 60 },
  loadingContainer: { flex: 1, backgroundColor: '#FBF6EA', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '500', color: '#3A3570', paddingHorizontal: 18, marginBottom: 8 },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, marginBottom: 10, flexWrap: 'wrap' },
  tab: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
  },
  tabActive: { backgroundColor: '#E2E0EE', borderWidth: 0 },
  tabText: { fontSize: 11, color: '#9C9180' },
  tabTextActive: { color: '#3A3570', fontWeight: '500' },
  search: {
    height: 36,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 999,
    paddingHorizontal: 14,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 13, color: '#9C9180' },
  addPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3A3570',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  addPromptText: { fontSize: 13, color: '#FFFEFA', fontWeight: '500' },
});