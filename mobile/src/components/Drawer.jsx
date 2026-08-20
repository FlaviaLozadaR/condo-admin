import { useRef, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback,
  Animated, StyleSheet, Dimensions, ScrollView,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { font, spacing, radius } from '../theme';
import {
  GridIcon, UserIcon, BuildingIcon, ClockIcon,
  MailIcon, CalendarIcon,
  AlertTriangleIcon, LogOutIcon,
} from './Icons';

const W = Math.min(Dimensions.get('window').width * 0.82, 300);

function NavItem({ icon, label, active, onPress, disabled, colors, styles }) {
  return (
    <TouchableOpacity
      style={[styles.navItem, active && styles.navItemActive, disabled && styles.navItemDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={styles.navIcon}>{icon}</View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AppDrawer({ visible, onClose }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout, isSuperAdmin, isAdmin, isSeguridad, isResident } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const slideX    = useRef(new Animated.Value(-W)).current;
  const showAdmin = isSuperAdmin || isAdmin;
  const showSec   = isSuperAdmin || isAdmin || isSeguridad;

  useEffect(() => {
    if (visible) {
      slideX.setValue(-W);
      Animated.spring(slideX, {
        toValue: 0, useNativeDriver: true, tension: 72, friction: 12,
      }).start();
    }
  }, [visible]);

  const go = (route) => {
    onClose();
    setTimeout(() => router.push(route), 120);
  };

  const initial = (user?.name ?? 'U').charAt(0).toUpperCase();
  const roleLabel =
    isSuperAdmin ? 'Super Admin'
    : isAdmin    ? 'Administrador'
    : isSeguridad ? 'Seguridad'
    : 'Residente';

  const handleLogout = () => {
    onClose();
    setTimeout(() => logout(), 300);
  };

  const activeColor = colors.primaryDark;
  const inactiveColor = colors.textMuted;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={[styles.drawer, { transform: [{ translateX: slideX }] }]}>
              {/* Header */}
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>{roleLabel}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Nav items */}
              <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
                <NavItem
                  icon={<GridIcon size={17} color={pathname === '/(app)/' || pathname === '/' ? activeColor : inactiveColor} />}
                  label="Dashboard"
                  active={pathname === '/(app)/' || pathname === '/'}
                  onPress={() => go('/(app)/')}
                  colors={colors} styles={styles}
                />
                {showAdmin && (
                  <NavItem
                    icon={<UserIcon size={17} color={pathname.includes('usuarios') ? activeColor : inactiveColor} />}
                    label="Usuarios"
                    active={pathname.includes('usuarios')}
                    onPress={() => go('/(app)/usuarios')}
                    colors={colors} styles={styles}
                  />
                )}
                {showAdmin && (
                  <NavItem
                    icon={<BuildingIcon size={17} color={pathname.includes('propiedades') ? activeColor : inactiveColor} />}
                    label="Propiedades"
                    active={pathname.includes('propiedades')}
                    onPress={() => go('/(app)/propiedades')}
                    colors={colors} styles={styles}
                  />
                )}
                {showSec && (
                  <NavItem
                    icon={<ClockIcon size={17} color={pathname.includes('visitas') ? activeColor : inactiveColor} />}
                    label="Historial Visitas"
                    active={pathname.includes('visitas')}
                    onPress={() => go('/(app)/visitas')}
                    colors={colors} styles={styles}
                  />
                )}
                <NavItem
                  icon={<MailIcon size={17} color={pathname.includes('anuncios') ? activeColor : inactiveColor} />}
                  label="Anuncios"
                  active={pathname.includes('anuncios')}
                  onPress={() => go('/(app)/anuncios')}
                  colors={colors} styles={styles}
                />
                {showAdmin && (
                  <NavItem
                    icon={<CalendarIcon size={17} color={pathname.includes('reservas') && !pathname.includes('mis-reservas') ? activeColor : inactiveColor} />}
                    label="Reservas"
                    active={pathname.includes('reservas') && !pathname.includes('mis-reservas')}
                    onPress={() => go('/(app)/reservas')}
                    colors={colors} styles={styles}
                  />
                )}
                {isResident && (
                  <NavItem
                    icon={<CalendarIcon size={17} color={pathname.includes('mis-reservas') ? activeColor : inactiveColor} />}
                    label="Mis Reservas"
                    active={pathname.includes('mis-reservas')}
                    onPress={() => go('/(app)/mis-reservas')}
                    colors={colors} styles={styles}
                  />
                )}
                <NavItem
                  icon={<AlertTriangleIcon size={17} color={pathname.includes('panico') ? colors.danger : inactiveColor} />}
                  label="Botón de Pánico"
                  active={pathname.includes('panico')}
                  onPress={() => go('/(app)/panico')}
                  colors={colors} styles={styles}
                />
              </ScrollView>

              {/* Footer: user info + logout */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.userRow} activeOpacity={0.7} onPress={() => go('/(app)/perfil')}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName} numberOfLines={1}>{user?.name}</Text>
                    <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                  <LogOutIcon size={16} color={colors.danger} />
                  <Text style={styles.logoutText}>Cerrar Sesión</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      flexDirection: 'row',
    },
    drawer: {
      width: W, backgroundColor: colors.surface,
      shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.2, shadowRadius: 20, elevation: 16,
      flexDirection: 'column',
    },

    drawerHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.lg,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    drawerTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
    closeBtn:    { fontSize: 18, color: colors.textMuted, fontWeight: '300' },

    navScroll: { flex: 1, paddingVertical: spacing.sm },

    navItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: spacing.sm, paddingHorizontal: spacing.md,
      paddingVertical: 11, borderRadius: radius.md, marginBottom: 2,
    },
    navItemActive:   { backgroundColor: colors.primarySoft },
    navItemDisabled: { opacity: 0.4 },
    navIcon:         {},
    navLabel:        { fontSize: font.sm, color: colors.text, fontWeight: '500' },
    navLabelActive:  { color: colors.primaryDark, fontWeight: '700' },

    footer: {
      borderTopWidth: 1, borderTopColor: colors.border,
      paddingHorizontal: spacing.lg, paddingBottom: 32, paddingTop: spacing.md,
      gap: spacing.sm,
    },
    userRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    avatar: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: font.base, fontWeight: '700', color: colors.primary },
    userName:   { fontSize: font.sm, fontWeight: '600', color: colors.text },
    userEmail:  { fontSize: 11, color: colors.textMuted, marginTop: 1 },

    logoutBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    logoutText: { fontSize: font.sm, fontWeight: '600', color: colors.danger },
  });
}
