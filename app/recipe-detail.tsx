import CookingLoader from '@/components/CookingLoader';
import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Recipe = {
  id: string;
  name: string;
  time_minutes: number | null;
  servings: number | null;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
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

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [pantryNames, setPantryNames] = useState<string[]>([]);
  const isFromHome = source === 'home';
  const isFromFeed = source === 'feed';

  useEffect(() => {
    async function fetchRecipe() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const [{ data }, pantryResult] = await Promise.all([
        supabase
          .from('recipes')
          .select('id, name, time_minutes, servings, ingredients, steps, calories, protein_g, carbs_g, fat_g')
          .eq('id', id)
          .single(),
        userId
          ? supabase.from('pantry_items').select('item_name').eq('user_id', userId).eq('status', 'have')
          : Promise.resolve({ data: [] as any[] }),
      ]);

      if (data) setRecipe(data as Recipe);
      setPantryNames((pantryResult.data ?? []).map((row: any) => normalize(row.item_name)));
    }
    if (id) fetchRecipe();
  }, [id]);

  if (!recipe) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <CookingLoader />
      </View>
    );
  }

  const macros = [
    recipe.calories != null ? `${recipe.calories} cal` : null,
    recipe.protein_g != null ? `${recipe.protein_g}g protein` : null,
    recipe.carbs_g != null ? `${recipe.carbs_g}g carbs` : null,
    recipe.fat_g != null ? `${recipe.fat_g}g fat` : null,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={32} color="#6B6049" />
        </Pressable>
        {isFromHome ? (
          <Text style={styles.tonightLabel}>Tonight</Text>
        ) : (
          <View style={{ width: 48 }} />
        )}
        {isFromHome || isFromFeed ? (
          <View style={{ width: 48 }} />
        ) : (
          <Pressable style={styles.headerBtn} onPress={() => router.push(`/modal?editId=${recipe.id}` as any)}>
            <Feather name="edit-2" size={30} color="#3A3570" />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text style={styles.name}>{recipe.name}</Text>
        <Text style={styles.meta}>
          {recipe.time_minutes != null ? `${recipe.time_minutes} min` : ''}
          {recipe.servings != null ? `  ·  ${recipe.servings} servings` : ''}
        </Text>

        {macros.length > 0 && <Text style={styles.macros}>{macros.join(' · ')}</Text>}

        <Text style={styles.sectionLabel}>INGREDIENTS</Text>
        {recipe.ingredients.map((ing, i) => {
          const missing = !ingredientIsAvailable(ing.name, pantryNames);
          return (
            <Text key={i} style={[styles.bodyText, missing && styles.missingText]}>
              • {ing.name}{ing.amount ? ` — ${ing.amount}` : ''}
            </Text>
          );
        })}

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>STEPS</Text>
        {recipe.steps.map((step, i) => (
          <Text key={i} style={styles.bodyText}>
            {i + 1}. {step}
          </Text>
        ))}
      </ScrollView>
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
    paddingTop: 60,
    paddingBottom: 14,
  },
  headerBtn: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  tonightLabel: { fontSize: 13, color: '#9C9180' },
  name: { fontSize: 24, fontWeight: '500', color: '#3A322A', marginBottom: 4 },
  meta: { fontSize: 13, color: '#9C9180', marginBottom: 6 },
  macros: { fontSize: 13, color: '#6B6049', marginBottom: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, color: '#6B6049' },
  bodyText: { fontSize: 14, color: '#3A322A', marginTop: 6, lineHeight: 20 },
  missingText: { color: '#A32D2D', fontWeight: '500' },
});