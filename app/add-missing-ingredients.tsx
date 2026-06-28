import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type MissingIngredient = {
  name: string;
  storage: 'shelf' | 'cold' | 'frozen';
  selected: boolean;
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

export default function AddMissingIngredientsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ingredients, setIngredients] = useState<MissingIngredient[]>([]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) { setLoading(false); return; }

      const [pantryResult, recipesResult] = await Promise.all([
        supabase.from('pantry_items').select('item_name, status').eq('user_id', userId),
        supabase.from('recipes').select('ingredients').eq('user_id', userId),
      ]);

      const pantryNames = (pantryResult.data ?? [])
        .filter((i: any) => i.status === 'have')
        .map((i: any) => normalize(i.item_name));

      const allIngredients = (recipesResult.data ?? []).flatMap((r: any) =>
        r.ingredients.map((i: any) => i.name)
      );

      const seen = new Set<string>();
      const missing: MissingIngredient[] = [];

      for (const name of allIngredients) {
        const norm = normalize(name);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        if (!ingredientIsAvailable(name, pantryNames)) {
          missing.push({
            name: name.trim(),
            storage: 'shelf',
            selected: true,
          });
        }
      }

      setIngredients(missing);
      setLoading(false);
    }
    load();
  }, []);

  function toggleSelected(index: number) {
    setIngredients((prev) =>
      prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item)
    );
  }

  function setStorage(index: number, storage: 'shelf' | 'cold' | 'frozen') {
    setIngredients((prev) =>
      prev.map((item, i) => i === index ? { ...item, storage } : item)
    );
  }

  async function handleAddAll() {
    const selected = ingredients.filter((i) => i.selected);
    if (selected.length === 0) {
      Alert.alert('Nothing selected', 'Select at least one ingredient to add.');
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSaving(false); return; }

    const rows = selected.map((ing) => ({
      user_id: userId,
      item_name: ing.name,
      category: 'Other',
      storage_location: ing.storage,
      status: 'have',
    }));

    const { error } = await supabase.from('pantry_items').insert(rows);
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert(
      'Added!',
      `${selected.length} ingredient${selected.length !== 1 ? 's' : ''} added to your pantry.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#3A3570" />
      </View>
    );
  }

  if (ingredients.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>All recipe ingredients are already in your pantry!</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={20} color="#6B6049" />
        </Pressable>
        <Text style={styles.headerTitle}>Missing ingredients</Text>
        <View style={{ width: 20 }} />
      </View>

      <Text style={styles.subtitle}>
        Select the ingredients you have and choose where you store them.
      </Text>

      <FlatList
        data={ingredients}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Pressable onPress={() => toggleSelected(index)} style={styles.checkbox}>
              {item.selected && <Feather name="check" size={14} color="#FFFEFA" />}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ingredientName, !item.selected && styles.ingredientDeselected]}>
                {item.name}
              </Text>
              <View style={styles.storageRow}>
                {(['shelf', 'cold', 'frozen'] as const).map((loc) => (
                  <Pressable
                    key={loc}
                    onPress={() => setStorage(index, loc)}
                    style={[
                      styles.storageBtn,
                      item.storage === loc && styles.storageBtnActive,
                      !item.selected && styles.storageBtnDisabled,
                    ]}
                    disabled={!item.selected}
                  >
                    <Text style={[
                      styles.storageBtnText,
                      item.storage === loc && styles.storageBtnTextActive,
                    ]}>
                      {loc.charAt(0).toUpperCase() + loc.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable style={styles.addBtn} onPress={handleAddAll} disabled={saving}>
          <Text style={styles.addBtnText}>
            {saving ? 'Adding...' : `Add ${ingredients.filter(i => i.selected).length} to pantry`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA' },
  loadingContainer: { flex: 1, backgroundColor: '#FBF6EA', justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 14, color: '#6B6049', textAlign: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 60, paddingBottom: 10 },
  headerTitle: { fontSize: 16, fontWeight: '500', color: '#3A322A' },
  subtitle: { fontSize: 12, color: '#9C9180', paddingHorizontal: 18, marginBottom: 14, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FFFEFA', borderWidth: 0.5, borderColor: '#E2E0EE', borderRadius: 12, padding: 12, marginBottom: 8 },
  checkbox: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#3A3570', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  ingredientName: { fontSize: 13, color: '#3A322A', marginBottom: 8, fontWeight: '500' },
  ingredientDeselected: { color: '#B0A790' },
  storageRow: { flexDirection: 'row', gap: 6 },
  storageBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 0.5, borderColor: '#E2E0EE', backgroundColor: 'transparent' },
  storageBtnActive: { backgroundColor: '#3A3570', borderColor: '#3A3570' },
  storageBtnDisabled: { opacity: 0.4 },
  storageBtnText: { fontSize: 11, color: '#6B6049' },
  storageBtnTextActive: { color: '#FFFEFA' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, backgroundColor: '#FBF6EA', borderTopWidth: 0.5, borderTopColor: '#E2E0EE' },
  addBtn: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  addBtnText: { color: '#FFFEFA', fontWeight: '500', fontSize: 14 },
  backBtn: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  backBtnText: { color: '#FFFEFA', fontWeight: '500', fontSize: 14 },
});