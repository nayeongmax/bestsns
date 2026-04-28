import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../../lib/theme';

export default function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();

  async function handleSubmit() {
    if (!email || !password) { Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.'); return; }
    setLoading(true);
    if (tab === 'login') {
      const { error } = await signIn(email, password);
      if (error) Alert.alert('로그인 실패', error);
    } else {
      if (!nickname) { Alert.alert('입력 오류', '닉네임을 입력해주세요.'); setLoading(false); return; }
      const { error } = await signUp(email, password, nickname);
      if (error) Alert.alert('회원가입 실패', error);
      else Alert.alert('🎉 가입 완료!', '이메일 인증 후 로그인해주세요.');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🚀</Text>
          <Text style={styles.logoText}>BESTSNS</Text>
          <Text style={styles.logoSub}>SNS 마케팅 · 수익화 플랫폼</Text>
        </View>

        {/* Tab */}
        <View style={styles.tabRow}>
          {(['login', 'signup'] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'login' ? '🔑 로그인' : '✨ 회원가입'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.label}>📧 이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="이메일 입력"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={Colors.textMuted}
          />

          {tab === 'signup' && (
            <>
              <Text style={styles.label}>😎 닉네임</Text>
              <TextInput
                style={styles.input}
                placeholder="사용할 닉네임"
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="none"
                placeholderTextColor={Colors.textMuted}
              />
            </>
          )}

          <Text style={styles.label}>🔒 비밀번호</Text>
          <TextInput
            style={styles.input}
            placeholder="비밀번호 입력"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={Colors.textMuted}
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>{tab === 'login' ? '🚀 로그인' : '✨ 가입하기'}</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.notice}>
          💡 회원가입 시 이용약관 및 개인정보처리방침에 동의합니다
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.lg },
  logoWrap: { alignItems: 'center', marginBottom: Spacing.xl },
  logoEmoji: { fontSize: 56 },
  logoText: { fontSize: 32, fontWeight: '900', color: Colors.primary, letterSpacing: 2, marginTop: Spacing.sm },
  logoSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: 4, marginBottom: Spacing.lg },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md },
  tabActive: { backgroundColor: Colors.primary, ...Shadow.sm },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, ...Shadow.md },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.lg,
    ...Shadow.sm,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  notice: { textAlign: 'center', fontSize: 11, color: Colors.textMuted, marginTop: Spacing.lg },
});
