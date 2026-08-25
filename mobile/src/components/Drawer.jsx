import { useRef, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback,
  Animated, StyleSheet, ScrollView,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { font, spacing, radius } from '../theme';
import {
  GridIcon, UserIcon, BuildingIcon, ClockIcon,
  MailIcon, CalendarIcon, AlertTriangleIcon, LogOutIcon,
} from './Icons';
import { Dimensions } from 'react-native';

const W = Math.min(Dimensions.get('window').width * 0.82, 300);

const ROLE_COLOR = {
  'Super Admin':   '#7c3aed',
  'Administrador': '#2563eb',
  'Seguridad':     '#059669',
  'Propietario':   '#d97706',
  'Inquilino':     '#d97706',
  'Residente':     '#d97706',
};

function NavItem({ icon, label, active, onPress, disabled, colors, styles }) {
  return (
    <TouchableOpacity
      style={[styles.navItem, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      {active && <View style={styles.navAccent} />}
      <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
        {icon}
      </View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AppDrawer({ visible, onClose }) {
  const router    = useRouter();
  const pathname  = usePathname();
  const { user, logout, isSuperAdmin, isAdmin, isSeguridad, isOwner, isTenant, isResident } = useAuth();
  const { colors, isDark } = useTheme();
  const styles    = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const insets    = useSafeAreaInsets();
  const slideX    = useRef(new Animated.Value(-W)).current;

  const showAdmin = isSuperAdmin || isAdmin;
  const showSec   = isSuperAdmin || isAdmin || isSeguridad;

  useEffect(() => {
    if (visible) {
      slideX.setValue(-W);
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 72, friction: 12 }).start();
    }
  }, [visible]);

  const go = (route) => { onClose(); setTimeout(() => router.push(route), 120); };
  const handleLogout = () => { onClose(); setTimeout(() => logout(), 300); };

  const initial   = (user?.name ?? 'U').charAt(0).toUpperCase();
  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador' : isSeguridad ? 'Seguridad' : isOwner ? 'Propietario' : isTenant ? 'Inquilino' : 'Residente';
  const roleColor = ROLE_COLOR[roleLabel] ?? colors.primary;
  const active    = colors.primary;
  const inactive  = colors.textMuted;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* drawer panel — absolutely fills full height */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideX }] }]}>

        {/* ── HEADER ── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={[styles.accentBar, { backgroundColor: roleColor }]} />
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileRow} activeOpacity={0.8} onPress={() => go('/(app)/perfil')}>
            <View style={[styles.avatar, { backgroundColor: roleColor + '20', borderColor: roleColor }]}>
              <Text style={[styles.avatarText, { color: roleColor }]}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName} numberOfLines={1}>{user?.name}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{user?.email}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '15', borderColor: roleColor + '50' }]}>
                <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── NAV ── */}
        <ScrollView style={styles.nav} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
          <NavItem icon={<GridIcon size={18} color={pathname === '/(app)/' || pathname === '/' ? active : inactive} />} label="Dashboard" active={pathname === '/(app)/' || pathname === '/'} onPress={() => go('/(app)/')} colors={colors} styles={styles} />
          {showAdmin && <NavItem icon={<UserIcon size={18} color={pathname.includes('usuarios') ? active : inactive} />} label="Usuarios" active={pathname.includes('usuarios')} onPress={() => go('/(app)/usuarios')} colors={colors} styles={styles} />}
          {showAdmin && <NavItem icon={<BuildingIcon size={18} color={pathname.includes('propiedades') ? active : inactive} />} label="Propiedades" active={pathname.includes('propiedades')} onPress={() => go('/(app)/propiedades')} colors={colors} styles={styles} />}
          {showSec   && <NavItem icon={<ClockIcon size={18} color={pathname.includes('visitas') ? active : inactive} />} label="Historial Visitas" active={pathname.includes('visitas')} onPress={() => go('/(app)/visitas')} colors={colors} styles={styles} />}
          <NavItem icon={<MailIcon size={18} color={pathname.includes('anuncios') ? active : inactive} />} label="Anuncios" active={pathname.includes('anuncios')} onPress={() => go('/(app)/anuncios')} colors={colors} styles={styles} />
          {showAdmin && <NavItem icon={<CalendarIcon size={18} color={pathname.includes('reservas') && !pathname.includes('mis-reservas') ? active : inactive} />} label="Reservas" active={pathname.includes('reservas') && !pathname.includes('mis-reservas')} onPress={() => go('/(app)/reservas')} colors={colors} styles={styles} />}
          {isResident && <NavItem icon={<CalendarIcon size={18} color={pathname.includes('mis-reservas') ? active : inactive} />} label="Mis Reservas" active={pathname.includes('mis-reservas')} onPress={() => go('/(app)/mis-reservas')} colors={colors} styles={styles} />}
          <NavItem icon={<AlertTriangleIcon size={18} color={pathname.includes('panico') ? '#ef4444' : inactive} />} label="Botón de Pánico" active={pathname.includes('panico')} onPress={() => go('/(app)/panico')} colors={colors} styles={styles} />
        </ScrollView>

        {/* ── FOOTER ── */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <View style={styles.logoutIcon}>
              <LogOutIcon size={16} color="#ef4444" />
            </View>
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </Modal>
  );
}

function makeStyles(colors, isDark) {
  return StyleSheet.create({
    backdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    drawer: {
      position: 'absolute', top: 0, left: 0, bottom: 0,
      width: W, flexDirection: 'column',
      backgroundColor: colors.surface,
      elevation: 20,
      shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 20,
    },

    /* Header */
    header: {
      paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.surfaceSoft,
    },
    accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
    closeBtn: { alignSelf: 'flex-end', marginBottom: 10 },
    closeBtnText: { fontSize: 18, color: colors.textMuted },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 20, fontWeight: '800' },
    profileName:  { fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: 1 },
    profileEmail: { fontSize: 11, color: colors.textMuted, marginBottom: 5 },
    roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
    roleBadgeText: { fontSize: 10, fontWeight: '700' },

    /* Nav */
    nav: { flex: 1 },
    navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingRight: spacing.md, marginBottom: 1 },
    navAccent: { position: 'absolute', left: 0, top: 4, bottom: 4, width: 3, backgroundColor: colors.primary, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
    navIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.md, marginRight: 10 },
    navIconWrapActive: { backgroundColor: colors.primarySoft },
    navLabel: { fontSize: font.sm, color: colors.textMuted, fontWeight: '500', flex: 1 },
    navLabelActive: { color: colors.text, fontWeight: '700' },

    /* Footer */
    footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    logoutIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' },
    logoutText: { fontSize: font.sm, fontWeight: '600', color: '#ef4444' },
  });
}
