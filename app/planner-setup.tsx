import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const DAYS = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

export default function PlannerSetupScreen() {
  const router = useRouter();
  const [startDay, setStartDay] = useState<number | null>(null);
  const [periodLength, setPeriodLength] = useState<1 | 2 | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (startDay === null || periodLength === null || saving) return;
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSaving(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({
        week_start_day: startDay,
        planner_period_length: periodLength,
        planner_setup_complete: true,
      })
      .eq('id', userId);

    setSaving(false);

    if (!error) {
      router.replace('/planner' as any);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backIconBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#6B6049" />
        </Pressable>
        <Text style={styles.headerTitle}>Set up your planner</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>WHICH DAY DOES YOUR WEEK START ON?</Text>
        <View style={styles.dayGrid}>
          {DAYS.map((day) => {
            const isSelected = startDay === day.value;
            return (
              <Pressable
                key={day.value}
                onPress={() => setStartDay(day.value)}
                style={[styles.dayChip, isSelected && styles.dayChipSelected]}
              >
                <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                  {day.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>HOW MANY WEEKS AT A TIME?</Text>
        <View style={styles.periodRow}>
          {[1, 2].map((n) => {
            const isSelected = periodLength === n;
            return (
              <Pressable
                key={n}
                onPress={() => setPeriodLength(n as 1 | 2)}
                style={[styles.periodChip, isSelected && styles.periodChipSelected]}
              >
                <Text style={[styles.periodChipText, isSelected && styles.periodChipTextSelected]}>
                  {n} week{n > 1 ? 's' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueBtn, (startDay === null || periodLength === null) && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={startDay === null || periodLength === null || saving}
        >
          <Text style={styles.continueBtnText}>
            {saving ? 'Saving...' : 'Continue'}
          </Text>
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
    paddingTop: 60,
    paddingBottom: 14,
  },
  backIconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '500', color: '#3A322A' },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, color: '#6B6049', marginBottom: 12 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
  },
  dayChipSelected: { backgroundColor: '#3A3570', borderWidth: 0 },
  dayChipText: { fontSize: 13, color: '#3A322A' },
  dayChipTextSelected: { color: '#FFFEFA', fontWeight: '500' },
  periodRow: { flexDirection: 'row', gap: 10 },
  periodChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    alignItems: 'center',
  },
  periodChipSelected: { backgroundColor: '#3A3570', borderWidth: 0 },
  periodChipText: { fontSize: 14, color: '#3A322A' },
  periodChipTextSelected: { color: '#FFFEFA', fontWeight: '500' },
  footer: { padding: 18 },
  continueBtn: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { color: '#FFFEFA', fontWeight: '500', fontSize: 14 },
});