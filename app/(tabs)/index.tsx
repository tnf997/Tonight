import { getOptimizedPhotoUrl, supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ImageBackground,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Recipe = {
  id: string;
  name: string;
  time_minutes: number | null;
  servings: number | null;
  tags: string[];
  ingredients: { name: string; amount: string }[];
  steps: string[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  photo_url: string | null;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.22;

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

const BG = require('../../assets/images/home-bg.png');

export default function HomeScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [totalRecipeCount, setTotalRecipeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const flippedRef = useRef(false);
  flippedRef.current = flipped;

  const recipesRef = useRef<Recipe[]>([]);
  recipesRef.current = recipes;

  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;

  const position = useRef(new Animated.ValueXY()).current;

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setLoading(false); return; }

    const [pantryResult, recipesResult] = await Promise.all([
      supabase.from('pantry_items').select('item_name').eq('user_id', userId).eq('status', 'have'),
      supabase
        .from('recipes')
        .select('id, name, time_minutes, servings, tags, ingredients, steps, calories, protein_g, carbs_g, fat_g, photo_url')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    const pantryNames = (pantryResult.data ?? []).map((row) => normalize(row.item_name));
    const allRecipes = (recipesResult.data ?? []) as Recipe[];
    const makeable = allRecipes.filter((recipe) =>
      recipe.ingredients.every((ing) => ingredientIsAvailable(ing.name, pantryNames))
    );

    setTotalRecipeCount(allRecipes.length);
    setRecipes(makeable);
    setCurrentIndex(0);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchRecipes(); }, [fetchRecipes]));

  useEffect(() => {
    const list = recipesRef.current;
    list.forEach((recipe) => {
      if (recipe.photo_url) Image.prefetch(getOptimizedPhotoUrl(recipe.photo_url));
    });
  }, [recipes]);

  function resetPosition() {
    Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  }

  function advanceCard(picked: boolean) {
    const list = recipesRef.current;
    const index = currentIndexRef.current;
    const pickedRecipe = list[index];
    position.setValue({ x: 0, y: 0 });
    setFlipped(false);
    setCurrentIndex((prev) => (prev + 1 < list.length ? prev + 1 : 0));
    if (picked && pickedRecipe) {
      router.push(`/recipe-detail?id=${pickedRecipe.id}&source=home` as any);
    }
  }

  function swipeOff(direction: 'left' | 'right') {
    Animated.timing(position, {
      toValue: { x: direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => advanceCard(direction === 'right'));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !flippedRef.current,
      onMoveShouldSetPanResponder: () => !flippedRef.current,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeOff('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeOff('left');
        } else if (Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
          setFlipped(true);
          resetPosition();
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  if (loading) {
    return (
      <ImageBackground source={BG} style={styles.container} resizeMode="cover">
        <ActivityIndicator color="#F2E9D8" />
      </ImageBackground>
    );
  }

  if (recipes.length === 0) {
    return (
      <ImageBackground source={BG} style={styles.container} resizeMode="cover">
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {totalRecipeCount === 0 ? 'No recipes yet' : 'Nothing matches your pantry right now'}
          </Text>
          <Text style={styles.emptyText}>
            {totalRecipeCount === 0
              ? 'Tap the + button to add your first recipe.'
              : "Check your pantry, or add a recipe you can make with what's on hand."}
          </Text>
        </View>
      </ImageBackground>
    );
  }

  const current = recipes[currentIndex];

  return (
    <ImageBackground source={BG} style={styles.container} resizeMode="cover">
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          {
            transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
          },
        ]}
      >
        {!flipped ? (
          <View style={styles.cardInner}>
            {current.photo_url ? (
              <Image
                source={{ uri: getOptimizedPhotoUrl(current.photo_url) }}
                style={styles.photoArea}
                cachePolicy="memory-disk"
                transition={0}
              />
            ) : (
              <View style={styles.photoArea} />
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.recipeName}>{current.name}</Text>
              <Text style={styles.recipeMeta}>
                {current.tags.length > 0 ? current.tags.join(' · ') + ' · ' : ''}
                {current.time_minutes != null ? `${current.time_minutes} min` : ''}
              </Text>
              <Text style={styles.tapHint}>tap for recipe</Text>
            </View>
          </View>
        ) : (
          <View style={styles.cardInner}>
            <View style={styles.backHeader}>
              <Pressable style={styles.flipBackBtn} onPress={() => setFlipped(false)}>
                <Feather name="chevron-left" size={18} color="#3A3570" />
              </Pressable>
              <Text style={styles.backName}>{current.name}</Text>
            </View>
            {(current.calories || current.protein_g || current.carbs_g || current.fat_g) && (
              <Text style={styles.backMacros}>
                {[
                  current.calories != null ? `${current.calories} cal` : null,
                  current.protein_g != null ? `${current.protein_g}g protein` : null,
                  current.carbs_g != null ? `${current.carbs_g}g carbs` : null,
                  current.fat_g != null ? `${current.fat_g}g fat` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
            <ScrollView style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>INGREDIENTS</Text>
              {current.ingredients.map((ing, i) => (
                <Text key={i} style={styles.bodyText}>
                  • {ing.name}{ing.amount ? ` — ${ing.amount}` : ''}
                </Text>
              ))}
              <Text style={[styles.sectionLabel, { marginTop: 10 }]}>STEPS</Text>
              {current.steps.map((step, i) => (
                <Text key={i} style={styles.bodyText}>
                  {i + 1}. {step}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>

      <Text style={styles.swipeHint}>← skip · pick for tonight →</Text>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    backgroundColor: 'rgba(30,26,56,0.75)',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 30,
    alignItems: 'center',
  },
  card: {
    width: SCREEN_WIDTH * 0.8,
    height: 420,
    backgroundColor: '#FFFEFA',
    borderRadius: 20,
  },
  cardInner: { flex: 1, padding: 14 },
  photoArea: { flex: 1, backgroundColor: '#ECE4D3', borderRadius: 14 },
  cardFooter: { paddingTop: 12 },
  recipeName: { fontSize: 18, fontWeight: '500', color: '#3A322A' },
  recipeMeta: { fontSize: 12, color: '#9C9180', marginTop: 4 },
  tapHint: { fontSize: 10, color: '#B0A790', textAlign: 'center', marginTop: 10 },
  backHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backName: { fontSize: 16, fontWeight: '500', color: '#3A322A' },
  flipBackBtn: { padding: 2 },
  backMacros: { fontSize: 11, color: '#9C9180', marginTop: 4, marginBottom: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.5, color: '#6B6049' },
  bodyText: { fontSize: 12, color: '#3A322A', marginTop: 4, lineHeight: 17 },
  swipeHint: { color: '#F2E9D8', fontSize: 11, marginTop: 18 },
  emptyTitle: { color: '#F2E9D8', fontSize: 18, fontWeight: '500', marginBottom: 8, textAlign: 'center' },
  emptyText: { color: '#E2E0EE', fontSize: 12, textAlign: 'center' },
});