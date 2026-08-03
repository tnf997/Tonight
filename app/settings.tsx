import DatePickerGrid from '@/components/DatePickerGrid';
import { supabase } from '@/lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const HIGHLIGHT_COLORS = [
  '#FCE3A8', '#F7B8C6', '#BEE3C4', '#AFD3F2',
  '#D9C7F0', '#F3C6B8', '#B8E4E8', '#EAC4DD',
];

const LABEL_COLORS = [
  '#D4537E', '#378ADD', '#639922', '#EF9F27', '#8B5CF6', '#D85A30', '#3AAEB5', '#C2447A',
  '#B8873A', '#4F8F5C', '#9B5FA8', '#4A7FB0',
  '#F7B8C6', '#AFD3F2', '#BEE3C4', '#FCE3A8', '#D9C7F0', '#F3C6B8', '#B8E4E8', '#EAC4DD',
  '#E8D5C4', '#C7D9C0', '#F0D8E8', '#CFE0EE',
];

type CookLabel = {
  id: string;
  initials: string;
  color: string;
  name: string | null;
};

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [highlightColor, setHighlightColor] = useState('#FCE3A8');

  const [anchorDate, setAnchorDate] = useState<Date | null>(null);
  const [periodLength, setPeriodLength] = useState<1 | 2>(1);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [tempAnchorDate, setTempAnchorDate] = useState<Date | null>(null);

  const [cookLabels, setCookLabels] = useState<CookLabel[]>([]);
  const [addLabelModalVisible, setAddLabelModalVisible] = useState(false);
  const [newLabelInitials, setNewLabelInitials] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  function formatDateKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDateDisplay(d: Date) {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  useFocusEffect(useCallback(() => {
    async function loadSettings() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { data } = await supabase
        .from('profiles')
        .select('need_highlight_color, planner_anchor_date, planner_period_length')
        .eq('id', userId)
        .single();

      if (data?.need_highlight_color) setHighlightColor(data.need_highlight_color);
      if (data?.planner_anchor_date) setAnchorDate(new Date(data.planner_anchor_date + 'T00:00:00'));
      if (data?.planner_period_length) setPeriodLength(data.planner_period_length as 1 | 2);

      const { data: labelsData } = await supabase
        .from('cook_labels')
        .select('id, initials, color, name')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (labelsData) setCookLabels(labelsData as CookLabel[]);
    }
    loadSettings();
  }, []));

  async function handleSelectHighlightColor(color: string) {
    setHighlightColor(color);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    await supabase.from('profiles').update({ need_highlight_color: color }).eq('id', userId);
  }

  function openDatePicker() {
    setTempAnchorDate(anchorDate ?? new Date());
    setDatePickerVisible(true);
  }

  async function confirmAnchorDate() {
    if (!tempAnchorDate) return;
    setAnchorDate(tempAnchorDate);
    setDatePickerVisible(false);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    await supabase
      .from('profiles')
      .update({ planner_anchor_date: formatDateKey(tempAnchorDate) })
      .eq('id', userId);
  }

  async function handleSelectPeriodLength(length: 1 | 2) {
    setPeriodLength(length);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    await supabase.from('profiles').update({ planner_period_length: length }).eq('id', userId);
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
  }

  async function handleDeleteLabel(labelId: string, initials: string) {
    Alert.alert('Remove this cook?', `Remove "${initials}" from your list? Any planned meals assigned to them will show no cook.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('cook_labels').delete().eq('id', labelId);
          setCookLabels((prev) => prev.filter((l) => l.id !== labelId));
        },
      },
    ]);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, all your recipes, and your pantry. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;
            if (!userId) { setLoading(false); return; }

            await supabase.from('pantry_items').delete().eq('user_id', userId);
            await supabase.from('recipes').delete().eq('user_id', userId);
            await supabase.from('profiles').delete().eq('id', userId);

            const { error } = await supabase.rpc('delete_user');
            setLoading(false);

            if (error) {
              Alert.alert('Error', 'Could not delete account. Please contact support at support@tonightapps.com');
              return;
            }

            await supabase.auth.signOut();
            router.replace('/login');
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>MEAL PLANNING</Text>

        <Pressable style={styles.row} onPress={openDatePicker}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowText}>Planning period start date</Text>
            <Text style={styles.rowSubtext}>
              {anchorDate ? formatDateDisplay(anchorDate) : 'Not set'}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#B0A790" />
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>HOW MANY WEEKS AT A TIME?</Text>
        <View style={styles.periodRow}>
          {[1, 2].map((n) => {
            const isSelected = periodLength === n;
            return (
              <Pressable
                key={n}
                onPress={() => handleSelectPeriodLength(n as 1 | 2)}
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

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>COOKS</Text>
        <View style={styles.cookRow}>
          {cookLabels.map((label) => (
            <Pressable
              key={label.id}
              onLongPress={() => handleDeleteLabel(label.id, label.initials)}
              style={[styles.cookCircle, { backgroundColor: label.color }]}
            >
              <Text style={styles.cookCircleText}>{label.initials}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.addCookBtn} onPress={() => setAddLabelModalVisible(true)}>
            <Feather name="plus" size={16} color="#3A3570" />
          </Pressable>
        </View>
        <Text style={styles.helperText}>Tap and hold a cook to remove them.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NEED LIST HIGHLIGHT</Text>
        <View style={styles.colorRow}>
          {HIGHLIGHT_COLORS.map((color) => (
            <Pressable
              key={color}
              onPress={() => handleSelectHighlightColor(color)}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                highlightColor === color && styles.colorSwatchSelected,
              ]}
            />
          ))}
        </View>
        <Text style={styles.helperText}>
          Ingredients needed for planned meals will be highlighted this color in your pantry's Need tab.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <Pressable style={styles.row} onPress={handleSignOut}>
          <Text style={styles.rowText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DANGER ZONE</Text>
        <Pressable style={[styles.row, styles.dangerRow]} onPress={handleDeleteAccount} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#A32D2D" />
          ) : (
            <Text style={styles.dangerText}>Delete account</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.footer}>Tonight · tonightapps.com</Text>

      <Modal visible={datePickerVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Planning period start date</Text>
            <DatePickerGrid value={tempAnchorDate} onChange={setTempAnchorDate} />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setDatePickerVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={confirmAnchorDate}>
                <Text style={styles.modalConfirmText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
            <Text style={styles.helperText}>Pick a color</Text>
            <View style={[styles.colorRow, { marginTop: 8 }]}>
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
            <View style={[styles.modalBtns, { marginTop: 20 }]}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA', paddingTop: 60, paddingHorizontal: 18 },
  title: { fontSize: 22, fontWeight: '500', color: '#3A3570', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.5, color: '#9C9180', marginBottom: 8 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchSelected: { borderWidth: 2, borderColor: '#3A322A' },
  helperText: { fontSize: 11, color: '#9C9180', lineHeight: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowText: { fontSize: 14, color: '#3A322A' },
  rowSubtext: { fontSize: 12, color: '#9C9180', marginTop: 2 },
  dangerRow: { borderColor: '#F0958B' },
  dangerText: { fontSize: 14, color: '#A32D2D' },
  periodRow: { flexDirection: 'row', gap: 10 },
  periodChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    alignItems: 'center',
  },
  periodChipSelected: { backgroundColor: '#3A3570', borderWidth: 0 },
  periodChipText: { fontSize: 13, color: '#3A322A' },
  periodChipTextSelected: { color: '#FFFEFA', fontWeight: '500' },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  cookCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cookCircleText: { fontSize: 14, fontWeight: '500', color: '#FFFEFA' },
  addCookBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E0EE',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { fontSize: 11, color: '#C0B8B0', textAlign: 'center', marginTop: 20, paddingBottom: 20 },
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
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 0.5, borderColor: '#E2E0EE', alignItems: 'center' },
  modalCancelText: { fontSize: 13, color: '#6B6049' },
  modalConfirm: { flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: '#3A3570', alignItems: 'center' },
  modalConfirmText: { fontSize: 13, color: '#FFFEFA', fontWeight: '500' },
});