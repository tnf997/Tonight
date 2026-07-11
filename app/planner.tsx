import TabGuideModal from '@/components/TabGuideModal';
import { supabase } from '@/lib/supabase';
import { Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import Feather from '@expo/vector-icons/Feather';
import * as Linking from 'expo-linking';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type PlannedDay = {
  date: Date;
  isToday: boolean;
  recipeId: string | null;
  recipeName: string | null;
  linkUrl: string | null;
  linkTitle: string | null;
  cookInitials: string | null;
  cookColor: string | null;
};

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatRangeLabel(start: Date, end: Date) {
  const s = `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`;
  const e = `${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`;
  return `${s} - ${e}`;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVAILABLE_WIDTH = SCREEN_WIDTH * 0.75;
const SPRIG_UNIT_WIDTH = 40;
const SPRIG_COUNT = Math.max(3, Math.floor(AVAILABLE_WIDTH / SPRIG_UNIT_WIDTH));

const SprigUnit = () => (
  <Svg width={SPRIG_UNIT_WIDTH} height={24} viewBox="0 0 40 24">
    <Path d="M2 12 H38" stroke="#7F77DD" strokeWidth={1} />
    <Path d="M12 12 C12 12 17 6 23 8 C21 10 16 12 12 12 Z" stroke="#7F77DD" strokeWidth={0.8} fill="none" />
    <Path d="M12 12 C12 12 17 18 23 16 C21 14 16 12 12 12 Z" stroke="#7F77DD" strokeWidth={0.8} fill="none" />
    <Path d="M25 12 C25 12 30 7 35 9 C33 11 29 12 25 12 Z" stroke="#7F77DD" strokeWidth={0.8} fill="none" />
    <Path d="M25 12 C25 12 30 17 35 15 C33 13 29 12 25 12 Z" stroke="#7F77DD" strokeWidth={0.8} fill="none" />
  </Svg>
);

const HerbDivider = () => (
  <View style={styles.dividerRow}>
    <View style={{ flexDirection: 'row', width: AVAILABLE_WIDTH, justifyContent: 'space-between' }}>
      {Array.from({ length: SPRIG_COUNT }).map((_, i) => (
        <SprigUnit key={i} />
      ))}
    </View>
  </View>
);

export default function PlannerScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold });
  const [loading, setLoading] = useState(true);
  const [weekStartDay, setWeekStartDay] = useState(0);
  const [periodLength, setPeriodLength] = useState(1);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [days, setDays] = useState<PlannedDay[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  const loadPeriod = useCallback(async (offset: number) => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('week_start_day, planner_period_length')
      .eq('id', userId)
      .single();

    const startDayPref = profile?.week_start_day ?? 0;
    const lengthWeeks = profile?.planner_period_length ?? 1;
    setWeekStartDay(startDayPref);
    setPeriodLength(lengthWeeks);

    const today = startOfDay(new Date());
    const todayDow = today.getDay();
    let daysSinceStart = todayDow - startDayPref;
    if (daysSinceStart < 0) daysSinceStart += 7;
    const currentPeriodStart = addDays(today, -daysSinceStart);

    const totalDays = lengthWeeks * 7;
    const periodStart = addDays(currentPeriodStart, offset * totalDays);

    const dateList: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      dateList.push(addDays(periodStart, i));
    }

    const dateKeys = dateList.map(formatDateKey);
    const periodStartKey = dateKeys[0];
    const periodEndKey = dateKeys[dateKeys.length - 1];

    const { data: planned } = await supabase
      .from('planned_meals')
      .select('date, link_url, link_title, recipe_id, recipes ( name ), cook_labels ( initials, color )')
      .eq('user_id', userId)
      .gte('date', periodStartKey)
      .lte('date', periodEndKey);

    const plannedByDate = new Map<string, { recipeId: string | null; recipeName: string | null; linkUrl: string | null; linkTitle: string | null; cookInitials: string | null; cookColor: string | null }>();
    (planned ?? []).forEach((row: any) => {
      plannedByDate.set(row.date, {
        recipeId: row.recipe_id ?? null,
        recipeName: row.recipes?.name ?? null,
        linkUrl: row.link_url ?? null,
        linkTitle: row.link_title ?? null,
        cookInitials: row.cook_labels?.initials ?? null,
        cookColor: row.cook_labels?.color ?? null,
      });
    });

    const result: PlannedDay[] = dateList.map((d) => {
      const key = formatDateKey(d);
      const entry = plannedByDate.get(key);
      return {
        date: d,
        isToday: key === formatDateKey(today),
        recipeId: entry?.recipeId ?? null,
        recipeName: entry?.recipeName ?? null,
        linkUrl: entry?.linkUrl ?? null,
        linkTitle: entry?.linkTitle ?? null,
        cookInitials: entry?.cookInitials ?? null,
        cookColor: entry?.cookColor ?? null,
      };
    });

    setDays(result);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadPeriod(periodOffset); }, [periodOffset, loadPeriod]));

  useFocusEffect(useCallback(() => {
    async function checkGuide() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const { data } = await supabase.from('profiles').select('seen_planner_guide').eq('id', userId).single();
      if (data && !data.seen_planner_guide) setShowGuide(true);
    }
    checkGuide();
  }, []));

  async function dismissGuide() {
    setShowGuide(false);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userId) await supabase.from('profiles').update({ seen_planner_guide: true }).eq('id', userId);
  }

  function goPrevious() {
    setPeriodOffset((prev) => prev - 1);
  }

  function goNext() {
    setPeriodOffset((prev) => prev + 1);
  }

  async function handleLinkPress(url: string) {
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    await Linking.openURL(finalUrl);
  }

  const rangeLabel = days.length > 0 ? formatRangeLabel(days[0].date, days[days.length - 1].date) : '';

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#F2E9D8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topHeader}>
        <Pressable style={styles.backIconBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#F2E9D8" />
        </Pressable>
        <Text style={styles.topHeaderTitle}>Meal planner</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.weekNav}>
        <Pressable onPress={goPrevious}>
          <Feather name="chevron-left" size={20} color="#F2E9D8" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.weekTitle}>{periodOffset === 0 ? (periodLength === 1 ? 'This week' : 'These two weeks') : `${periodLength === 1 ? 'Week' : '2 weeks'} ${periodOffset > 0 ? `+${periodOffset}` : periodOffset}`}</Text>
          <Text style={styles.weekRange}>{rangeLabel}</Text>
        </View>
        <Pressable onPress={goNext}>
          <Feather name="chevron-right" size={20} color="#F2E9D8" />
        </Pressable>
      </View>

      <Pressable style={styles.favoritesRow}>
        <Feather name="star" size={15} color="#85B7EB" />
        <Text style={styles.favoritesText}>Favorites</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator color="#F2E9D8" style={{ marginTop: 30 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
          {days.map((day, index) => (
            <View key={formatDateKey(day.date)}>
              <View style={[styles.dayCard, day.isToday && styles.dayCardToday]}>
                {day.isToday && (
                  <View style={styles.todayTag}>
                    <Text style={styles.todayTagText}>Today</Text>
                  </View>
                )}
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/planner-day?date=${formatDateKey(day.date)}` as any)}
                >
                  <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
                    {DAY_NAMES[day.date.getDay()]}
                  </Text>
                  {day.recipeName ? (
                    <Text style={[styles.dayContent, day.isToday && styles.dayContentToday]}>
                      {day.recipeName}
                    </Text>
                  ) : day.linkUrl ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flex: 1 }}>
                      <Feather name="link" size={13} color={day.isToday ? '#B5D4F4' : '#378ADD'} />
                      <Text style={[styles.dayContent, styles.dayContentLink, day.isToday && styles.dayContentToday, { flexShrink: 1 }]} numberOfLines={1}>
                        {day.linkTitle ?? day.linkUrl}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.dayEmpty}>Tap to plan</Text>
                  )}
                </Pressable>
                {day.recipeId && (
                  <Pressable
                    onPress={() => router.push(`/recipe-detail?id=${day.recipeId}` as any)}
                    style={styles.openLinkBtn}
                  >
                    <Feather name="book-open" size={16} color={day.isToday ? '#B5D4F4' : '#378ADD'} />
                  </Pressable>
                )}
                {day.linkUrl && (
                  <Pressable
                    onPress={() => handleLinkPress(day.linkUrl!)}
                    style={styles.openLinkBtn}
                  >
                    <Feather name="external-link" size={16} color={day.isToday ? '#B5D4F4' : '#378ADD'} />
                  </Pressable>
                )}
                {day.cookInitials && (
                  <View style={[styles.cookCircle, { backgroundColor: day.cookColor ?? '#3A3570' }]}>
                    <Text style={styles.cookCircleText}>{day.cookInitials}</Text>
                  </View>
                )}
              </View>
              {index < days.length - 1 && <HerbDivider />}
            </View>
          ))}
        </ScrollView>
      )}

      <TabGuideModal
        visible={showGuide}
        title="Your meal planner"
        message="Plan your week here! Tap any day to pick a recipe, or paste a link if you want to try something new. Missing ingredients for planned meals show up in your Pantry's Need tab, ordered by which meal needs them soonest. Save a lineup you love as a Favorite to reuse anytime."
        onDismiss={dismissGuide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E1A38' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 60,
    paddingBottom: 8,
  },
  backIconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  topHeaderTitle: { fontSize: 14, fontWeight: '500', color: '#F2E9D8' },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  weekTitle: { color: '#F2E9D8', fontSize: 18, fontWeight: '500' },
  weekRange: { color: '#9C9180', fontSize: 11, marginTop: 2 },
  favoritesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  favoritesText: { color: '#85B7EB', fontSize: 12, fontWeight: '500' },
  dayCard: {
    backgroundColor: '#FFFEFA',
    borderRadius: 14,
    padding: 16,
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCardToday: {
    backgroundColor: '#0C447C',
    borderWidth: 1.5,
    borderColor: '#378ADD',
  },
  todayTag: {
    position: 'absolute',
    top: -9,
    left: 14,
    backgroundColor: '#378ADD',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  todayTagText: { fontSize: 10, fontWeight: '500', color: '#042C53' },
  dayLabel: { fontSize: 11, color: '#9C9180', letterSpacing: 0.5 },
  dayLabelToday: { color: '#B5D4F4' },
  dayContent: { fontSize: 14, color: '#3A322A', fontWeight: '500', marginTop: 2 },
  dayContentToday: { color: '#FFFEFA' },
  dayContentLink: { color: '#378ADD', textDecorationLine: 'underline' },
  dayEmpty: { fontSize: 13, color: '#9C9180', fontStyle: 'italic', marginTop: 2 },
  cookCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  cookCircleText: { fontFamily: 'Fraunces_600SemiBold', fontSize: 12, color: '#FFFEFA' },
  openLinkBtn: { padding: 8, marginRight: 4 },
  dividerRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
});