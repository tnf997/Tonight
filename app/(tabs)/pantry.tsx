import TabGuideModal from '@/components/TabGuideModal';
import { scaleFont, scaleSpacing } from '@/constants/scale';
import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
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
  highlightColor,
}: {
  item: PantryItem;
  onToggle: () => void;
  onDelete: () => void;
  highlightColor?: string;
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
          <Feather name="trash-2" size={scaleFont(18)} color="#FFFEFA" />
          <Text style={rowStyles.actionText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[rowStyles.row, { transform: [{ translateX }] }]}
      >
       <Text
          style={[
            rowStyles.itemName,
            highlightColor ? { backgroundColor: highlightColor, paddingHorizontal: 4, borderRadius: 3 } : null,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.item_name}
        </Text>
        <Pressable
          onPress={onToggle}
          style={[rowStyles.toggle, item.status === 'have' ? rowStyles.toggleHave : rowStyles.toggleNeed]}
        >
          {item.status === 'have' && <Feather name="check" size={scaleFont(14)} color="#FFFEFA" />}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  wrapper: { marginBottom: 6, borderRadius: 12, overflow: 'hidden' },
  actions: { position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_WIDTH },
  deleteBtn: { flex: 1, backgroundColor: '#A32D2D', alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionText: { color: '#FFFEFA', fontSize: scaleFont(11), fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 12,
    paddingVertical: scaleSpacing(10),
    paddingHorizontal: scaleSpacing(12),
  },
  itemName: { flex: 1, fontSize: scaleFont(13), color: '#3A322A' },
  toggle: { width: scaleFont(26), height: scaleFont(26), borderRadius: scaleFont(13), alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 },
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
  const [showGuide, setShowGuide] = useState(false);
 const [needSortDates, setNeedSortDates] = useState<Map<string, string>>(new Map());
  const [highlightColor, setHighlightColor] = useState('#FCE3A8');

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
        const missingFromPantry = unique.filter((ing) => !ingredientIsAvailable(ing, pantryNames));

        const { data: seenRows } = await supabase
          .from('seen_missing_ingredients')
          .select('ingredient_name')
          .eq('user_id', userId);
        const seenNames = new Set((seenRows ?? []).map((r: any) => r.ingredient_name));

        const newlyMissing = missingFromPantry.filter((ing) => !seenNames.has(ing));

        if (newlyMissing.length > 0) {
          setMissingCount(newlyMissing.length);
          setShowMissingPrompt(true);
        }
      }

      const todayKey = new Date().toISOString().split('T')[0];
      const { data: plannedMeals } = await supabase
        .from('planned_meals')
        .select('date, recipes ( ingredients )')
        .eq('user_id', userId)
        .gte('date', todayKey)
        .order('date', { ascending: true });

      const sortMap = new Map<string, string>();
      (plannedMeals ?? []).forEach((row: any) => {
        const ingredients = row.recipes?.ingredients ?? [];
        ingredients.forEach((ing: any) => {
          const norm = normalize(ing.name);
          if (!norm) return;
          if (!sortMap.has(norm)) {
            sortMap.set(norm, row.date);
          }
        });
      });
    setNeedSortDates(sortMap);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('need_highlight_color')
        .eq('id', userId)
        .single();
      if (profileData?.need_highlight_color) {
        setHighlightColor(profileData.need_highlight_color);
      }
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchItems(); }, [fetchItems]));

  useFocusEffect(useCallback(() => {
    async function checkGuide() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const { data } = await supabase.from('profiles').select('seen_pantry_guide').eq('id', userId).single();
      if (data && !data.seen_pantry_guide) setShowGuide(true);
    }
    checkGuide();
  }, []));

  async function dismissGuide() {
    setShowGuide(false);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userId) await supabase.from('profiles').update({ seen_pantry_guide: true }).eq('id', userId);
  }

  async function dismissPrompt() {
    setShowMissingPrompt(false);
  }

  async function goToMissing() {
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

let filtered = items.filter((i) => {
    if (activeFilter === 'need') return i.status === 'need' && i.item_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'all' || i.storage_location === activeFilter;
    const matchesSearch = i.item_name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (activeFilter === 'need') {
    filtered = [...filtered].sort((a, b) => {
      const aDate = needSortDates.get(normalize(a.item_name));
      const bDate = needSortDates.get(normalize(b.item_name));
      if (aDate && bDate) return aDate.localeCompare(bDate);
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      return a.item_name.localeCompare(b.item_name);
    });
  }

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
          <Feather name="plus" size={scaleFont(14)} color="#FFFEFA" />
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
            highlightColor={
              activeFilter === 'need' && needSortDates.has(normalize(item.item_name))
                ? highlightColor
                : undefined
            }
          />
        )}
      />

      <Modal visible={showMissingPrompt} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Feather name="shopping-bag" size={scaleFont(22)} color="#3A3570" style={{ marginBottom: 8 }} />
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

      <TabGuideModal
        visible={showGuide}
        title="Your pantry"
        message="Here is your pantry — it's important to keep this as up to date as possible so the swipe deck is accurate on what you can cook. You can search to add an ingredient, or use the purple plus in the bottom right."
        onDismiss={dismissGuide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA', paddingTop: 60 },
  loadingContainer: { flex: 1, backgroundColor: '#FBF6EA', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: scaleFont(22), fontWeight: '500', color: '#3A3570', paddingHorizontal: 18, marginBottom: 8 },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, marginBottom: 10, flexWrap: 'wrap' },
  tab: { paddingVertical: scaleSpacing(5), paddingHorizontal: scaleSpacing(11), borderRadius: 999, backgroundColor: 'transparent', borderWidth: 0.5, borderColor: '#E2E0EE' },
  tabActive: { backgroundColor: '#E2E0EE', borderWidth: 0 },
  tabText: { fontSize: scaleFont(11), color: '#9C9180' },
  tabTextActive: { fontSize: scaleFont(11), color: '#3A3570', fontWeight: '500' },
  search: { height: scaleFont(36), backgroundColor: '#FFFEFA', borderWidth: 0.5, borderColor: '#E2E0EE', borderRadius: 999, paddingHorizontal: scaleSpacing(14), marginHorizontal: 18, marginBottom: 10, fontSize: scaleFont(14) },
  addPromptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: scaleSpacing(10), paddingHorizontal: scaleSpacing(18), marginHorizontal: 18, marginBottom: 10 },
  addPromptText: { fontSize: scaleFont(13), color: '#FFFEFA', fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  modalCard: { backgroundColor: '#FFFEFA', borderRadius: 16, padding: 20, alignItems: 'center', width: '100%' },
  modalTitle: { fontSize: scaleFont(16), fontWeight: '500', color: '#3A322A', marginBottom: 8 },
  modalBody: { fontSize: scaleFont(13), color: '#6B6049', textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  modalBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  modalSkip: { flex: 1, paddingVertical: scaleSpacing(10), borderRadius: 999, borderWidth: 0.5, borderColor: '#E2E0EE', alignItems: 'center' },
  modalSkipText: { fontSize: scaleFont(13), color: '#6B6049' },
  modalGo: { flex: 1, paddingVertical: scaleSpacing(10), borderRadius: 999, backgroundColor: '#3A3570', alignItems: 'center' },
  modalGoText: { fontSize: scaleFont(13), color: '#FFFEFA', fontWeight: '500' },
});