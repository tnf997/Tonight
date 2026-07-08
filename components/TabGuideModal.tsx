import { scaleFont } from '@/constants/scale';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
};

export default function TabGuideModal({ visible, title, message, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  card: { backgroundColor: '#FFFEFA', borderRadius: 16, padding: 20, width: '100%' },
  title: { fontSize: scaleFont(16), fontWeight: '500', color: '#3A322A', marginBottom: 10 },
  message: { fontSize: scaleFont(13), color: '#6B6049', lineHeight: 20, marginBottom: 18 },
  btn: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  btnText: { fontSize: scaleFont(13), color: '#FFFEFA', fontWeight: '500' },
});