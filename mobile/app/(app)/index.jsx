import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Dimensions,
  Modal, TextInput, Platform, KeyboardAvoidingView, Animated, Image,
} from 'react-native';
import Svg, { Path, Polyline, Circle } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useCondo } from '../../src/context/CondoContext';
import { useTheme } from '../../src/context/ThemeContext';
import { spacing, radius, font } from '../../src/theme';
import { BuildingIcon, UsersIcon, UserPlusIcon, BellIcon, AlertTriangleIcon, ClockIcon, UserIcon, CalendarIcon } from '../../src/components/Icons';
import AppDrawer from '../../src/components/Drawer';
import * as api from '../../src/api';
import { supabase } from '../../src/supabase';

const WIN_W       = Dimensions.get('window').width;
const WIN_H       = Dimensions.get('window').height;
const INNER_W     = WIN_W - spacing.lg * 2 - spacing.md * 2;
const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const ANUNCIO_TARGET = {
  todos:        { accent: '#7c3aed', bg: '#ede9fe', text: '#5b21b6' },
  propietarios: { accent: '#1d4ed8', bg: '#dbeafe', text: '#1d4ed8' },
  inquilinos:   { accent: '#059669', bg: '#d1fae5', text: '#065f46' },
  seguridad:    { accent: '#dc2626', bg: '#fee2e2', text: '#991b1b' },
};
const ANUNCIO_TARGET_LABEL = {
  propietarios: 'Propietarios',
  inquilinos:   'Inquilinos',
  seguridad:    'Seguridad',
};

function parseFecha(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (y > 1000) return new Date(y, m - 1, d);
    return new Date(d, m - 1, y);
  }
  const d = new Date(str); return isNaN(d) ? null : d;
}

function buildDashboards(condos, propiedades, visitas) {
  return condos.map(condo => {
    const props   = propiedades.filter(p => p.condo === condo.name);
    const owners  = new Set(props.filter(p => p.owner && p.owner !== '-').map(p => p.owner));
    const tenants = new Set(props.flatMap(p => [p.tenant1, p.tenant2, p.tenant3]).filter(t => t && t !== '-'));
    const condoVisits = visitas.filter(v => v.condo === condo.name);

    return {
      id: condo.id, name: condo.name,
      propertiesCount: props.length,
      ownersCount:     owners.size,
      tenantsCount:    tenants.size,
      visitsCount:     condoVisits.length,
      peatonalCount:   condoVisits.filter(v => !v.placa || v.placa === '-').length,
      vehicularCount:  condoVisits.filter(v => v.placa && v.placa !== '-').length,
    };
  });
}

// ─────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────
function KpiCard({ label, value, variant, iconEl }) {
  const { isDark } = useTheme();
  const KPI_V = {
    blue:  { cardBg: isDark ? '#1a2340' : '#edf2ff', border: isDark ? '#2a3a5e' : '#d9dfeb', iconBg: '#3b82f6' },
    green: { cardBg: isDark ? '#142a20' : '#eaf8ef', border: isDark ? '#1e3d2c' : '#bfe2cc', iconBg: '#00c853' },
  };
  const v = KPI_V[variant];
  return (
    <View style={[styles.kpiCard, { backgroundColor: v.cardBg, borderColor: v.border }]}>
      <View style={[styles.kpiIcon, { backgroundColor: v.iconBg }]}>{iconEl}</View>
      <View style={styles.kpiText}>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.kpiLabel, { color: isDark ? '#fff' : '#1e293b' }]}>{label}</Text>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.kpiValue, { color: isDark ? '#fff' : '#0f172a' }]}>{value}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Line chart (SVG)
