import { pantryCategories } from '@/constants/pantry-items';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function OnboardingScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function toggle(name: string) {
    const next = new Set(selected);
    next.has(name) ? next.delete(name) : next.add(name);
    setSelected(next);
  }

  async function handleContinue() {
    if (submitting) return;
    setSubmitting(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      Alert.alert('No user found', userError?.message ?? 'Unknown issue getting user');
      router.replace('/(tabs)');
      return;
    }

    const rows: { user_id: string; item_name: string; category: string; storage_location: string; status: string }[] = [];
    for (const cat of pantryCategories) {
      for (const item of cat.items) {
        if (selected.has(item.name)) {
          rows.push({
            user_id: userId,
            item_name: item.name,
            category: cat.name,
            storage_location: item.storage,
            status: 'have',
          });
        }
      }
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('pantry_items').insert(rows);
      if (insertError) {
        Alert.alert('Save failed', insertError.message);
        setSubmitting(false);
        return;
      }
    }

    await supabase.from('recipes').insert({
      user_id: userId,
      name: 'Easy Cheesy Raviolis',
      time_minutes: 20,
      servings: 4,
      tags: [],
      ingredients: [
        { name: "Rao's Marinara", amount: '1 jar' },
        { name: "Breakstone's cottage cheese", amount: '1/2 container' },
        { name: 'Ground beef', amount: '1 lb' },
        { name: 'Great Value cheese stuffed raviolis', amount: '1 bag' },
      ],
      steps: [
        'Blend the marinara and cottage cheese together.',
        'Brown the ground beef, then stir it into the marinara and cottage cheese mixture.',
        'Boil the raviolis according to the package instructions.',
        'Add the cooked raviolis to the meat sauce and combine.',
      ],
      is_example: true,
    });

    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Build your pantry</Text>
      <Text style={styles.subtitle}>Tap what you usually have on hand</Text>

      <TextInput
        style={styles.search}
        placeholder="Search ingredients"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView style={{ flex: 1 }}>
        {pantryCategories.map((cat) => (
          <View key={cat.name} style={{ marginBottom: 14 }}>
            <Text style={styles.categoryLabel}>{cat.name}</Text>
            <View style={styles.chipRow}>
              {cat.items
                .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
                .map((item) => {
                  const isSelected = selected.has(item.name);
                  return (
                    <Pressable
                      key={item.name}
                      onPress={() => toggle(item.name)}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.count}>{selected.size} selected</Text>
        <Pressable style={styles.continueBtn} onPress={handleContinue} disabled={submitting}>
          <Text style={styles.continueText}>{submitting ? 'Saving...' : 'Continue'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA', paddingTop: 60 },
  title: { fontSize: 19, fontWeight: '500', color: '#3A322A', paddingHorizontal: 18 },
  subtitle: { fontSize: 12, color: '#9C9180', paddingHorizontal: 18, marginTop: 4, marginBottom: 12 },
  search: {
    height: 36,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 999,
    paddingHorizontal: 14,
    marginHorizontal: 18,
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B6049',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingHorizontal: 18,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 18 },
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFEFA',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E0EE',
  },
  count: { fontSize: 12, color: '#6B6049' },
  continueBtn: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  continueText: { color: '#FFFEFA', fontWeight: '500', fontSize: 13 },
});