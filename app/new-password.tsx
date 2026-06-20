import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character.';
  return null;
}

export default function NewPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    const error = validatePassword(password);
    if (error) { Alert.alert('Weak password', error); return; }
    if (password !== confirm) { Alert.alert('Passwords don\'t match', 'Please make sure both passwords are the same.'); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { Alert.alert('Error', updateError.message); return; }
    Alert.alert('Password updated', 'You can now log in with your new password.', [
      { text: 'OK', onPress: () => router.replace('/login') },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New password</Text>
      <Text style={styles.body}>Choose a strong new password for your account.</Text>
      <TextInput
        style={styles.input}
        placeholder="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoFocus
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
      />
      <Text style={styles.hint}>8+ characters · uppercase · lowercase · number · special character</Text>
      <Pressable style={styles.button} onPress={handleSave} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save new password'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA', paddingHorizontal: 24, paddingTop: 80 },
  title: { fontSize: 22, fontWeight: '500', color: '#3A3570', marginBottom: 10 },
  body: { fontSize: 13, color: '#6B6049', lineHeight: 20, marginBottom: 24 },
  input: {
    height: 40,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    color: '#3A322A',
  },
  hint: { fontSize: 11, color: '#9C9180', textAlign: 'center', marginBottom: 16, lineHeight: 16 },
  button: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#FFFEFA', fontWeight: '500', fontSize: 14 },
});