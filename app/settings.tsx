import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA', paddingTop: 60, paddingHorizontal: 18 },
  title: { fontSize: 22, fontWeight: '500', color: '#3A3570', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.5, color: '#9C9180', marginBottom: 8 },
  row: {
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowText: { fontSize: 14, color: '#3A322A' },
  dangerRow: { borderColor: '#F0958B' },
  dangerText: { fontSize: 14, color: '#A32D2D' },
  footer: { fontSize: 11, color: '#C0B8B0', textAlign: 'center', marginTop: 'auto', paddingBottom: 40 },
});