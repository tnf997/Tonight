import CookingLoader from '@/components/CookingLoader';
import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const availableTags = ['Gluten-free', 'Vegetarian', 'Quick'];
const mealTypes = [
  { label: 'Dinner', value: 'dinner' },
  { label: 'Dessert', value: 'dessert' },
  { label: 'Appetizer/Snack', value: 'appetizer' },
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
];

type IngredientRow = { id: string; name: string; amount: string };
type StepRow = { id: string; text: string };
type Mode = 'choose' | 'manual' | 'paste' | 'photo';

const SUPABASE_FUNCTION_URL = `https://zeygfnojyyajgmrfwqsh.supabase.co/functions/v1/parse-recipe`;

export default function AddRecipeScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditMode = !!editId;

  const [mode, setMode] = useState<Mode>(isEditMode ? 'manual' : 'choose');
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  const [parsing, setParsing] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('dinner');
  const [timeMinutes, setTimeMinutes] = useState('');
  const [servings, setServings] = useState('');
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ id: '1', name: '', amount: '' }]);
  const [steps, setSteps] = useState<StepRow[]>([{ id: '1', text: '' }]);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;
    async function loadExisting() {
      const { data } = await supabase.from('recipes').select('*').eq('id', editId).single();
      if (data) {
        setName(data.name ?? '');
        setMealType(data.meal_type ?? 'dinner');
        setTimeMinutes(data.time_minutes != null ? String(data.time_minutes) : '');
        setServings(data.servings != null ? String(data.servings) : '');
        setTags(new Set(data.tags ?? []));
        const loadedIngredients = (data.ingredients ?? []).map((ing: any, i: number) => ({
          id: `existing-${i}`,
          name: ing.name ?? '',
          amount: ing.amount ?? '',
        }));
        setIngredients(loadedIngredients.length > 0 ? loadedIngredients : [{ id: '1', name: '', amount: '' }]);
        const loadedSteps = (data.steps ?? []).map((text: string, i: number) => ({
          id: `existing-${i}`,
          text,
        }));
        setSteps(loadedSteps.length > 0 ? loadedSteps : [{ id: '1', text: '' }]);
        setCalories(data.calories != null ? String(data.calories) : '');
        setProtein(data.protein_g != null ? String(data.protein_g) : '');
        setCarbs(data.carbs_g != null ? String(data.carbs_g) : '');
        setFat(data.fat_g != null ? String(data.fat_g) : '');
        setExistingPhotoUrl(data.photo_url ?? null);
      }
      setLoadingExisting(false);
    }
    loadExisting();
  }, [editId, isEditMode]);

  function fillFormFromParsed(parsed: any) {
    if (parsed.name) setName(parsed.name);
    if (parsed.time_minutes) setTimeMinutes(String(parsed.time_minutes));
    if (parsed.servings) setServings(String(parsed.servings));
    if (Array.isArray(parsed.ingredients)) {
      setIngredients(
        parsed.ingredients.map((ing: any, i: number) => ({
          id: `ai-${i}`,
          name: ing.name ?? '',
          amount: ing.amount ?? '',
        }))
      );
    }
    if (Array.isArray(parsed.steps)) {
      setSteps(
        parsed.steps.map((step: string, i: number) => ({
          id: `ai-${i}`,
          text: step,
        }))
      );
    }
    setMode('manual');
  }

  async function handleParseText() {
    if (!pasteText.trim()) {
      Alert.alert('Nothing to parse', 'Paste a recipe first.');
      return;
    }
    setParsing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text: pasteText }),
      });
      const parsed = await response.json();
      if (parsed.error) throw new Error(parsed.error);
      fillFormFromParsed(parsed);
    } catch (err: any) {
      Alert.alert('Parse failed', err.message ?? 'Could not extract recipe. Try again or enter manually.');
    } finally {
      setParsing(false);
    }
  }

 async function handleParsePhoto() {
    Alert.alert(
      'Add recipe from photo',
      'Choose how to add your photo',
      [
        {
          text: 'Take a photo',
          onPress: async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              Alert.alert('Permission needed', 'Please allow camera access in Settings.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              await processImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from library',
          onPress: async () => {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              await processImage(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  async function processImage(uri: string) {
    setParsing(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const apiResponse = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const parsed = await apiResponse.json();
      if (parsed.error) throw new Error(parsed.error);
      fillFormFromParsed(parsed);
    } catch (err: any) {
      Alert.alert('Parse failed', err.message ?? 'Could not read recipe from photo. Try again or enter manually.');
    } finally {
      setParsing(false);
    }
  }

  function toggleTag(tag: string) {
    const next = new Set(tags);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    setTags(next);
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { id: Date.now().toString(), name: '', amount: '' }]);
  }

  function updateIngredient(id: string, field: 'name' | 'amount', value: string) {
    setIngredients((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function addStep() {
    setSteps((prev) => [...prev, { id: Date.now().toString(), text: '' }]);
  }

  function updateStep(id: string, value: string) {
    setSteps((prev) => prev.map((row) => (row.id === id ? { ...row, text: value } : row)));
  }

  function parseOptionalInt(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Photo too large', 'Please choose a photo under 5MB.');
        return;
      }
      setPhotoUri(asset.uri);
    }
  }

  async function uploadPhoto(userId: string): Promise<string | null> {
    if (!photoUri) return existingPhotoUrl;
    try {
      const response = await fetch(photoUri);
      const blob = await response.blob();
      if (blob.size > 5 * 1024 * 1024) {
        Alert.alert('Photo too large', 'Please choose a photo under 5MB.');
        return existingPhotoUrl;
      }
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const fileName = `${userId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('recipe-photos')
        .upload(fileName, uint8Array, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('recipe-photos').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err: any) {
      Alert.alert('Upload error', err?.message ?? 'Photo upload failed.');
      return null;
    }
  }

  async function handleSave() {
    if (submitting) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your recipe a name before saving.');
      return;
    }
    setSubmitting(true);

    const ingredientsPayload = ingredients
      .filter((row) => row.name.trim())
      .map((row) => ({ name: row.name.trim(), amount: row.amount.trim() }));
    const stepsPayload = steps.filter((row) => row.text.trim()).map((row) => row.text.trim());

    const payload = {
      name: name.trim(),
      meal_type: mealType,
      time_minutes: parseOptionalInt(timeMinutes),
      servings: parseOptionalInt(servings),
      tags: Array.from(tags),
      ingredients: ingredientsPayload,
      steps: stepsPayload,
      calories: parseOptionalInt(calories),
      protein_g: parseOptionalInt(protein),
      carbs_g: parseOptionalInt(carbs),
      fat_g: parseOptionalInt(fat),
    };

    if (isEditMode) {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) { setSubmitting(false); return; }
      const photoUrl = await uploadPhoto(userId);
      const { error } = await supabase.from('recipes').update({ ...payload, photo_url: photoUrl }).eq('id', editId);
      if (error) { Alert.alert('Save failed', error.message); setSubmitting(false); return; }
    } else {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) { Alert.alert('No user found', userError?.message ?? 'Unknown error'); setSubmitting(false); return; }
      const photoUrl = await uploadPhoto(userId);
      const { error } = await supabase.from('recipes').insert({ ...payload, user_id: userId, photo_url: photoUrl });
      if (error) { Alert.alert('Save failed', error.message); setSubmitting(false); return; }
    }

    router.back();
  }

  const displayPhoto = photoUri ?? existingPhotoUrl;

  if (loadingExisting || parsing) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <CookingLoader />
        {parsing && <Text style={styles.parsingText}>Reading your recipe...</Text>}
      </View>
    );
  }

  if (mode === 'choose') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Feather name="x" size={20} color="#6B6049" />
          </Pressable>
          <Text style={styles.headerTitle}>Add a recipe</Text>
          <View style={{ width: 20 }} />
        </View>
        <View style={styles.chooseContainer}>
          <Text style={styles.chooseTitle}>How do you want to add it?</Text>

          <Pressable style={styles.chooseCard} onPress={() => setMode('manual')}>
            <Feather name="edit-3" size={22} color="#3A3570" />
            <View style={{ flex: 1 }}>
              <Text style={styles.chooseCardTitle}>Type it in</Text>
              <Text style={styles.chooseCardSub}>Fill out the recipe form yourself</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#B0A790" />
          </Pressable>

          <Pressable style={styles.chooseCard} onPress={() => setMode('paste')}>
            <Feather name="clipboard" size={22} color="#3A3570" />
            <View style={{ flex: 1 }}>
              <Text style={styles.chooseCardTitle}>Paste recipe text</Text>
              <Text style={styles.chooseCardSub}>Copy from a website or notes and we'll fill it in</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#B0A790" />
          </Pressable>

          <Pressable style={styles.chooseCard} onPress={handleParsePhoto}>
            <Feather name="camera" size={22} color="#3A3570" />
            <View style={{ flex: 1 }}>
              <Text style={styles.chooseCardTitle}>Take a photo</Text>
              <Text style={styles.chooseCardSub}>Snap a recipe card or cookbook page</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#B0A790" />
          </Pressable>
        </View>
      </View>
    );
  }

  if (mode === 'paste') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => setMode('choose')}>
            <Feather name="arrow-left" size={20} color="#6B6049" />
          </Pressable>
          <Text style={styles.headerTitle}>Paste recipe</Text>
          <View style={{ width: 20 }} />
        </View>
        <KeyboardAwareScrollView
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40, flex: 1 }}
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={20}
        >
          <Text style={styles.pasteLabel}>
            Copy a recipe from anywhere — a website, notes app, message — and paste it below.
          </Text>
          <TextInput
            style={styles.pasteInput}
            placeholder="Paste recipe text here..."
            value={pasteText}
            onChangeText={setPasteText}
            multiline
            textAlignVertical="top"
            autoFocus
          />
          <Pressable style={styles.saveBtn} onPress={handleParseText} disabled={parsing}>
            <Text style={styles.saveBtnText}>Extract recipe</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => isEditMode ? router.back() : setMode('choose')}>
          <Feather name={isEditMode ? 'x' : 'arrow-left'} size={20} color="#6B6049" />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit recipe' : 'Add a recipe'}</Text>
        <View style={{ width: 20 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
      >
        <Pressable style={styles.photoBox} onPress={pickPhoto}>
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto }} style={styles.photoPreview} />
          ) : (
            <>
              <Feather name="camera" size={18} color="#B0A790" />
              <Text style={styles.photoText}>Add a photo</Text>
            </>
          )}
        </Pressable>

        {displayPhoto && (
          <Pressable onPress={() => { setPhotoUri(null); setExistingPhotoUrl(null); }} style={styles.removePhoto}>
            <Text style={styles.removePhotoText}>Remove photo</Text>
          </Pressable>
        )}

        <TextInput style={styles.input} placeholder="Recipe name" value={name} onChangeText={setName} />

        <Text style={styles.sectionLabel}>MEAL TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={styles.mealTypeRow}>
            {mealTypes.map((mt) => {
              const isSelected = mealType === mt.value;
              return (
                <Pressable
                  key={mt.value}
                  onPress={() => setMealType(mt.value)}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{mt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="25 min"
            value={timeMinutes}
            onChangeText={setTimeMinutes}
            keyboardType="number-pad"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="4 servings"
            value={servings}
            onChangeText={setServings}
            keyboardType="number-pad"
          />
        </View>

        <Text style={styles.sectionLabel}>TAGS</Text>
        <View style={styles.chipRow}>
          {availableTags.map((tag) => {
            const isSelected = tags.has(tag);
            return (
              <Pressable key={tag} onPress={() => toggleTag(tag)} style={[styles.chip, isSelected && styles.chipSelected]}>
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>INGREDIENTS</Text>
        {ingredients.map((row) => (
          <View key={row.id} style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder="Ingredient"
              value={row.name}
              onChangeText={(v) => updateIngredient(row.id, 'name', v)}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Amount"
              value={row.amount}
              onChangeText={(v) => updateIngredient(row.id, 'amount', v)}
            />
          </View>
        ))}
        <Pressable onPress={addIngredient} style={styles.addRow}>
          <Feather name="plus" size={14} color="#3A3570" />
          <Text style={styles.addRowText}>Add ingredient</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>STEPS</Text>
        {steps.map((row, index) => (
          <TextInput
            key={row.id}
            style={[styles.input, { marginBottom: 6 }]}
            placeholder={`Step ${index + 1}`}
            value={row.text}
            onChangeText={(v) => updateStep(row.id, v)}
          />
        ))}
        <Pressable onPress={addStep} style={styles.addRow}>
          <Feather name="plus" size={14} color="#3A3570" />
          <Text style={styles.addRowText}>Add step</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>MACROS (OPTIONAL)</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Calories" value={calories} onChangeText={setCalories} keyboardType="number-pad" />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="number-pad" />
        </View>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="number-pad" />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Fat (g)" value={fat} onChangeText={setFat} keyboardType="number-pad" />
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={submitting}>
          <Text style={styles.saveBtnText}>
            {submitting ? 'Saving...' : isEditMode ? 'Save changes' : 'Save recipe'}
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '500', color: '#3A322A' },
  chooseContainer: { flex: 1, paddingHorizontal: 18, paddingTop: 24 },
  chooseTitle: { fontSize: 18, fontWeight: '500', color: '#3A322A', marginBottom: 20 },
  chooseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  chooseCardTitle: { fontSize: 14, fontWeight: '500', color: '#3A322A' },
  chooseCardSub: { fontSize: 12, color: '#9C9180', marginTop: 2 },
  pasteLabel: { fontSize: 13, color: '#6B6049', lineHeight: 19, marginBottom: 12, marginTop: 4 },
  pasteInput: {
    flex: 1,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 12,
    padding: 14,
    color: '#3A322A',
    fontSize: 13,
    marginBottom: 12,
    maxHeight: 400,
  },
  parsingText: { fontSize: 13, color: '#9C9180', marginTop: 12 },
  photoBox: {
    height: 160,
    borderWidth: 1.5,
    borderColor: '#D9CDB3',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoText: { fontSize: 11, color: '#B0A790' },
  removePhoto: { alignItems: 'center', marginBottom: 10 },
  removePhotoText: { fontSize: 12, color: '#A32D2D' },
  input: {
    height: 38,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#3A322A',
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8 },
  mealTypeRow: { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: '#6B6049',
    marginTop: 8,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
  },
  chipSelected: { backgroundColor: '#EAF3DE', borderWidth: 0 },
  chipText: { fontSize: 12, color: '#6B6049' },
  chipTextSelected: { color: '#3B6D11' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, marginBottom: 6 },
  addRowText: { fontSize: 12, color: '#3A3570' },
  saveBtn: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: '#FFFEFA', fontWeight: '500', fontSize: 13 },
});