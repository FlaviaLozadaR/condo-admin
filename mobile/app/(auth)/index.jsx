import { View, Text, Image, StyleSheet, TouchableOpacity, ImageBackground, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

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

        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            <Image
              source={require('../../assets/logo-ignitel-tight.png')}
              style={styles.logo}
              tintColor="#ffffff"
              resizeMode="contain"
            />
            <Text style={styles.appName}>Condo Admin</Text>
            <Text style={styles.tagline}>Plataforma de gestión condominial</Text>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Iniciar Sesión</Text>
            </TouchableOpacity>
            <Text style={styles.powered}>Powered by Ignitel</Text>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg:      { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(6,6,22,0.88)' },
  safe:    { flex: 1, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 20 },

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

  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo:    { width: 220, height: 76, marginBottom: 24 },
  appName: {
    fontSize: 30, fontWeight: '800', color: '#ffffff',
    letterSpacing: -0.5, marginBottom: 8,
  },
  tagline: { fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },

  footer:  { alignItems: 'center', gap: 14 },
  btn: {
    width: '100%', height: 54, backgroundColor: '#4f46e5',
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  btnText:  { fontSize: 16, fontWeight: '700', color: '#ffffff', letterSpacing: 0.2 },
  powered:  { fontSize: 12, color: 'rgba(255,255,255,0.28)' },
});
