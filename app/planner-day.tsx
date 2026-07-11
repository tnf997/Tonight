import { supabase } from '@/lib/supabase';
import { Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import Feather from '@expo/vector-icons/Feather';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

type Recipe = {
  id: string;
  name: string;
  meal_type: string;
  ingredients: { name: string; amount: string }[];
};

type CookLabel = {
  id: string;
  initials: string;
  color: string;
  name: string | null;
};

const MEAL_LABELS: Record<string, string> = {
  dinner: 'Dinner',
  dessert: 'Dessert',
  appetizer: 'Appetizer/Snack',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
};

const LABEL_COLORS = [
  '#D4537E', '#378ADD', '#639922', '#EF9F27', '#8B5CF6', '#D85A30', '#3AAEB5', '#C2447A',
  '#B8873A', '#4F8F5C', '#9B5FA8', '#4A7FB0',
  '#F7B8C6', '#AFD3F2', '#BEE3C4', '#FCE3A8', '#D9C7F0', '#F3C6B8', '#B8E4E8', '#EAC4DD',
  '#E8D5C4', '#C7D9C0', '#F0D8E8', '#CFE0EE',
];

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
  "stuffed", "cheese stuffed", "filled", "finely",
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

export default function PlannerDayScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'recipe' | 'link'>('recipe');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [existingEntry, setExistingEntry] = useState<{ recipeId: string | null; linkUrl: string | null; linkTitle: string | null; cookLabelId: string | null } | null>(null);

  const [cookLabels, setCookLabels] = useState<CookLabel[]>([]);
  const [selectedCookLabelId, setSelectedCookLabelId] = useState<string | null>(null);
  const [addLabelModalVisible, setAddLabelModalVisible] = useState(false);
  const [newLabelInitials, setNewLabelInitials] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) { setLoading(false); return; }

      const [recipesResult, existingResult, labelsResult] = await Promise.all([
        supabase
          .from('recipes')
          .select('id, name, meal_type, ingredients')
          .eq('user_id', userId)
          .order('name', { ascending: true }),
        supabase
          .from('planned_meals')
          .select('recipe_id, link_url, link_title, cook_label_id')
          .eq('user_id', userId)
          .eq('date', date)
          .maybeSingle(),
        supabase
          .from('cook_labels')
          .select('id, initials, color, name')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
      ]);

      if (recipesResult.data) setRecipes(recipesResult.data as Recipe[]);
      if (labelsResult.data) setCookLabels(labelsResult.data as CookLabel[]);

      if (existingResult.data) {
        setExistingEntry({
          recipeId: existingResult.data.recipe_id,
          linkUrl: existingResult.data.link_url,
          linkTitle: existingResult.data.link_title,
          cookLabelId: existingResult.data.cook_label_id,
        });
        setSelectedCookLabelId(existingResult.data.cook_label_id);
        if (existingResult.data.link_url) {
          setMode('link');
          setLinkUrlInput(existingResult.data.link_url);
          setLinkTitleInput(existingResult.data.link_title ?? '');
        }
      }
      setLoading(false);
    }
    if (date) load();
  }, [date]);

  async function syncMissingIngredients(recipe: Recipe, userId: string) {
    const { data: pantryData } = await supabase
      .from('pantry_items')
      .select('item_name, status')
      .eq('user_id', userId);

    const pantryNames = (pantryData ?? [])
      .filter((i: any) => i.status === 'have')
      .map((i: any) => normalize(i.item_name));

    const existingNeedNames = new Set(
      (pantryData ?? [])
        .filter((i: any) => i.status === 'need')
        .map((i: any) => normalize(i.item_name))
    );

    const missing = recipe.ingredients.filter(
      (ing) => !ingredientIsAvailable(ing.name, pantryNames)
    );

    for (const ing of missing) {
      const norm = normalize(ing.name);
      if (!norm || existingNeedNames.has(norm)) continue;
      const displayName = norm.charAt(0).toUpperCase() + norm.slice(1);
      await supabase.from('pantry_items').insert({
        user_id: userId,
        item_name: displayName,
        category: 'Other',
        storage_location: 'shelf',
        status: 'need',
      });
      existingNeedNames.add(norm);
    }
  }

  async function handleCreateLabel() {
    const initials = newLabelInitials.trim().toUpperCase().slice(0, 2);
    if (!initials) {
      Alert.alert('Add initials', 'Enter 1-2 letters for this person.');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('cook_labels')
      .insert({
        user_id: userId,
        initials,
        color: newLabelColor,
        name: newLabelName.trim() || null,
      })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setCookLabels((prev) => [...prev, data as CookLabel]);
    setAddLabelModalVisible(false);
    setNewLabelInitials('');
    setNewLabelName('');
    setNewLabelColor(LABEL_COLORS[0]);
    await handleSelectCook(data.id);
  }

  async function handleSelectCook(labelId: string) {
    const nextValue = selectedCookLabelId === labelId ? null : labelId;
    setSelectedCookLabelId(nextValue);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { error } = await supabase
      .from('planned_meals')
      .upsert(
        {
          user_id: userId,
          date,
          recipe_id: existingEntry?.recipeId ?? null,
          link_url: existingEntry?.linkUrl ?? null,
          link_title: existingEntry?.linkTitle ?? null,
          cook_label_id: nextValue,
        },
        { onConflict: 'user_id,date' }
      );

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setExistingEntry({
      recipeId: existingEntry?.recipeId ?? null,
      linkUrl: existingEntry?.linkUrl ?? null,
      linkTitle: existingEntry?.linkTitle ?? null,
      cookLabelId: nextValue,
    });
  }

  async function handleSelectRecipe(recipe: Recipe) {
    if (saving) return;
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSaving(false); return; }

    const { error } = await supabase
      .from('planned_meals')
      .upsert(
        {
          user_id: userId,
          date,
          recipe_id: recipe.id,
          link_url: null,
          link_title: null,
          cook_label_id: selectedCookLabelId,
        },
        { onConflict: 'user_id,date' }
      );

    if (error) {
      Alert.alert('Error', error.message);
      setSaving(false);
      return;
    }

    await syncMissingIngredients(recipe, userId);

    setSaving(false);
    router.back();
  }

  async function handleSaveLink() {
    const trimmedUrl = linkUrlInput.trim();
    const trimmedTitle = linkTitleInput.trim();
    if (!trimmedUrl) {
      Alert.alert('Enter a link', 'Paste a URL first.');
      return;
    }
    if (!trimmedTitle) {
      Alert.alert('Give it a title', 'Add a short name so you remember what this is.');
      return;
    }
    if (saving) return;
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSaving(false); return; }

    const { error } = await supabase
      .from('planned_meals')
      .upsert(
        {
          user_id: userId,
          date,
          recipe_id: null,
          link_url: trimmedUrl,
          link_title: trimmedTitle,
          cook_label_id: selectedCookLabelId,
        },
        { onConflict: 'user_id,date' }
      );

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    router.back();
  }

  async function handleClearDay() {
    Alert.alert('Clear this day?', 'This removes whatever is planned for this day.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;
          if (!userId) return;

          await supabase
            .from('planned_meals')
            .delete()
            .eq('user_id', userId)
            .eq('date', date);

          router.back();
        },
      },
    ]);
  }

  const filteredRecipes = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading || !fontsLoaded) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#3A3570" />
        </View>
      </>
    );
  }

  const cookPicker = (
    <View style={styles.cookSection}>
      <Text style={styles.linkLabel}>Who's cooking? (optional)</Text>
      <View style={styles.cookRow}>
        {cookLabels.map((label) => {
          const isSelected = selectedCookLabelId === label.id;
          return (
            <Pressable
              key={label.id}
              onPress={() => handleSelectCook(label.id)}
              style={[
                styles.cookCircle,
                { backgroundColor: label.color },
                isSelected && styles.cookCircleSelected,
              ]}
            >
              <Text style={styles.cookCircleText}>{label.initials}</Text>
            </Pressable>
          );
        })}
        <Pressable style={styles.addCookBtn} onPress={() => setAddLabelModalVisible(true)}>
          <Feather name="plus" size={16} color="#3A3570" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backIconBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#6B6049" />
          </Pressable>
          <Text style={styles.headerTitle}>Plan this day</Text>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeBtn, mode === 'recipe' && styles.modeBtnActive]}
            onPress={() => setMode('recipe')}
          >
            <Text style={[styles.modeBtnText, mode === 'recipe' && styles.modeBtnTextActive]}>
              Pick a recipe
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'link' && styles.modeBtnActive]}
            onPress={() => setMode('link')}
          >
            <Text style={[styles.modeBtnText, mode === 'link' && styles.modeBtnTextActive]}>
              Paste a link
            </Text>
          </Pressable>
        </View>

        {mode === 'recipe' ? (
          <>
            <View style={{ paddingHorizontal: 18 }}>{cookPicker}</View>
            <TextInput
              style={styles.search}
              placeholder="Search your recipes"
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              data={filteredRecipes}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 100 }}
              renderItem={({ item }) => {
                const isSelected = existingEntry?.recipeId === item.id;
                return (
                  <Pressable
                    style={[styles.recipeRow, isSelected && styles.recipeRowSelected]}
                    onPress={() => handleSelectRecipe(item)}
                    disabled={saving}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipeName}>{item.name}</Text>
                      <Text style={styles.recipeMeta}>{MEAL_LABELS[item.meal_type] ?? item.meal_type}</Text>
                    </View>
                    {isSelected && <Feather name="check" size={18} color="#3A3570" />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No recipes match your search.</Text>
              }
            />
          </>
        ) : (
          <View style={{ paddingHorizontal: 18 }}>
            {cookPicker}
            <Text style={styles.linkLabel}>Give it a title</Text>
            <TextInput
              style={styles.linkInput}
              placeholder="e.g. Korean beef bowls"
              value={linkTitleInput}
              onChangeText={setLinkTitleInput}
            />
            <Text style={styles.linkLabel}>Paste the link</Text>
            <TextInput
              style={styles.linkInput}
              placeholder="https://..."
              value={linkUrlInput}
              onChangeText={setLinkUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Pressable style={styles.saveLinkBtn} onPress={handleSaveLink} disabled={saving}>
              <Text style={styles.saveLinkBtnText}>{saving ? 'Saving...' : 'Save link'}</Text>
            </Pressable>
          </View>
        )}

        {existingEntry && (existingEntry.recipeId || existingEntry.linkUrl) && (
          <Pressable style={styles.clearBtn} onPress={handleClearDay}>
            <Feather name="x-circle" size={16} color="#FFFEFA" />
            <Text style={styles.clearBtnText}>Clear this day</Text>
          </Pressable>
        )}
      </View>

      <Modal visible={addLabelModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a cook</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Initials (e.g. T)"
              value={newLabelInitials}
              onChangeText={setNewLabelInitials}
              maxLength={2}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Name (optional)"
              value={newLabelName}
              onChangeText={setNewLabelName}
            />
            <Text style={styles.linkLabel}>Pick a color</Text>
            <View style={styles.colorRow}>
              {LABEL_COLORS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setNewLabelColor(color)}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    newLabelColor === color && styles.colorSwatchSelected,
                  ]}
                />
              ))}
            </View>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setAddLabelModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={handleCreateLabel}>
                <Text style={styles.modalConfirmText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA' },
  loadingContainer: { flex: 1, backgroundColor: '#FBF6EA', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 60,
    paddingBottom: 14,
  },
  backIconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '500', color: '#3A322A' },
  modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 14 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: '#3A3570', borderWidth: 0 },
  modeBtnText: { fontSize: 13, color: '#6B6049' },
  modeBtnTextActive: { color: '#FFFEFA', fontWeight: '500' },
  cookSection: { marginBottom: 14 },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cookCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookCircleSelected: { borderWidth: 2, borderColor: '#3A322A' },
  cookCircleText: { fontFamily: 'Fraunces_600SemiBold', fontSize: 14, color: '#FFFEFA' },
  addCookBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E2E0EE',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    height: 38,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 999,
    paddingHorizontal: 14,
    marginHorizontal: 18,
    marginBottom: 10,
    fontSize: 13,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  recipeRowSelected: { borderColor: '#3A3570', borderWidth: 1.5 },
  recipeName: { fontSize: 13, color: '#3A322A', fontWeight: '500' },
  recipeMeta: { fontSize: 11, color: '#9C9180', marginTop: 2 },
  emptyText: { fontSize: 13, color: '#9C9180', textAlign: 'center', marginTop: 20 },
  linkLabel: { fontSize: 12, color: '#6B6049', marginBottom: 6, marginTop: 4 },
  linkInput: {
    height: 44,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    marginBottom: 14,
  },
  saveLinkBtn: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  saveLinkBtnText: { color: '#FFFEFA', fontWeight: '500', fontSize: 14 },
  clearBtn: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#A32D2D',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  clearBtnText: { fontSize: 13, color: '#FFFEFA', fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  modalCard: { backgroundColor: '#FFFEFA', borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '500', color: '#3A322A', marginBottom: 14 },
  modalInput: {
    height: 42,
    backgroundColor: '#FBF6EA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    marginBottom: 10,
  },
  colorRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  colorSwatch: { width: 30, height: 30, borderRadius: 15 },
  colorSwatchSelected: { borderWidth: 2, borderColor: '#3A322A' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 0.5, borderColor: '#E2E0EE', alignItems: 'center' },
  modalCancelText: { fontSize: 13, color: '#6B6049' },
  modalConfirm: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: '#3A3570', alignItems: 'center' },
  modalConfirmText: { fontSize: 13, color: '#FFFEFA', fontWeight: '500' },
});