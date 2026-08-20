import { useState } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, TextInput,
  ImageBackground, StatusBar, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { EyeIcon, EyeOffIcon } from '../../src/components/Icons';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Completá todos los campos');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground
      source={require('../../assets/imagendefondo.jpeg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.overlay}>
        <View style={styles.orb1} />
        <View style={styles.orb2} />

        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.card}>
                {/* Logo */}
                <Image
                  source={require('../../assets/logo-ignitel-tight.png')}
                  style={styles.logo}
                  tintColor="#ffffff"
                  resizeMode="contain"
                />

                {/* Heading */}
                <Text style={styles.heading}>Bienvenido de nuevo</Text>
                <Text style={styles.sub}>Ingresá tus credenciales para acceder</Text>

                {/* Error */}
                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Email */}
                <View style={styles.field}>
                  <Text style={styles.label}>Correo electrónico</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>

                {/* Password */}
                <View style={styles.field}>
                  <Text style={styles.label}>Contraseña</Text>
                  <View style={styles.passRow}>
                    <TextInput
                      style={[styles.input, styles.passInput]}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPass(v => !v)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {showPass
                        ? <EyeOffIcon size={18} color="rgba(255,255,255,0.45)" />
                        : <EyeIcon    size={18} color="rgba(255,255,255,0.45)" />
                      }
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnOff]}
                  onPress={handleLogin}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Iniciar Sesión</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg:      { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(6,6,22,0.88)' },
  scroll:  { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 32 },

  orb1: {
    position: 'absolute', top: -80, right: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  orb2: {
    position: 'absolute', bottom: -40, left: -60,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(79,70,229,0.10)',
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 12,
  },

  logo:    { width: '60%', height: 56, alignSelf: 'center', marginBottom: 22 },
  heading: { fontSize: 22, fontWeight: '700', color: '#ffffff', textAlign: 'center', letterSpacing: -0.4, marginBottom: 6 },
  sub:     { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 22 },

  errorBox: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#f87171', textAlign: 'center' },

  field:   { marginBottom: 16 },
  label:   { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginBottom: 6 },

  input: {
    height: 48, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: '#ffffff', paddingHorizontal: 14, fontSize: 14,
  },

  passRow:  { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  passInput: { flex: 1, paddingRight: 44 },
  eyeBtn:   { position: 'absolute', right: 14 },

  btn: {
    height: 52, backgroundColor: '#4f46e5', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  btnOff:  { opacity: 0.7 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#ffffff', letterSpacing: 0.2 },
});
