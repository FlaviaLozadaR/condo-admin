import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme';
import {
  HomeIcon, CalendarIcon, BellIcon,
  DoorIcon, AlertTriangleIcon, UserIcon,
} from '../../src/components/Icons';

export default function AppLayout() {
  const { user, loading, isSuperAdmin, isAdmin, isSeguridad, isResident } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  const showAdmin    = isSuperAdmin || isAdmin;
  const showSecurity = isSuperAdmin || isAdmin || isSeguridad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          paddingBottom: 4,
          height: 62,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <HomeIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reservas"
        options={{
          title: 'Reservas',
          href: showAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <CalendarIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="anuncios"
        options={{
          title: 'Anuncios',
          href: showAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <BellIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="visitas"
        options={{
          title: 'Visitas',
          href: showSecurity ? undefined : null,
          tabBarIcon: ({ color }) => <DoorIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mis-reservas"
        options={{
          title: 'Reservas',
          href: isResident ? undefined : null,
          tabBarIcon: ({ color }) => <CalendarIcon size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="panico"
        options={{
          title: 'Pánico',
          tabBarIcon: ({ color }) => <AlertTriangleIcon size={21} color={color} />,
          tabBarActiveTintColor: colors.danger,
        }}
      />
      <Tabs.Screen
        name="usuarios"
        options={{ title: 'Usuarios', href: null }}
      />
      <Tabs.Screen
        name="propiedades"
        options={{ title: 'Propiedades', href: null }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <UserIcon size={21} color={color} />,
        }}
      />
    </Tabs>
  );
}
