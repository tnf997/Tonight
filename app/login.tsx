import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character (e.g. !@#$%).';
  return null;
}

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'signup' | 'login' | 'verify'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);

    if (mode === 'signup') {
      if (!name.trim()) {
        Alert.alert('Name required', 'Please enter your name.');
        setLoading(false);
        return;
      }
      const passwordError = validatePassword(password);
      if (passwordError) {
        Alert.alert('Weak password', passwordError);
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      setLoading(false);
      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }
      setMode('verify');
    } else if (mode === 'login') {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        Alert.alert('Login failed', error.message);
        return;
      }
      if (!data.user?.email_confirmed_at) {
        setMode('verify');
        return;
      }
      router.replace('/(tabs)');
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) {
      Alert.alert('Code required', 'Please enter the code from your email.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'signup',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Invalid code', 'The code you entered is incorrect or has expired. Please try again.');
      return;
    }
    router.replace('/onboarding');
  }

  async function handleResendCode() {
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Code sent', 'Check your email for a new code.');
  }

  if (mode === 'verify') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Tonight</Text>
        <Text style={styles.verifyTitle}>Check your email</Text>
        <Text style={styles.verifyBody}>
          We sent a code to {email}. Enter it below to confirm your account.
        </Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="········"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={8}
          autoFocus
          autoCorrect={false}
        />
        <Pressable style={styles.button} onPress={handleVerifyCode} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify code'}</Text>
        </Pressable>
        <Pressable onPress={handleResendCode}>
          <Text style={styles.toggle}>Didn't get it? Resend code</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tonight</Text>
      <Text style={styles.subtitle}>
        {mode === 'signup' ? 'Sign up to get started' : 'Welcome back'}
      </Text>

      {mode === 'signup' && (
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {mode === 'signup' && (
        <Text style={styles.passwordHint}>
          8+ characters · uppercase · lowercase · number · special character
        </Text>
      )}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Log in'}
        </Text>
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
        <Text style={styles.toggle}>
          {mode === 'signup'
            ? 'Already have an account? Log in'
            : "Don't have an account? Sign up"}
        </Text>
      </Pressable>

      {mode === 'login' && (
        <Pressable onPress={() => router.push('/reset-password' as any)}>
          <Text style={styles.forgot}>Forgot password?</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EA', paddingHorizontal: 24, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: '500', color: '#3A3570', textAlign: 'center' },
  subtitle: { fontSize: 12, color: '#9C9180', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  input: {
    height: 40,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    color: '#3A322A',
    fontSize: 14,
    letterSpacing: 0,
  },
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    height: 56,
  },
  passwordHint: {
    fontSize: 11,
    color: '#9C9180',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 16,
  },
  button: {
    backgroundColor: '#3A3570',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: { color: '#FFFEFA', fontWeight: '500', fontSize: 14 },
  toggle: { color: '#5A5294', fontSize: 12, textAlign: 'center', marginTop: 16 },
  forgot: { color: '#9C9180', fontSize: 12, textAlign: 'center', marginTop: 10 },
  verifyTitle: { fontSize: 20, fontWeight: '500', color: '#3A322A', textAlign: 'center', marginTop: 40, marginBottom: 12 },
  verifyBody: { fontSize: 13, color: '#6B6049', textAlign: 'center', lineHeight: 20, marginBottom: 30 },
});