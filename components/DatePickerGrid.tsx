import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function DatePickerGrid({ value, onChange }: Props) {
  const [viewMonth, setViewMonth] = useState(value ? value.getMonth() : new Date().getMonth());
  const [viewYear, setViewYear] = useState(value ? value.getFullYear() : new Date().getFullYear());

  function goPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isSelected(day: number) {
    if (!value) return false;
    return value.getFullYear() === viewYear && value.getMonth() === viewMonth && value.getDate() === day;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={goPrevMonth}>
          <Feather name="chevron-left" size={20} color="#3A3570" />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <Pressable onPress={goNextMonth}>
          <Feather name="chevron-right" size={20} color="#3A3570" />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => (
          <Pressable
            key={i}
            style={[styles.cell, day && isSelected(day) && styles.cellSelected]}
            onPress={() => day && onChange(new Date(viewYear, viewMonth, day))}
            disabled={!day}
          >
            {day && (
              <Text style={[styles.cellText, isSelected(day) && styles.cellTextSelected]}>{day}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFEFA', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E2E0EE' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthLabel: { fontSize: 14, fontWeight: '500', color: '#3A322A' },
  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: '#9C9180', fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  cellSelected: { backgroundColor: '#3A3570' },
  cellText: { fontSize: 13, color: '#3A322A' },
  cellTextSelected: { color: '#FFFEFA', fontWeight: '500' },
});