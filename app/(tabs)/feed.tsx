import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type FeedRecipe = {
  id: string;
  name: string;
  time_minutes: number | null;
  tags: string[];
  photo_url: string | null;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  servings: number | null;
  user_id: string;
  save_count: number;
  meal_type: string;
  profiles: any;
};

const DIETARY_OPTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut-free',
];

const MEAL_TYPE_OPTIONS = [
  { label: 'Dinner', value: 'dinner' },
  { label: 'Dessert', value: 'dessert' },
  { label: 'Appetizer/Snack', value: 'appetizer' },
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
];

export default function FeedScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<FeedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeDietary, setActiveDietary] = useState<Set<string>>(new Set());
  const [activeMealTypes, setActiveMealTypes] = useState<Set<string>>(new Set());
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [dislikeInput, setDislikeInput] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    setCurrentUserId(userData.user?.id ?? null);

    const { data, error } = await supabase
      .from('recipes')
      .select(`
        id, name, time_minutes, tags, photo_url, ingredients, steps,
        calories, protein_g, carbs_g, fat_g, servings, user_id, save_count, meal_type,
        profiles ( full_name, username )
      `)
      .eq('shared_to_feed', true)
      .order('created_at', { ascending: false });

    if (!error && data) setRecipes(data as FeedRecipe[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchFeed(); }, [fetchFeed]));

  function toggleDietary(tag: string) {
    const next = new Set(activeDietary);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    setActiveDietary(next);
  }

  function toggleMealType(val: string) {
    const next = new Set(activeMealTypes);
    next.has(val) ? next.delete(val) : next.add(val);
    setActiveMealTypes(next);
  }

  function addDislike() {
    const val = dislikeInput.trim();
    if (val && !dislikes.includes(val.toLowerCase())) {
      setDislikes((prev) => [...prev, val.toLowerCase()]);
    }
    setDislikeInput('');
  }

  function removeDislike(val: string) {
    setDislikes((prev) => prev.filter((d) => d !== val));
  }

  async function handleSave(recipe: FeedRecipe) {
    if (savingId) return;
    setSavingId(recipe.id);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSavingId(null); return; }

    const { error: insertError } = await supabase.from('recipes').insert({
      user_id: userId,
      name: recipe.name,
      meal_type: recipe.meal_type,
      time_minutes: recipe.time_minutes,
      servings: recipe.servings,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      calories: recipe.calories,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fat_g,
      photo_url: recipe.photo_url,
    });

    if (insertError) {
      Alert.alert('Save failed', insertError.message);
      setSavingId(null);
      return;
    }

    await supabase
      .from('recipes')
      .update({ save_count: recipe.save_count + 1 })
      .eq('id', recipe.id);

    setRecipes((prev) =>
      prev.map((r) => r.id === recipe.id ? { ...r, save_count: r.save_count + 1 } : r)
    );

    setSavingId(null);
    Alert.alert('Added!', `${recipe.name} has been added to your recipes.`);
  }

  const filtered = recipes.filter((r) => {
    if (r.user_id === currentUserId) return false;
    if (search) {
      const userName = (r.profiles?.full_name ?? r.profiles?.username ?? '').toLowerCase();
      const recipeName = r.name.toLowerCase();
      if (!userName.includes(search.toLowerCase()) && !recipeName.includes(search.toLowerCase())) return false;
    }
    if (activeDietary.size > 0) {
      const recipeTags = r.tags.map((t) => t.toLowerCase());
      for (const diet of activeDietary) {
        if (!recipeTags.includes(diet.toLowerCase())) return false;
      }
    }
    if (activeMealTypes.size > 0) {
      if (!activeMealTypes.has(r.meal_type)) return false;
    }
    if (dislikes.length > 0) {
      const ingredientNames = r.ingredients.map((i) => i.name.toLowerCase());
      for (const dislike of dislikes) {
        if (ingredientNames.some((ing) => ing.includes(dislike))) return false;
      }
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => { setSearchOpen((v) => !v); setSearch(''); }}>
            <Feather name="search" size={20} color="#3A3570" />
          </Pressable>
          <Pressable onPress={() => setFilterOpen(true)}>
            <Feather name="sliders" size={20} color="#3A3570" />
          </Pressable>
        </View>
      </View>

      {searchOpen && (
        <TextInput
          style={styles.searchBar}
          placeholder="Search by name or recipe"
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
      )}

      {loading ? (
        <ActivityIndicator color="#3A3570" style={{ marginTop: 20 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {recipes.length === 0
              ? 'No recipes have been shared yet.'
              : 'No recipes match your filters.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/recipe-detail?id=${item.id}&source=feed` as any)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.profiles?.full_name ?? item.profiles?.username ?? '?')
                      .split(' ')
                      .map((w: string) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.userName}>
                  {item.profiles?.full_name ?? item.profiles?.username ?? 'Unknown'}
                </Text>
              </View>

              {item.photo_url ? (
                <Image
                  source={{ uri: item.photo_url }}
                  style={styles.photo}
                  cachePolicy="memory-disk"
                  transition={0}
                />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]} />
              )}

              <View style={styles.cardFooter}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeName}>{item.name}</Text>
                  <Text style={styles.recipeMeta}>
                    {item.tags.length > 0 ? item.tags.join(' · ') + ' · ' : ''}
                    {item.time_minutes != null ? `${item.time_minutes} min` : ''}
                  </Text>
                </View>
                <Pressable
                  style={styles.saveArea}
                  onPress={(e) => { e.stopPropagation(); handleSave(item); }}
                  disabled={savingId === item.id}
                >
                  {item.save_count > 0 && (
                    <Text style={styles.saveCount}>{item.save_count}</Text>
                  )}
                  <View style={styles.addBtn}>
                    <Feather
                      name="plus"
                      size={16}
                      color={savingId === item.id ? '#E2E0EE' : '#FFFEFA'}
                    />
                  </View>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.filterSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter feed</Text>
              <Pressable onPress={() => setFilterOpen(false)}>
                <Feather name="x" size={18} color="#6B6049" />
              </Pressable>
            </View>

            <ScrollView>
              <Text style={styles.filterLabel}>MEAL TYPE</Text>
              <View style={styles.chipRow}>
                {MEAL_TYPE_OPTIONS.map((opt) => {
                  const isActive = activeMealTypes.has(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => toggleMealType(opt.value)}
                      style={[styles.chip, isActive && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.filterLabel}>DIETARY</Text>
              <View style={styles.chipRow}>
                {DIETARY_OPTIONS.map((opt) => {
                  const isActive = activeDietary.has(opt);
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => toggleDietary(opt)}
                      style={[styles.chip, isActive && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.filterLabel}>DISLIKES</Text>
              <View style={styles.chipRow}>
                {dislikes.map((d) => (
                  <Pressable key={d} onPress={() => removeDislike(d)} style={styles.dislikeChip}>
                    <Text style={styles.dislikeChipText}>{d}</Text>
                    <Feather name="x" size={11} color="#854F0B" />
                  </Pressable>
                ))}
              </View>
              <View style={styles.dislikeRow}>
                <TextInput
                  style={styles.dislikeInput}
                  placeholder="e.g. cilantro, shrimp"
                  value={dislikeInput}
                  onChangeText={setDislikeInput}
                  onSubmitEditing={addDislike}
                  returnKeyType="done"
                />
                <Pressable style={styles.dislikeAdd} onPress={addDislike}>
                  <Feather name="plus" size={16} color="#FFFEFA" />
                </Pressable>
              </View>

              <Pressable style={styles.applyBtn} onPress={() => setFilterOpen(false)}>
                <Text style={styles.applyBtnText}>Apply filters</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
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
    marginBottom: 6,
  },
  headerActions: { flexDirection: 'row', gap: 16 },
  title: { fontSize: 22, fontWeight: '500', color: '#3A3570' },
  searchBar: {
    height: 36,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 999,
    paddingHorizontal: 14,
    marginHorizontal: 18,
    marginBottom: 8,
    fontSize: 13,
    color: '#3A322A',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: '#9C9180', textAlign: 'center', paddingHorizontal: 30 },
  card: {
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E0EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '500', color: '#3A3570' },
  userName: { fontSize: 12, color: '#6B6049' },
  photo: { width: '100%', height: 160 },
  photoPlaceholder: { backgroundColor: '#ECE4D3' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  recipeName: { fontSize: 14, fontWeight: '500', color: '#3A322A' },
  recipeMeta: { fontSize: 11, color: '#9C9180', marginTop: 2 },
  saveArea: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveCount: { fontSize: 12, color: '#9C9180' },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3A3570',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: '#FFFEFA',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '75%',
  },
  filterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  filterTitle: { fontSize: 15, fontWeight: '500', color: '#3A322A' },
  filterLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.5, color: '#6B6049', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FBF6EA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
  },
  chipActive: { backgroundColor: '#EAF3DE', borderWidth: 0 },
  chipText: { fontSize: 12, color: '#6B6049' },
  chipTextActive: { color: '#3B6D11' },
  dislikeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FAEEDA',
  },
  dislikeChipText: { fontSize: 12, color: '#854F0B' },
  dislikeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dislikeInput: {
    flex: 1,
    height: 34,
    backgroundColor: '#FBF6EA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#3A322A',
  },
  dislikeAdd: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#3A3570',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtn: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  applyBtnText: { color: '#FFFEFA', fontWeight: '500', fontSize: 13 },
});