// ─────────────────────────────────────────────
function LineChart({ data }) {
  const { colors } = useTheme();
  const H = 80, W = INNER_W;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const n = data.length;
  const pts = data.map((d, i) => ({
    x: n === 1 ? W / 2 : (i / (n - 1)) * (W - 16) + 8,
    y: H - Math.max((d.value / maxVal) * (H - 14), d.value > 0 ? 8 : 2),
  }));
  const ptStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <View>
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        {n > 1 && (
          <Polyline points={ptStr} fill="none" stroke="#00c853" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
        )}
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill="#00c853" opacity={0.9} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {data.map(d => (
          <Text key={d.label} style={{ fontSize: 9, color: colors.textMuted }}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Pie chart (SVG) — Tipo de Ingreso
// ─────────────────────────────────────────────
function PieChart({ peatonal, vehicular }) {
  const { colors } = useTheme();
  const total = peatonal + vehicular;
  if (!total) {
    return <Text style={{ color: colors.textMuted, fontSize: font.sm }}>Sin datos de visitas registradas</Text>;
  }
  const R = 60, CX = 70, CY = 70;
  const sliceData = [
    { label: 'Peatonal',  value: peatonal,  color: '#4f46e5' },
    { label: 'Vehicular', value: vehicular, color: '#00c853' },
  ];
  let cum = 0;
  const slices = sliceData.map(d => {
    const startA = (cum / total) * 2 * Math.PI - Math.PI / 2;
    cum += d.value;
    const endA = (cum / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = CX + R * Math.cos(startA), y1 = CY + R * Math.sin(startA);
    const x2 = CX + R * Math.cos(endA),   y2 = CY + R * Math.sin(endA);
    const large = (endA - startA) > Math.PI ? 1 : 0;
    return {
      ...d,
      pct: Math.round(d.value / total * 100),
      path: `M ${CX} ${CY} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`,
    };
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
      <Svg width={140} height={140}>
        {slices.map((s, i) => <Path key={i} d={s.path} fill={s.color} />)}
      </Svg>
      <View style={{ gap: 10 }}>
        {slices.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <Text style={{ fontSize: 13, color: s.color, fontWeight: '600' }}>
              {s.label} {s.pct}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Metric 2×2 grid
// ─────────────────────────────────────────────
function MetricItem({ label, value, color }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: '30%', backgroundColor: colors.metricBg, borderRadius: 8, padding: 10 }}>
      <Text allowFontScaling={false} style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>{label}</Text>
      <Text allowFontScaling={false} style={{ fontSize: 13, fontWeight: '700', color: color || colors.text }}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────
export default function DashboardScreen() {
  const { isSuperAdmin, isAdmin, isResident, isOwner, isTenant, isSeguridad, user } = useAuth();
  const { condoName: ctxCondoName } = useCondo();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Admin state
  const [dashboards,      setDashboards]      = useState([]);
  const [historial,       setHistorial]       = useState([]);
  const [selectedId,      setSelectedId]      = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [panicAlerts,     setPanicAlerts]     = useState([]);
  const [pendingReservas, setPendingReservas] = useState([]);

  // Resident state
  const [resReservas,   setResReservas]   = useState([]);
  const [resAnuncios,   setResAnuncios]   = useState([]);
  const [resAreaFotos,  setResAreaFotos]  = useState({});
  const [resLoading,    setResLoading]    = useState(true);
  const [resRefreshing, setResRefreshing] = useState(false);
  const [visitModal,    setVisitModal]    = useState(false);
  const [visitForm,     setVisitForm]     = useState({ nombre: '', tipo: 'peatonal', placa: '', fecha: '', nota: '' });
  const [visitLoading,  setVisitLoading]  = useState(false);
  const [visitError,    setVisitError]    = useState('');
  const visitSlideAnim = useRef(new Animated.Value(700)).current;

  // Security state
  const [secLoading,    setSecLoading]    = useState(true);
  const [secRefreshing, setSecRefreshing] = useState(false);
  const [secActivas,    setSecActivas]    = useState(0);
  const [secVisitasHoy, setSecVisitasHoy] = useState(0);
  const [secAdentro,    setSecAdentro]    = useState(0);
  const [secRecientes,  setSecRecientes]  = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [c, props, h] = await Promise.all([
        api.getCondominios(), api.getPropiedades(), api.getHistorialVisitas(),
      ]);
      const condoList = Array.isArray(c)     ? c     : (c.condominios    ?? []);
      const propList  = Array.isArray(props) ? props : (props.propiedades ?? []);
      const histList  = Array.isArray(h)     ? h     : (h.historial      ?? []);
      setHistorial(histList);
      setDashboards(buildDashboards(condoList, propList, histList));
      setSelectedId(prev => prev ?? (condoList[0]?.id ?? null));
    } catch (e) { console.warn('Dashboard:', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const loadQuickStats = useCallback(async () => {
    try {
      const [alerts, reservas] = await Promise.all([
        api.getPanicAlerts(ctxCondoName),
        api.getReservasAreas(),
      ]);
      const alertList   = Array.isArray(alerts)  ? alerts  : [];
      const reservaList = Array.isArray(reservas) ? reservas : (reservas?.reservas ?? []);
      setPanicAlerts(alertList.slice(0, 4));
      setPendingReservas(reservaList.filter(r => r.estado === 'pendiente').slice(0, 4));
    } catch (e) { console.warn('QuickStats:', e.message); }
  }, [ctxCondoName]);

  const loadResidentData = useCallback(async () => {
    try {
      const [reservas, anunciosRes, areas] = await Promise.all([
        api.getReservasAreas(),
        api.getAnunciosPaged({ page: 1, limit: 5 }),
        api.getAreasSociales(),
      ]);
      const rList = Array.isArray(reservas) ? reservas : (reservas?.reservas ?? []);
      const aList = anunciosRes?.data ? anunciosRes.data : (Array.isArray(anunciosRes) ? anunciosRes : []);
      const areasList = Array.isArray(areas) ? areas : [];

      const fotoMap = {};
      areasList.forEach(a => {
        const imgs = Array.isArray(a.imagenUrl) ? a.imagenUrl : (a.imagenUrl ? [a.imagenUrl] : []);
        if (imgs.length > 0) fotoMap[a.id] = imgs[0];
      });
      setResAreaFotos(fotoMap);

      const now = new Date();
      const proximas = rList
        .filter(r => new Date(`${r.fecha}T${r.horaFin || '23:59'}`) >= now)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      setResReservas(proximas);
      setResAnuncios(aList);
    } catch (e) { console.warn('Resident data:', e.message); }
    finally { setResLoading(false); setResRefreshing(false); }
  }, []);

  const loadSecurityData = useCallback(async () => {
    try {
      const [alerts, histRes] = await Promise.all([
        api.getPanicAlerts(user?.condo),
        api.getHistorialVisitasPaged({ limit: 100 }),
      ]);
      const alertList = Array.isArray(alerts) ? alerts : [];
      setSecActivas(alertList.filter(a => a.status === 'Pendiente' || a.status === 'En camino').length);

      const histList = histRes?.data
        ? histRes.data
        : (Array.isArray(histRes) ? histRes : (histRes?.historial ?? []));

      const todayISO = new Date().toISOString().split('T')[0];
      const [y, m, d] = todayISO.split('-');
      const todayDMY = `${d}/${m}/${y}`;
      const isToday = (r) => r.fecha === todayISO || r.fecha === todayDMY;

      const hoy = histList.filter(isToday);
      setSecVisitasHoy(hoy.length);
      setSecAdentro(hoy.filter(r => !r.salida).length);
      setSecRecientes(histList.slice(0, 10));
    } catch (e) { console.warn('Security data:', e.message); }
    finally { setSecLoading(false); setSecRefreshing(false); }
  }, [user?.condo]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    loadQuickStats();
    const iv = setInterval(loadQuickStats, 30000);
    return () => clearInterval(iv);
  }, [loadQuickStats]);
  useEffect(() => {
    if (isResident) loadResidentData();
  }, [isResident, loadResidentData]);
  useEffect(() => {
    if (isSeguridad) loadSecurityData();
  }, [isSeguridad, loadSecurityData]);

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isResident) return;
    const channel = supabase
      .channel('resident-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anuncios' },
        () => loadResidentData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas_areas' },
        () => loadResidentData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isResident, loadResidentData]);

  useEffect(() => {
    if (!isSeguridad) return;
    const channel = supabase
      .channel('security-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'panic_alerts' },
        () => loadSecurityData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historial_visitas' },
        () => loadSecurityData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isSeguridad, loadSecurityData]);

  const onRefresh = () => { setRefreshing(true); loadData(); loadQuickStats(); };
  const onResRefresh = () => { setResRefreshing(true); loadResidentData(); };

  const roleLabel =
    isSuperAdmin ? 'Super Admin'
    : isAdmin     ? 'Administrador'
    : isSeguridad ? 'Seguridad'
    : isOwner     ? 'Propietario'
    : isTenant    ? 'Inquilino'
    : 'Residente';

  // ── Seguridad dashboard ───────────────────────────────────────────────────
  if (isSeguridad) {
    const onSecRefresh = () => { setSecRefreshing(true); loadSecurityData(); };
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
            <Text style={styles.hamburgerLines}>≡</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Inicio</Text>
          <View style={styles.rolePill}>
            <View style={styles.roleOrangeDot} />
            <Text style={styles.rolePillText}>Seguridad</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
          refreshControl={<RefreshControl refreshing={secRefreshing} onRefresh={onSecRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          <Text style={styles.pageTitle}>Hola, {user?.name}</Text>
          <Text style={[styles.pageSub, { marginBottom: spacing.lg }]}>{user?.condo}</Text>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: spacing.md }]}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: -1 }}>
                {secLoading ? '—' : secVisitasHoy}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: '600', textAlign: 'center' }}>VISITAS HOY</Text>
            </View>
            <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: spacing.md }]}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: secAdentro > 0 ? colors.warning : colors.text, letterSpacing: -1 }}>
                {secLoading ? '—' : secAdentro}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: '600', textAlign: 'center' }}>ADENTRO AHORA</Text>
            </View>
          </View>

          {/* Alertas de pánico */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/panico')}
            activeOpacity={0.82}
            style={[
              styles.card,
              {
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                borderWidth: 1.5,
                borderColor: secActivas > 0 ? (isDark ? 'rgba(239,68,68,0.35)' : '#fca5a5') : colors.border,
                backgroundColor: secActivas > 0 ? (isDark ? 'rgba(239,68,68,0.08)' : '#fff5f5') : colors.cardBg,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: secActivas > 0 ? (isDark ? 'rgba(239,68,68,0.15)' : '#dc2626') : (isDark ? colors.surface : '#f3f4f6'),
            }}>
              <AlertTriangleIcon size={20} color={secActivas > 0 ? (isDark ? '#f87171' : '#fff') : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: font.base, color: secActivas > 0 ? (isDark ? '#f87171' : '#dc2626') : colors.text }}>
                {secActivas > 0 ? `${secActivas} alerta${secActivas > 1 ? 's' : ''} activa${secActivas > 1 ? 's' : ''}` : 'Sin alertas activas'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
                {secActivas > 0 ? 'Tocá para ver y atender' : 'Botón de pánico en calma'}
              </Text>
            </View>
            <Text style={{ fontSize: 18, color: secActivas > 0 ? (isDark ? '#f87171' : '#dc2626') : colors.textMuted }}>›</Text>
          </TouchableOpacity>

          {/* Accesos rápidos */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            <TouchableOpacity
              onPress={() => router.push('/(app)/visitas')}
              activeOpacity={0.82}
              style={[styles.card, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <UserIcon size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: font.sm, color: colors.text }}>Registrar visita</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>Entrada / salida</Text>
              </View>
              <Text style={{ fontSize: 16, color: colors.textMuted }}>›</Text>
            </TouchableOpacity>

          </View>

          {/* Últimas entradas */}
          <Text style={[styles.sectionLabel, { marginBottom: spacing.sm }]}>ÚLTIMAS ENTRADAS</Text>
          {secLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : secRecientes.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.lg }]}>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>No hay registros recientes.</Text>
            </View>
          ) : (
            <>
              {secRecientes.map((r, i) => (
                <View key={r.id ?? i} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserIcon size={17} color={colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: font.sm, color: colors.text }} numberOfLines={1}>{r.visitante || '—'}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{r.propiedad || ''}{r.tipo ? ` · ${r.tipo}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {r.entrada ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <ClockIcon size={11} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>{r.entrada}</Text>
                      </View>
                    ) : null}
                    {!r.salida ? (
                      <View style={{ backgroundColor: isDark ? '#14532d' : '#dcfce7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#16a34a' }}>ADENTRO</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: colors.inputBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: colors.textMuted }}>SALIÓ</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity onPress={() => router.push('/(app)/visitas')} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sm }}>Ver historial completo →</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </SafeAreaView>
    );
  }

  // ── Resident dashboard ────────────────────────────────────────────────────
  if (isResident) {
    const openVisitModal = () => {
      setVisitError('');
      setVisitModal(true);
      visitSlideAnim.setValue(700);
      Animated.spring(visitSlideAnim, { toValue: 0, damping: 24, stiffness: 170, useNativeDriver: true }).start();
    };
    const closeVisitModal = () => {
      Animated.timing(visitSlideAnim, { toValue: 700, duration: 210, useNativeDriver: true })
        .start(() => setVisitModal(false));
    };
    const handleCreateVisit = async () => {
      if (!visitForm.nombre.trim()) { setVisitError('El nombre es requerido.'); return; }
      if (!visitForm.fecha.trim())  { setVisitError('La fecha es requerida.'); return; }
      if (visitForm.tipo === 'vehicular' && !visitForm.placa.trim()) { setVisitError('La placa es requerida.'); return; }
      setVisitLoading(true); setVisitError('');
      try {
        await api.createVisita({
          nombre: visitForm.nombre.trim(),
          placa:  visitForm.tipo === 'vehicular' ? visitForm.placa.trim() : '',
          fecha:  visitForm.fecha.trim(),
          nota:   visitForm.nota.trim(),
          condo:  user?.condo || '',
          propiedad: user?.property || '',
          preRegistro: true,
        });
        closeVisitModal();
        setVisitForm({ nombre: '', tipo: 'peatonal', placa: '', fecha: '', nota: '' });
      } catch (e) {
        setVisitError(e.message || 'Error al registrar la visita.');
      } finally { setVisitLoading(false); }
    };

    const ESTADO_COLORS = {
      aprobada:  { bg: '#d1fae5', text: '#065f46' },
      rechazada: { bg: '#fee2e2', text: '#991b1b' },
      pendiente: { bg: isDark ? 'rgba(251,191,36,0.15)' : '#fef3c7', text: isDark ? '#fbbf24' : '#92400e' },
    };

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
            <Text style={styles.hamburgerLines}>≡</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Inicio</Text>
          <View style={styles.rolePill}>
            <View style={styles.roleOrangeDot} />
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={resRefreshing} onRefresh={onResRefresh} tintColor={colors.primary} />}
        >
          {/* Bienvenida */}
          <Text style={styles.pageTitle}>Hola, {user?.name}</Text>
          <Text style={styles.pageSub}>{user?.condo}</Text>
          {user?.property ? (
            <Text style={[styles.pageSub, { marginBottom: spacing.lg, color: colors.primary, fontWeight: '600' }]}>{user.property}</Text>
          ) : (
            <View style={{ marginBottom: spacing.lg }} />
          )}

          {/* CTA Pre-registrar visita */}
          <TouchableOpacity
            style={{
              borderRadius: radius.lg,
              marginBottom: spacing.md,
              overflow: 'hidden',
              backgroundColor: isDark ? 'rgba(99,102,241,0.13)' : '#eef2ff',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(99,102,241,0.32)' : '#c7d2fe',
            }}
            onPress={openVisitModal}
            activeOpacity={0.82}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md }}>
              {/* Ícono con fondo degradado simulado */}
              <View style={{
                width: 52, height: 52, borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
              }}>
                <UserPlusIcon size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: font.base, fontWeight: '800', color: colors.text, letterSpacing: -0.2 }}>
                  Pre-registrar visita
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17 }}>
                  Avisá al guardia quién te va a visitar
                </Text>
              </View>
              <View style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#dde4ff',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '700', lineHeight: 20 }}>›</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Mis Reservas */}
          <Text style={styles.sectionLabel}>MIS RESERVAS PRÓXIMAS</Text>
          {resLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : resReservas.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.lg }]}>
              <Text style={{ color: colors.textMuted, fontSize: font.sm, marginBottom: spacing.sm }}>No tenés reservas próximas.</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/reservas')}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sm }}>Hacer una reserva →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {resReservas.slice(0, 3).map(r => {
                const ec = ESTADO_COLORS[r.estado] ?? ESTADO_COLORS.pendiente;
                const foto = resAreaFotos[r.areaId];
                return (
                  <View key={r.id} style={[styles.card, { marginBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}>
                    {foto ? (
                      <Image source={{ uri: foto }} style={{ width: 44, height: 44, borderRadius: radius.sm, flexShrink: 0 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CalendarIcon size={18} color={colors.border} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: colors.text, fontSize: font.sm }} numberOfLines={1}>{r.areaNombre}</Text>
                      {r.propiedad ? <Text style={{ fontSize: 11, color: colors.textMuted }} numberOfLines={1}>{r.propiedad}</Text> : null}
                    </View>
                    <View style={{ backgroundColor: ec.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 0 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: ec.text, textTransform: 'capitalize' }}>{r.estado}</Text>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity onPress={() => router.push('/(app)/reservas')} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sm }}>Ver todas mis reservas →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Anuncios recientes */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>ANUNCIOS RECIENTES</Text>
          {resLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : resAnuncios.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.lg }]}>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>No hay anuncios recientes.</Text>
            </View>
          ) : (
            <>
              {resAnuncios.map(a => {
                const tStyle = ANUNCIO_TARGET[a.target] ?? ANUNCIO_TARGET.todos;
                const accentColor = (isAdmin || isSuperAdmin) ? tStyle.accent : '#7c3aed';
                const dateStr = a.createdAt
                  ? new Date(a.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                  : null;
                return (
                  <View key={a.id} style={[styles.card, styles.anuncioCard, { marginBottom: spacing.sm }]}>
                    <View style={[styles.anuncioAccent, { backgroundColor: accentColor }]} />
                    <View style={styles.anuncioIconWrap}>
                      <BellIcon size={16} color={accentColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.sm, flex: 1 }} numberOfLines={1}>{a.title}</Text>
                        {dateStr && <Text style={{ color: colors.textMuted, fontSize: 10, marginLeft: 6, flexShrink: 0 }}>{dateStr}</Text>}
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{a.message}</Text>
                      {(isAdmin || isSuperAdmin) && a.target && a.target !== 'todos' && (
                        <View style={[styles.anuncioChip, { backgroundColor: tStyle.bg }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: tStyle.text, letterSpacing: 0.3 }}>
                            {ANUNCIO_TARGET_LABEL[a.target] ?? a.target}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity onPress={() => router.push('/(app)/anuncios')} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sm }}>Ver todos los anuncios →</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Modal pre-registrar visita */}
        <Modal visible={visitModal} animationType="none" transparent statusBarTranslucent onRequestClose={closeVisitModal}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={closeVisitModal} />
            <Animated.View style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              transform: [{ translateY: visitSlideAnim }],
            }}>
              {/* Header */}
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: font.lg, fontWeight: '800', color: colors.text }}>Pre-registrar visita</Text>
                <TouchableOpacity onPress={closeVisitModal}>
                  <Text style={{ fontSize: 20, color: colors.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Form */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
                style={{ maxHeight: WIN_H * 0.55 }}
              >
                <Text style={styles.resLabel}>Nombre del visitante *</Text>
                <TextInput
                  style={styles.resInput}
                  value={visitForm.nombre}
                  onChangeText={t => setVisitForm(f => ({ ...f, nombre: t }))}
                  placeholder="Nombre completo"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.resLabel}>Tipo de visita</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                  {['peatonal', 'vehicular'].map(tipo => (
                    <TouchableOpacity
                      key={tipo}
                      style={{
                        flex: 1, paddingVertical: 11, borderRadius: radius.md,
                        borderWidth: 1.5, alignItems: 'center',
                        borderColor: visitForm.tipo === tipo ? colors.primary : colors.border,
                        backgroundColor: visitForm.tipo === tipo
                          ? (isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff')
                          : colors.inputBg,
                      }}
                      onPress={() => setVisitForm(f => ({ ...f, tipo, placa: '' }))}
                    >
                      <Text style={{ fontWeight: '600', fontSize: font.sm, color: visitForm.tipo === tipo ? colors.primary : colors.text2 }}>
                        {tipo === 'peatonal' ? '🚶 Peatonal' : '🚗 Vehicular'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {visitForm.tipo === 'vehicular' && (
                  <>
                    <Text style={styles.resLabel}>Placa del vehículo *</Text>
                    <TextInput
                      style={styles.resInput}
                      value={visitForm.placa}
                      onChangeText={t => setVisitForm(f => ({ ...f, placa: t.toUpperCase() }))}
                      placeholder="Ej: ABC-1234"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                    />
                  </>
                )}

                <Text style={styles.resLabel}>Fecha de visita *</Text>
                <TextInput
                  style={styles.resInput}
                  value={visitForm.fecha}
                  onChangeText={t => setVisitForm(f => ({ ...f, fecha: t }))}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />

                <Text style={styles.resLabel}>Nota (opcional)</Text>
                <TextInput
                  style={[styles.resInput, { height: 72, textAlignVertical: 'top' }]}
                  value={visitForm.nota}
                  onChangeText={t => setVisitForm(f => ({ ...f, nota: t }))}
                  placeholder="Motivo, hora estimada, etc."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </ScrollView>

              {/* Footer */}
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg + insets.bottom }}>
                {visitError ? <Text style={{ fontSize: 12, color: colors.danger, marginBottom: spacing.sm }}>{visitError}</Text> : null}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity style={styles.resBtnSec} onPress={closeVisitModal}>
                    <Text style={styles.resBtnSecText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.resBtnPri, visitLoading && { opacity: 0.6 }]} onPress={handleCreateVisit} disabled={visitLoading}>
                    <Text style={styles.resBtnPriText}>{visitLoading ? 'Registrando…' : 'Registrar visita'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </Modal>

        <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </SafeAreaView>
    );
  }

  const selected = dashboards.find(d => d.id === selectedId) ?? dashboards[0] ?? {
    propertiesCount: 0, ownersCount: 0, tenantsCount: 0,
    visitsCount: 0, peatonalCount: 0, vehicularCount: 0,
  };

  const now = new Date();
  const condoHistorial = selected?.name
    ? historial.filter(v => v.condo === selected.name)
    : historial;

  const visitBuckets = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    visitBuckets[d.toDateString()] = { label: DAY_NAMES[d.getDay()], value: 0 };
  }
  condoHistorial.forEach(v => {
    const d = parseFecha(v.fecha);
    if (d) { const k = d.toDateString(); if (visitBuckets[k]) visitBuckets[k].value++; }
  });
  const visitsByDay = Object.values(visitBuckets);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>Cargando dashboard…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
          <Text style={styles.hamburgerLines}>≡</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Dashboard</Text>
        <View style={styles.rolePill}>
          <View style={styles.roleOrangeDot} />
          <Text style={styles.rolePillText}>{roleLabel}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.pageTitle}>Dashboard Global</Text>
        <Text style={styles.pageSub}>Resumen general del condominio.</Text>

        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.selectorLabel}>CONDOMINIO</Text>
          <Text style={{ fontSize: font.base, fontWeight: '600', color: colors.text }}>{ctxCondoName || '—'}</Text>
        </View>

        {/* 1. Condo summary */}
        <View style={styles.card}>
          <View style={styles.condoHead}>
            <Text style={styles.condoName} numberOfLines={1}>{selected.name}</Text>
            <View style={styles.chip}><Text style={styles.chipText}>{selected.propertiesCount} unidades</Text></View>
          </View>
          <View style={styles.metricsGrid}>
            <MetricItem label="Propietarios" value={selected.ownersCount} />
            <MetricItem label="Inquilinos"   value={selected.tenantsCount} />
            <MetricItem label="Visitas"      value={selected.visitsCount} />
          </View>
        </View>

        {/* 2. Alertas de pánico recientes */}
        {panicAlerts.length > 0 && (
          <TouchableOpacity style={[styles.card, styles.quickCard]} activeOpacity={0.85} onPress={() => router.push('/(app)/panico')}>
            <View style={styles.quickCardHead}>
              <View style={[styles.quickDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.quickCardTitle}>Alertas de pánico recientes</Text>
            </View>
            {panicAlerts.map(a => {
              const isPending = a.status !== 'Atendida' && a.status !== 'En camino';
              return (
                <View key={a.id} style={styles.quickRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Text style={styles.quickRowMain} numberOfLines={1}>{a.resident}</Text>
                    <View style={[styles.statusPill, {
                      backgroundColor:
                        a.status === 'Atendida'  ? '#d1fae5' :
                        a.status === 'En camino' ? '#fef3c7' :
                        isDark ? 'rgba(239,68,68,0.18)' : '#fee2e2',
                      borderWidth: isPending && isDark ? 1 : 0,
                      borderColor: isPending && isDark ? 'rgba(239,68,68,0.45)' : 'transparent',
                    }]}>
                      <Text style={[styles.statusPillText, {
                        color:
                          a.status === 'Atendida'  ? '#065f46' :
                          a.status === 'En camino' ? '#92400e' :
                          isDark ? '#fca5a5' : '#991b1b',
                      }]}>{a.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.quickRowSub}>{a.createdAt}</Text>
                </View>
              );
            })}
          </TouchableOpacity>
        )}

        {/* 3. Visitas por Día */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Visitas por Día</Text>
          <LineChart data={visitsByDay} />
        </View>

        {/* 4. Tipo de Ingreso */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tipo de Ingreso</Text>
          <PieChart
            peatonal={condoHistorial.filter(v => !v.placa || v.placa === '-').length}
            vehicular={condoHistorial.filter(v => v.placa && v.placa !== '-').length}
          />
        </View>
      </ScrollView>

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
function makeStyles(colors) {
  const CARD_SHADOW = {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  };
  return StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },

    topBar: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    hamburger:      { marginRight: spacing.sm, padding: 2 },
    hamburgerLines: { fontSize: 22, color: colors.text, lineHeight: 26 },
    topBarTitle:    { flex: 1, fontSize: font.lg, fontWeight: '700', color: colors.text },
    rolePill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: colors.disabledBg, borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    roleOrangeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f59e0b' },
    rolePillText:  { fontSize: 11, fontWeight: '600', color: colors.text2 },

    pageTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 4 },
    pageSub:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },

    selectorLabel: {
      fontSize: 10, fontWeight: '700', color: colors.textMuted,
      letterSpacing: 0.8, marginBottom: 6,
    },

    kpiGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },

    quickCard: { marginBottom: spacing.md },
    quickCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    quickDot:  { width: 8, height: 8, borderRadius: 4 },
    quickCardTitle: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.text },
    quickBadge: { backgroundColor: '#fef3c7', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
    quickBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400e' },
    quickRow: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border },
    quickRowMain: { fontSize: font.sm, fontWeight: '600', color: colors.text, flex: 1 },
    quickRowSub:  { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    statusPillText: { fontSize: 10, fontWeight: '700' },
    kpiCard: {
      width: '48%', flexDirection: 'row', alignItems: 'center',
      padding: 12, borderRadius: 14, borderWidth: 1.5, ...CARD_SHADOW,
    },
    kpiIcon:  { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    kpiText:  { flex: 1, overflow: 'hidden' },
    kpiLabel: { fontSize: 10, fontWeight: '600', color: colors.text2, marginBottom: 2 },
    kpiValue: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },

    card: {
      backgroundColor: colors.cardBg,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...CARD_SHADOW,
    },
    cardTitle:    { fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
    sectionLabel: {
      fontSize: 10, fontWeight: '700', color: colors.textMuted,
      letterSpacing: 0.8, marginBottom: spacing.sm,
    },

    condoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    condoName: { fontSize: font.base, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm },
    chip:      { backgroundColor: colors.chipBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    chipText:  { fontSize: 11, color: colors.primary, fontWeight: '700' },

    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    metricItem:  { flex: 1, minWidth: '30%', backgroundColor: colors.metricBg, borderRadius: radius.sm, padding: spacing.sm },
    metricLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 2 },
    metricValue: { fontSize: font.sm, fontWeight: '700', color: colors.text },

    // Resident dashboard form styles
    resLabel:      { fontSize: 12, fontWeight: '600', color: colors.text2, marginBottom: 4, marginTop: spacing.sm },
    resInput:      { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: font.base, color: colors.text, backgroundColor: colors.inputBg },
    resBtnSec:     { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
    resBtnSecText: { fontSize: font.sm, fontWeight: '600', color: colors.text2 },
    resBtnPri:     { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
    resBtnPriText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },

    // Anuncio card
    anuncioCard:    { flexDirection: 'row', alignItems: 'flex-start', padding: 0, paddingRight: spacing.md, paddingVertical: spacing.md, overflow: 'hidden' },
    anuncioAccent:  { width: 4, alignSelf: 'stretch', marginRight: spacing.sm },
    anuncioIconWrap:{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, flexShrink: 0 },
    anuncioChip:    { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 6 },
  });
}
