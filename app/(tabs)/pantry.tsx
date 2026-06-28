import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
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

type Recipe = {
  ingredients: { name: string; amount: string }[];
};

const STRIP_WORDS = [
  "great value", "rao's", "raos", "breakstone's", "breakstones",
  "kraft", "heinz", "hunt's", "hunts", "del monte", "progresso",
  "campbell's", "campbells", "barilla", "ronzoni", "classico",
  "prego", "bertolli", "newman's own", "newmans own", "land o lakes",
  "daisy", "philadelphia", "generic", "store brand",
  "boneless", "skinless", "whole", "fresh", "frozen", "dried",
  "canned", "jarred", "organic", "large", "small", "medium",
  "extra", "lean", "ground", "shredded", "sliced", "diced",
  "chopped", "minced", "cooked", "raw", "unsalted", "salted",
  "low fat", "low-fat", "fat free", "fat-free", "reduced fat",
  "stuffed", "cheese stuffed", "filled",
];

function normalize(text: string) {
  let result = text.trim().toLowerCase().replace(/['']/g, '');
  for (const word of STRIP_WORDS) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  }
  return result.replace(/\s+/g, ' ').trim();
}

function ingredientIsAvailable(ingredientName: string, pantryNames: string[]) {
  const needed = normalize(ingredientName);
  if (!needed) return true;
  const neededWords = needed.split(' ').filter(Boolean);
  return pantryNames.some((rawHave) => {
    const have = normalize(rawHave);
    if (!have) return false;
    if (have === needed) return true;
    if (have.includes(needed) || needed.includes(have)) return true;
    return neededWords.some((word) => word.length > 3 && have.includes(word));
  });
}

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
        <Pressable style={rowStyles.deleteBtn} onPress={() => { closeRow(); onDelete(); }}>
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
  actions: { position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_WIDTH },
  deleteBtn: { flex: 1, backgroundColor: '#A32D2D', alignItems: 'center', justifyContent: 'center', gap: 2 },
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
  toggle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 },
  toggleHave: { backgroundColor: '#639922' },
  toggleNeed: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#EF9F27' },
});

export default function PantryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'cold' | 'frozen' | 'shelf' | 'need'>('all');
  const [showMissingPrompt, setShowMissingPrompt] = useState(false);
  const [missingCount, setMissingCount] = useState(0);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('pantry_items')
      .select('id, item_name, category, storage_location, status')
      .eq('user_id', userId)
      .order('item_name', { ascending: true });

    if (!error && data) {
      setItems(data as PantryItem[]);

      const alreadySeen = await AsyncStorage.getItem('missing_ingredients_prompt_seen');
      if (!alreadySeen) {
        const pantryNames = (data as PantryItem[])
          .filter((i) => i.status === 'have')
          .map((i) => normalize(i.item_name));

        const { data: recipes } = await supabase
          .from('recipes')
          .select('ingredients')
          .eq('user_id', userId);

        if (recipes && recipes.length > 0) {
          const allIngredients = (recipes as Recipe[]).flatMap((r) => r.ingredients.map((i) => i.name));
          const unique = [...new Set(allIngredients.map((n) => normalize(n)).filter(Boolean))];
          const missing = unique.filter((ing) => !ingredientIsAvailable(ing, pantryNames));
          if (missing.length > 0) {
            setMissingCount(missing.length);
            setShowMissingPrompt(true);
          }
        }
      }
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchItems(); }, [fetchItems]));

  async function dismissPrompt() {
    await AsyncStorage.setItem('missing_ingredients_prompt_seen', 'true');
    setShowMissingPrompt(false);
  }

  async function goToMissing() {
    await AsyncStorage.setItem('missing_ingredients_prompt_seen', 'true');
    setShowMissingPrompt(false);
    router.push('/add-missing-ingredients' as any);
  }

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
        style={[styles.search, { fontSize: 14, letterSpacing: 0 }]}
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

      <Modal visible={showMissingPrompt} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Feather name="shopping-bag" size={22} color="#3A3570" style={{ marginBottom: 8 }} />
            <Text style={styles.modalTitle}>Missing ingredients</Text>
            <Text style={styles.modalBody}>
              Your recipes have {missingCount} ingredient{missingCount !== 1 ? 's' : ''} not in your pantry yet. Want to add them now?
            </Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalSkip} onPress={dismissPrompt}>
                <Text style={styles.modalSkipText}>Skip</Text>
              </Pressable>
              <Pressable style={styles.modalGo} onPress={goToMissing}>
                <Text style={styles.modalGoText}>Let's go</Text>
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
  loadingContainer: { flex: 1, backgroundColor: '#FBF6EA', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '500', color: '#3A3570', paddingHorizontal: 18, marginBottom: 8 },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, marginBottom: 10, flexWrap: 'wrap' },
  tab: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: 'transparent', borderWidth: 0.5, borderColor: '#E2E0EE' },
  tabActive: { backgroundColor: '#E2E0EE', borderWidth: 0 },
  tabText: { fontSize: 11, color: '#9C9180' },
  tabTextActive: { color: '#3A3570', fontWeight: '500' },
  search: { height: 36, backgroundColor: '#FFFEFA', borderWidth: 0.5, borderColor: '#E2E0EE', borderRadius: 999, paddingHorizontal: 14, marginHorizontal: 18, marginBottom: 10 },
  addPromptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18, marginHorizontal: 18, marginBottom: 10 },
  addPromptText: { fontSize: 13, color: '#FFFEFA', fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  modalCard: { backgroundColor: '#FFFEFA', borderRadius: 16, padding: 20, alignItems: 'center', width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '500', color: '#3A322A', marginBottom: 8 },
  modalBody: { fontSize: 13, color: '#6B6049', textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  modalBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  modalSkip: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 0.5, borderColor: '#E2E0EE', alignItems: 'center' },
  modalSkipText: { fontSize: 13, color: '#6B6049' },
  modalGo: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: '#3A3570', alignItems: 'center' },
  modalGoText: { fontSize: 13, color: '#FFFEFA', fontWeight: '500' },
});