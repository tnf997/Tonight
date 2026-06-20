import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character.';
  return null;
}

type Step = 'email' | 'code' | 'password' | 'done';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    if (!email.trim()) {
      Alert.alert('Email required', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setStep('code');
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
      type: 'recovery',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Invalid code', 'The code you entered is incorrect or has expired.');
      return;
    }
    setStep('password');
  }

  async function handleSetPassword() {
    const validationError = validatePassword(newPassword);
    if (validationError) { Alert.alert('Weak password', validationError); return; }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Please make sure both passwords are the same.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setStep('done');
  }

  if (step === 'done') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Password updated</Text>
        <Text style={styles.body}>Your password has been changed. You can now log in with your new password.</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/login')}>
          <Text style={styles.buttonText}>Go to log in</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'password') {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New password</Text>
        <Text style={styles.body}>Choose a strong new password for your account.</Text>
        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={(val) => setNewPassword(val)}
          secureTextEntry
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={(val) => setConfirmPassword(val)}
          secureTextEntry
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Text style={styles.hint}>
          8+ characters · uppercase · lowercase · number · special character
        </Text>
        <Pressable style={styles.button} onPress={handleSetPassword} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save new password'}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (step === 'code') {
    return (
      <View style={styles.container}>
        <Pressable style={styles.back} onPress={() => setStep('email')}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.body}>
          We sent a code to {email}. Enter it below to reset your password.
        </Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="········"
          value={code}
          onChangeText={(val) => setCode(val)}
          keyboardType="number-pad"
          maxLength={8}
          autoFocus
          autoCorrect={false}
        />
        <Pressable style={styles.button} onPress={handleVerifyCode} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify code'}</Text>
        </Pressable>
        <Pressable onPress={handleSendCode}>
          <Text style={styles.resend}>Didn't get it? Resend code</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.body}>
        Enter the email you signed up with and we'll send you a reset code.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={(val) => setEmail(val)}
        autoCapitalize="none"
        keyboardType="email-address"
        autoFocus
        autoCorrect={false}
      />
      <Pressable style={styles.button} onPress={handleSendCode} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send reset code'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#FBF6EA', paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  back: { marginBottom: 24 },
  backText: { fontSize: 14, color: '#3A3570' },
  title: { fontSize: 22, fontWeight: '500', color: '#3A3570', marginBottom: 10 },
  body: { fontSize: 13, color: '#6B6049', lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 12, color: '#6B6049', marginBottom: 6 },
  input: {
    height: 44,
    backgroundColor: '#FFFEFA',
    borderWidth: 0.5,
    borderColor: '#E2E0EE',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    color: '#3A322A',
    fontSize: 14,
  },
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    height: 56,
  },
  hint: { fontSize: 11, color: '#9C9180', textAlign: 'center', marginBottom: 16, lineHeight: 16 },
  button: { backgroundColor: '#3A3570', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#FFFEFA', fontWeight: '500', fontSize: 14 },
  resend: { color: '#9C9180', fontSize: 12, textAlign: 'center', marginTop: 16 },
});