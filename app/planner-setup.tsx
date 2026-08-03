import DatePickerGrid from '@/components/DatePickerGrid';
import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PlannerSetupScreen() {
  const router = useRouter();
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);
  const [periodLength, setPeriodLength] = useState<1 | 2 | null>(null);
  const [saving, setSaving] = useState(false);

  function formatDateKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async function handleContinue() {
    if (!anchorDate || periodLength === null || saving) return;
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setSaving(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({
        planner_anchor_date: formatDateKey(anchorDate),
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

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionLabel}>WHEN DOES YOUR PLANNING PERIOD START?</Text>
        <Text style={styles.helperText}>
          Pick a date your planning cycle begins on — like your grocery shopping day. Future periods will repeat from this date.
        </Text>
        <DatePickerGrid value={anchorDate} onChange={setAnchorDate} />

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
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueBtn, (!anchorDate || periodLength === null) && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!anchorDate || periodLength === null || saving}
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
  body: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, color: '#6B6049', marginBottom: 8 },
  helperText: { fontSize: 12, color: '#9C9180', lineHeight: 17, marginBottom: 14 },
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