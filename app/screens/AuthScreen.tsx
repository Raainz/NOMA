/** Mandatory sign-in / sign-up gate. */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Button, FONTS, NOMA_COLORS, Wordmark } from '../components/UIComponents';
import { Field } from '../components/System';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function authErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'invalid_credentials':
        return 'E-mail ou mot de passe incorrect.';
      case 'email_taken':
        return 'Un compte existe déjà avec cet e-mail.';
      case 'network_error':
        return `${e.message}. Vérifiez que le téléphone est sur le même Wi-Fi que le serveur.`;
      case 'validation_error':
        return 'Informations invalides. Vérifiez l’e-mail et le mot de passe (8 caractères minimum).';
      default:
        return e.status >= 500 ? 'Le serveur rencontre un problème. Réessayez plus tard.' : e.message;
    }
  }
  return 'Une erreur est survenue. Réessayez.';
}

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const isRegister = mode === 'register';
  const emailError = touched && !EMAIL_RE.test(email.trim()) ? 'Adresse e-mail invalide' : null;
  const passwordError =
    touched && (isRegister ? password.length < 8 : password.length === 0)
      ? isRegister
        ? '8 caractères minimum'
        : 'Mot de passe requis'
      : null;

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!EMAIL_RE.test(email.trim()) || (isRegister ? password.length < 8 : password.length === 0)) return;
    setBusy(true);
    try {
      if (isRegister) await register(email, password, name);
      else await login(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
          <Wordmark color={NOMA_COLORS.charcoal} />
          <Text style={{ fontFamily: FONTS.heading, fontSize: 24, color: NOMA_COLORS.text, marginTop: 36 }}>
            {isRegister ? 'Créer un compte' : 'Connexion'}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: NOMA_COLORS.textSecondary, marginTop: 6, marginBottom: 24 }}>
            Un compte sauvegarde vos sorties et les retrouve sur tous vos appareils. L’enregistrement fonctionne aussi sans réseau.
          </Text>

          {isRegister && (
            <Field label="Prénom (facultatif)" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} />
          )}
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            error={emailError}
          />
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType={isRegister ? 'newPassword' : 'password'}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            helper={isRegister ? '8 caractères minimum' : undefined}
            error={passwordError}
            onSubmitEditing={submit}
          />

          {error && (
            <View accessibilityLiveRegion="polite" style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 14, color: NOMA_COLORS.danger }}>{error}</Text>
            </View>
          )}

          <Button label={isRegister ? 'Créer mon compte' : 'Se connecter'} onPress={submit} loading={busy} />
          <View style={{ height: 12 }} />
          <Button
            label={isRegister ? 'J’ai déjà un compte' : 'Créer un compte'}
            variant="secondary"
            disabled={busy}
            onPress={() => {
              setMode(isRegister ? 'login' : 'register');
              setError(null);
              setTouched(false);
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
