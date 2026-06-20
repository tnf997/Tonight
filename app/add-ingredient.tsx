import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const storageOptions: { label: string; value: 'cold' | 'frozen' | 'shelf' }[] = [
  { label: 'Cold', value: 'cold' },
  { label: 'Frozen', value: 'frozen' },
  { label: 'Shelf', value: 'shelf' },
];

export default function AddIngredientScreen() {
  const router = useRouter();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [name, setName] = useState(prefill ?? '');
  const [storage, setStorage] = useState<'cold' | 'frozen' | 'shelf' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if (submitting) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the ingredient a name first.');
      return;
    }
    if (!storage) {
      Alert.alert('Pick a location', 'Choose where this is stored: cold, frozen, or shelf.');
      return;
    }
    setSubmitting(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      Alert.alert('No user found', userError?.message ?? 'Unknown issue getting user');
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('pantry_items').insert({
      user_id: userId,
      item_name: name.trim(),
      category: 'CUSTOM',
      storage_location: storage,
      status: 'have',
    });

    if (insertError) {
      Alert.alert('Save failed', insertError.message);
      setSubmitting(false);
      return;
    }

    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={20} color="#6B6049" />
        </Pressable>
        <Text style={styles.headerTitle}>Add an ingredient</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.body}>
        <TextInput
          style={styles.input}
          placeholder="Ingredient name"
          value={name}
          onChangeText={setName}
          autoFocus
          returnKeyType="done"
          blurOnSubmit
        />

        <Text style={styles.sectionLabel}>WHERE IS IT STORED?</Text>
        <View style={styles.chipRow}>
          {storageOptions.map((opt) => {
            const isSelected = storage === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setStorage(opt.value)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={submitting}>
          <Text style={styles.saveBtnText}>{submitting ? 'Saving...' : 'Add to pantry'}</Text>
        </Pressable>
      </View>
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
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 16, fontWeight: '500', color: '#3A322A' },
  body: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  input: {
    height: 38,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#3A322A',
    marginBottom: 24,
  },
  sectionLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, color: '#6B6049', marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
  },
  chipSelected: { backgroundColor: '#EAF3DE', borderWidth: 0 },
  chipText: { fontSize: 12, color: '#6B6049' },
  chipTextSelected: { color: '#3B6D11' },
  saveBtn: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFFEFA', fontWeight: '500', fontSize: 13 },
});