import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Dimensions,
} from 'react-native';
import Svg, { Path, Polyline, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useCondo } from '../../src/context/CondoContext';
import { useTheme } from '../../src/context/ThemeContext';
import { colors, spacing, radius, font } from '../../src/theme';
import { BuildingIcon, UsersIcon } from '../../src/components/Icons';
import AppDrawer from '../../src/components/Drawer';
import * as api from '../../src/api';

const WIN_W       = Dimensions.get('window').width;
const INNER_W     = WIN_W - spacing.lg * 2 - spacing.md * 2;
const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

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

const styles = makeStyles(colors);

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
        <Text style={[styles.kpiLabel, { color: '#fff' }]}>{label}</Text>
        <Text style={[styles.kpiValue, { color: '#fff' }]}>{value}</Text>
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
      <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: color || colors.text }}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────
export default function DashboardScreen() {
  const { isSuperAdmin, isAdmin, isResident, isSeguridad, user } = useAuth();
  const { condoName: ctxCondoName } = useCondo();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dashboards, setDashboards] = useState([]);
  const [historial,  setHistorial]  = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

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

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const roleLabel =
    isSuperAdmin ? 'Super Admin'
    : isAdmin    ? 'Administrador'
    : isSeguridad ? 'Seguridad'
    : 'Residente';

  // ── Resident / Security simple ────────────────────────────────────────────
  if (!isSuperAdmin && !isAdmin) {
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
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.pageTitle}>Hola, {user?.name?.split(' ')[0]}</Text>
          <Text style={styles.pageSub}>{user?.condo}</Text>
          <View style={[styles.card, { marginTop: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.primary }]}>
            <Text style={{ fontSize: font.base, color: colors.text, lineHeight: 22 }}>
              {isSeguridad
                ? 'Registrá entradas y salidas desde la pestaña Visitas.'
                : 'Accedé a tus reservas y anuncios desde el menú lateral.'}
            </Text>
          </View>
        </ScrollView>
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

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KpiCard label="Unidades"     value={selected.propertiesCount} variant="blue"  iconEl={<BuildingIcon size={22} color="#fff" />} />
          <KpiCard label="Propietarios" value={selected.ownersCount}     variant="green" iconEl={<UsersIcon    size={22} color="#fff" />} />
        </View>

        {/* Condo summary */}
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Visitas por Día</Text>
          <LineChart data={visitsByDay} />
        </View>

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
    kpiCard: {
      width: '48%', flexDirection: 'row', alignItems: 'center',
      padding: 14, borderRadius: 14, borderWidth: 1.5, minHeight: 80, ...CARD_SHADOW,
    },
    kpiIcon:  { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    kpiText:  { flex: 1 },
    kpiLabel: { fontSize: 11, fontWeight: '600', color: colors.text2, marginBottom: 2 },
    kpiValue: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },

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
  });
}
