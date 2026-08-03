import { supabase } from '@/lib/supabase';
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

type Favorite = {
  id: string;
  name: string;
  period_length: number;
};

type FavoriteDayPreview = {
  day_index: number;
  recipeName: string;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PlannerFavoritesScreen() {
  const router = useRouter();
  const { periodStartKeys, periodLength } = useLocalSearchParams<{ periodStartKeys: string; periodLength: string }>();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasPlannedDays, setHasPlannedDays] = useState(false);
  const [previewFavorite, setPreviewFavorite] = useState<Favorite | null>(null);
  const [previewDays, setPreviewDays] = useState<FavoriteDayPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const dateKeys: string[] = periodStartKeys ? JSON.parse(periodStartKeys) : [];
  const currentPeriodLength = periodLength ? parseInt(periodLength, 10) : 1;

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) { setLoading(false); return; }

      const { data } = await supabase
        .from('meal_plan_favorites')
        .select('id, name, period_length')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data) setFavorites(data as Favorite[]);

      if (dateKeys.length > 0) {
        const { data: planned } = await supabase
          .from('planned_meals')
          .select('recipe_id')
          .eq('user_id', userId)
          .in('date', dateKeys)
          .not('recipe_id', 'is', null);
        setHasPlannedDays((planned ?? []).length > 0);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleOpenPreview(favorite: Favorite) {
    setPreviewFavorite(favorite);
    setPreviewLoading(true);

    const { data: favoriteDays } = await supabase
      .from('meal_plan_favorite_days')
      .select('day_index, recipes ( name )')
      .eq('favorite_id', favorite.id)
      .order('day_index', { ascending: true });

    const preview: FavoriteDayPreview[] = (favoriteDays ?? []).map((row: any) => ({
      day_index: row.day_index,
      recipeName: row.recipes?.name ?? 'Unknown recipe',
    }));

    setPreviewDays(preview);
    setPreviewLoading(false);
  }

  function closePreview() {
    setPreviewFavorite(null);
    setPreviewDays([]);
  }

  async function handleSaveFavorite() {
    const name = newFavoriteName.trim();
    if (!name) {
      Alert.alert('Name required', 'Give this lineup a name.');
      return;
    }
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSaving(false); return; }

    const { data: plannedRows } = await supabase
      .from('planned_meals')
      .select('date, recipe_id')
      .eq('user_id', userId)
      .in('date', dateKeys)
      .not('recipe_id', 'is', null);

    if (!plannedRows || plannedRows.length === 0) {
      Alert.alert('Nothing to save', 'Plan at least one day with a recipe first.');
      setSaving(false);
      return;
    }

    const { data: favorite, error: favError } = await supabase
      .from('meal_plan_favorites')
      .insert({ user_id: userId, name, period_length: currentPeriodLength })
      .select()
      .single();

    if (favError || !favorite) {
      Alert.alert('Error', favError?.message ?? 'Could not save favorite.');
      setSaving(false);
      return;
    }

    const dayRows = plannedRows.map((row: any) => ({
      favorite_id: favorite.id,
      day_index: dateKeys.indexOf(row.date),
      recipe_id: row.recipe_id,
    }));

    const { error: daysError } = await supabase
      .from('meal_plan_favorite_days')
      .insert(dayRows);

    setSaving(false);

    if (daysError) {
      Alert.alert('Error', daysError.message);
      return;
    }

    setSaveModalVisible(false);
    setNewFavoriteName('');
    setFavorites((prev) => [{ id: favorite.id, name: favorite.name, period_length: favorite.period_length }, ...prev]);
    Alert.alert('Saved!', `"${name}" has been saved to your favorites.`);
  }

  async function handleApplyFavorite(favoriteId: string) {
    if (dateKeys.length === 0) {
      Alert.alert('No period selected', 'Go back to the planner and try again.');
      return;
    }

    const { data: favoriteDays } = await supabase
      .from('meal_plan_favorite_days')
      .select('day_index, recipe_id')
      .eq('favorite_id', favoriteId);

    if (!favoriteDays || favoriteDays.length === 0) {
      Alert.alert('Empty favorite', 'This favorite has no saved days.');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    for (const day of favoriteDays) {
      const targetDate = dateKeys[day.day_index];
      if (!targetDate) continue;

      await supabase
        .from('planned_meals')
        .upsert(
          { user_id: userId, date: targetDate, recipe_id: day.recipe_id, link_url: null, link_title: null },
          { onConflict: 'user_id,date' }
        );
    }

    Alert.alert(
      'Applied!',
      'This favorite has been applied to your current period. You can still edit any individual day.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  }

  async function handleDeleteFavorite(favoriteId: string, name: string) {
    Alert.alert('Delete favorite?', `Remove "${name}" from your favorites? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('meal_plan_favorites').delete().eq('id', favoriteId);
          setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
        },
      },
    ]);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#3A3570" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backIconBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#6B6049" />
          </Pressable>
          <Text style={styles.headerTitle}>Favorites</Text>
          <View style={{ width: 34 }} />
        </View>

        <Pressable
          style={[styles.saveCurrentBtn, !hasPlannedDays && styles.saveCurrentBtnDisabled]}
          onPress={() => setSaveModalVisible(true)}
          disabled={!hasPlannedDays}
        >
          <Feather name="star" size={16} color="#FFFEFA" />
          <Text style={styles.saveCurrentBtnText}>Save this period as a favorite</Text>
        </Pressable>
        {!hasPlannedDays && (
          <Text style={styles.helperText}>Plan at least one day in this period to save it as a favorite.</Text>
        )}

        <Text style={styles.sectionLabel}>YOUR FAVORITES</Text>

        {favorites.length === 0 ? (
          <Text style={styles.emptyText}>You haven't saved any favorites yet.</Text>
        ) : (
          <FlatList
            data={favorites}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable style={styles.favoriteRow} onPress={() => handleOpenPreview(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.favoriteName}>{item.name}</Text>
                  <Text style={styles.favoriteMeta}>{item.period_length} week{item.period_length > 1 ? 's' : ''}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#B0A790" />
                <Pressable style={styles.deleteIconBtn} onPress={() => handleDeleteFavorite(item.id, item.name)}>
                  <Feather name="trash-2" size={18} color="#9C9180" />
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </View>

      <Modal visible={!!previewFavorite} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{previewFavorite?.name}</Text>
            {previewLoading ? (
              <ActivityIndicator color="#3A3570" style={{ marginVertical: 20 }} />
            ) : (
              <View style={{ marginBottom: 20 }}>
                {previewDays.map((day) => (
                  <View key={day.day_index} style={styles.previewRow}>
                    <Text style={styles.previewDayLabel}>{DAY_NAMES[day.day_index % 7]}</Text>
                    <Text style={styles.previewRecipeName}>{day.recipeName}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={closePreview}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={() => {
                  if (previewFavorite) handleApplyFavorite(previewFavorite.id);
                  closePreview();
                }}
              >
                <Text style={styles.modalConfirmText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={saveModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name this favorite</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Busy week, Meal-prep heavy"
              value={newFavoriteName}
              onChangeText={setNewFavoriteName}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setSaveModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={handleSaveFavorite} disabled={saving}>
                <Text style={styles.modalConfirmText}>{saving ? 'Saving...' : 'Save'}</Text>
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
  saveCurrentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#85B7EB',
    borderRadius: 999,
    paddingVertical: 13,
    marginHorizontal: 18,
    marginBottom: 6,
  },
  saveCurrentBtnDisabled: { opacity: 0.4 },
  saveCurrentBtnText: { color: '#FFFEFA', fontWeight: '500', fontSize: 13 },
  helperText: { fontSize: 11, color: '#9C9180', textAlign: 'center', marginBottom: 14, paddingHorizontal: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, color: '#6B6049', paddingHorizontal: 18, marginTop: 16, marginBottom: 10 },
  emptyText: { fontSize: 13, color: '#9C9180', textAlign: 'center', marginTop: 20, paddingHorizontal: 18 },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  favoriteName: { fontSize: 14, fontWeight: '500', color: '#3A322A' },
  favoriteMeta: { fontSize: 11, color: '#9C9180', marginTop: 2 },
  deleteIconBtn: { padding: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  modalCard: { backgroundColor: '#FFFEFA', borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '500', color: '#3A322A', marginBottom: 14 },
  modalInput: {
    height: 44,
    backgroundColor: '#FBF6EA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    marginBottom: 20,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E0EE',
  },
  previewDayLabel: { fontSize: 12, color: '#9C9180', fontWeight: '500' },
  previewRecipeName: { fontSize: 13, color: '#3A322A', flex: 1, textAlign: 'right', marginLeft: 12 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 0.5, borderColor: '#E2E0EE', alignItems: 'center' },
  modalCancelText: { fontSize: 13, color: '#6B6049' },
  modalConfirm: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: '#3A3570', alignItems: 'center' },
  modalConfirmText: { fontSize: 13, color: '#FFFEFA', fontWeight: '500' },
});