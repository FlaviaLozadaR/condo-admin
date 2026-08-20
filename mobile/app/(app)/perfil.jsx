import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, TextInput, Switch, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { spacing, radius, font } from '../../src/theme';
import * as api from '../../src/api';

const NOTIF_KEY = 'condo_notif_prefs';

const ALL_NOTIF_TYPES = [
  { key: 'pagoAprobado',     label: 'Pago aprobado',              desc: 'Cuando aprueban tu comprobante.',               roles: ['Propietario', 'Inquilino'] },
  { key: 'nuevoComprobante', label: 'Nuevo comprobante recibido', desc: 'Cuando un residente envía un pago.',            roles: ['Super Admin', 'Administrador'] },
  { key: 'nuevosAnuncios',   label: 'Nuevos anuncios',            desc: 'Cuando se publica un anuncio.',                 roles: ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'] },
  { key: 'alertaPanico',     label: 'Alerta de pánico',           desc: 'Cuando alguien activa el botón de emergencia.', roles: ['Super Admin', 'Administrador', 'Seguridad'] },
  { key: 'reservaAprobada',  label: 'Reserva aprobada',           desc: 'Cuando aprueban tu reserva de área.',           roles: ['Propietario', 'Inquilino'] },
  { key: 'nuevaSolicitud',   label: 'Nueva solicitud de reserva', desc: 'Cuando un residente solicita una reserva.',     roles: ['Super Admin', 'Administrador'] },
];

const DEFAULT_NOTIFS = Object.fromEntries(ALL_NOTIF_TYPES.map(t => [t.key, true]));

// ── Icons ─────────────────────────────────────────────────────────────────────
function ArrowLeftIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M5 12l7 7M5 12l7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CameraIcon({ size = 16, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <SvgCircle cx="12" cy="13" r="4" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function PerfilScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const roleLabel = {
    'Super Admin':   'Super Admin',
    'Administrador': 'Administrador',
    'Seguridad':     'Seguridad',
    'Propietario':   'Propietario',
    'Inquilino':     'Inquilino',
  }[user?.role] ?? user?.role;

  // ── Datos personales ────────────────────────────────────────────────────────
  const [name,  setName]  = useState(user?.name  ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) return Alert.alert('Error', 'El nombre no puede estar vacío.');
    setSaving(true);
    try {
      await api.updateUsuario(user.id, { name: name.trim(), phone: phone.trim() });
      await refreshUser();
      Alert.alert('Listo', 'Datos actualizados correctamente.');
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  // ── Cambiar contraseña ──────────────────────────────────────────────────────
  const [passForm, setPassForm] = useState({ current: '', newPass: '', confirm: '' });
  const [passLoading, setPassLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!passForm.current || !passForm.newPass || !passForm.confirm)
      return Alert.alert('Error', 'Completá todos los campos.');
    if (passForm.newPass.length < 8)
      return Alert.alert('Error', 'La nueva contraseña debe tener al menos 8 caracteres.');
    if (passForm.newPass !== passForm.confirm)
      return Alert.alert('Error', 'Las contraseñas no coinciden.');
    setPassLoading(true);
    try {
      await api.changePassword(user.id, { currentPassword: passForm.current, newPassword: passForm.newPass });
      setPassForm({ current: '', newPass: '', confirm: '' });
      Alert.alert('Listo', 'Contraseña actualizada.');
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setPassLoading(false);
    }
  };

  // ── Notificaciones ──────────────────────────────────────────────────────────
  const notifTypes = ALL_NOTIF_TYPES.filter(t => t.roles.includes(user?.role));
  const [notifs, setNotifs] = useState(DEFAULT_NOTIFS);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then(raw => {
      if (raw) { try { setNotifs({ ...DEFAULT_NOTIFS, ...JSON.parse(raw) }); } catch {} }
    });
  }, []);

  const toggleNotif = useCallback((key) => {
    setNotifs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const initial = (user?.name ?? 'U').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeftIcon size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Mi Perfil</Text>
        <View style={styles.rolePill}>
          <View style={styles.roleOrangeDot} />
          <Text style={styles.rolePillText}>{roleLabel}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.cameraBadge}>
              <CameraIcon size={12} />
            </View>
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{roleLabel}</Text></View>
        </View>

        {/* Datos personales */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos personales</Text>
          <Text style={styles.sectionDesc}>Administrá tu información personal.</Text>

          <Field label="NOMBRE COMPLETO"    value={name}           onChangeText={setName}  placeholder="Tu nombre completo" colors={colors} />
          <Field label="CORREO ELECTRÓNICO" value={user?.email ?? ''} editable={false} colors={colors} />
          <Field label="TELÉFONO"           value={phone}          onChangeText={setPhone} placeholder="Ej: +591 77088953" keyboardType="phone-pad" colors={colors} />
          <Field label="ROL"                value={roleLabel}      editable={false} colors={colors} />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveProfile} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Guardar cambios</Text>}
          </TouchableOpacity>
        </View>

        {/* Cambiar contraseña */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cambiar contraseña</Text>

          <Field label="CONTRASEÑA ACTUAL"          value={passForm.current} onChangeText={v => setPassForm(p => ({ ...p, current: v }))} secureTextEntry placeholder="Tu contraseña actual" colors={colors} />
          <Field label="NUEVA CONTRASEÑA"            value={passForm.newPass} onChangeText={v => setPassForm(p => ({ ...p, newPass: v }))} secureTextEntry placeholder="Mínimo 8 caracteres"  colors={colors} />
          <Field label="CONFIRMAR NUEVA CONTRASEÑA"  value={passForm.confirm} onChangeText={v => setPassForm(p => ({ ...p, confirm: v }))} secureTextEntry placeholder="Repetí la nueva contraseña" colors={colors} />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleChangePassword} disabled={passLoading} activeOpacity={0.85}>
            {passLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Cambiar contraseña</Text>}
          </TouchableOpacity>
        </View>

        {/* Notificaciones */}
        {notifTypes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notificaciones</Text>
            <Text style={styles.sectionDesc}>Elegí qué avisos querés recibir en tu celular.</Text>

            <View style={styles.notifTableHeader}>
              <Text style={[styles.notifColHead, { flex: 1 }]}> </Text>
              <Text style={styles.notifColHead}>Push</Text>
            </View>

            {notifTypes.map(t => (
              <View key={t.key} style={styles.notifRow}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={styles.notifLabel}>{t.label}</Text>
                  <Text style={styles.notifDesc}>{t.desc}</Text>
                </View>
                <Switch
                  value={notifs[t.key]}
                  onValueChange={() => toggleNotif(t.key)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </View>
        )}

        {/* Apariencia */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Apariencia</Text>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifLabel}>Tema</Text>
              <Text style={styles.notifDesc}>{isDark ? 'Modo oscuro activo' : 'Modo claro activo'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Field component ───────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, editable = true, secureTextEntry, placeholder, keyboardType, colors }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, marginBottom: 4 }}>
        {label}
      </Text>
      <TextInput
        style={{
          borderWidth: 1, borderColor: colors.border,
          borderRadius: radius.sm,
          paddingHorizontal: 12, paddingVertical: 10,
          fontSize: font.sm, color: colors.text,
          backgroundColor: editable ? colors.inputBg : colors.disabledBg,
        }}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

// ── Styles factory ────────────────────────────────────────────────────────────
function makeStyles(colors) {
  const CARD_SHADOW = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  };

  return StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: spacing.xl },

    topBar: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn:     { marginRight: spacing.sm, padding: 2 },
    topBarTitle: { flex: 1, fontSize: font.lg, fontWeight: '700', color: colors.text },
    rolePill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: colors.disabledBg, borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    roleOrangeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f59e0b' },
    rolePillText:  { fontSize: 11, fontWeight: '600', color: colors.text },

    avatarSection: { alignItems: 'center', paddingVertical: spacing.lg },
    avatarWrap:    { position: 'relative', marginBottom: spacing.sm },
    avatar: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
    cameraBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: '#6c6c6c',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.bg,
    },
    profileName: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: 6 },
    roleBadge:   { backgroundColor: colors.chipBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
    roleBadgeText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1, borderColor: colors.border,
      ...CARD_SHADOW,
    },
    sectionTitle: { fontSize: font.base, fontWeight: '700', color: colors.text, marginBottom: 4 },
    sectionDesc:  { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },

    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: font.base },

    notifTableHeader: {
      flexDirection: 'row', alignItems: 'center',
      marginBottom: spacing.xs, paddingBottom: 6,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    notifColHead: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textAlign: 'center', width: 50 },

    notifRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    notifLabel: { fontSize: font.sm, fontWeight: '600', color: colors.text },
    notifDesc:  { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  });
}
