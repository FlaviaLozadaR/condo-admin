import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  Alert, RefreshControl, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useCondo } from '../../src/context/CondoContext';
import { spacing, radius, font } from '../../src/theme';
import AppDrawer from '../../src/components/Drawer';
import * as api from '../../src/api';
import Svg, { Path, Rect as SvgRect } from 'react-native-svg';

function TrashIcon({ size = 20, color = '#dc2626' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <Path d="M8 6V4h8v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M19 6l-1 14H6L5 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M10 11v5M14 11v5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </Svg>
  );
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CURRENT_YEAR = new Date().getFullYear();

const SHADOW = {
  shadowColor: '#101828', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
};

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function InlinePicker({ value, options, onSelect }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const triggerRef = React.useRef(null);
  const selected = options.find(o => o.value === value);
  const ps = {
    picker:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderColor:colors.border, borderRadius:radius.sm, paddingHorizontal:12, paddingVertical:10, backgroundColor:colors.inputBg },
    pickerOpen:  { borderColor:colors.primary },
    pickerText:  { flex:1, fontSize:font.sm, color:colors.text },
    pickerArrow: { fontSize:16, color:colors.textMuted, marginLeft:6 },
    dropItem:    { paddingHorizontal:12, paddingVertical:11, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth:1, borderBottomColor:colors.border },
    dropText:    { fontSize:font.sm, color:colors.text, flex:1 },
    dropTextActive: { fontWeight:'700', color:colors.primary },
  };
  const openPicker = () => {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      setLayout({ x, y, width: w, height: h });
      setOpen(true);
    });
  };
  return (
    <View>
      <TouchableOpacity
        ref={triggerRef}
        style={[ps.picker, open && ps.pickerOpen]}
        onPress={openPicker}
        activeOpacity={0.85}
      >
        <Text style={ps.pickerText} numberOfLines={1}>{selected?.label ?? 'Seleccionar'}</Text>
        <Text style={ps.pickerArrow}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={{
            position: 'absolute',
            top: layout.y + layout.height + 4,
            left: layout.x,
            width: layout.width,
            maxHeight: 240,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 16,
          }}>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={ps.dropItem}
                  onPress={() => { onSelect(opt.value); setOpen(false); }}
                >
                  <Text style={[ps.dropText, value === opt.value && ps.dropTextActive]} numberOfLines={1}>
                    {opt.label}
                  </Text>
                  {value === opt.value && <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function PanicoScreen() {
  const { user, isSuperAdmin, isAdmin, isSeguridad, isOwner, isTenant, isResident } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { condoName: ctxCondoName } = useCondo();

  const canView   = isSuperAdmin || isAdmin || isSeguridad;
  const canManage = isSeguridad;

  const [alerts, setAlerts]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [tab, setTab]                   = useState('activas');
  const [yearFilter,  setYearFilter]    = useState(CURRENT_YEAR);
  const [monthFilter, setMonthFilter]   = useState(() => new Date().getMonth() + 1);
  const [condos, setCondos]             = useState([]);
  const [condoFilter, setCondoFilter]   = useState(null);
  const [attendedPage, setAttendedPage] = useState(1);
  const PAGE_SIZE = 10;
  const [contacts, setContacts]         = useState([]);
  const [myProp, setMyProp]             = useState(null);
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [successOpen, setSuccessOpen]   = useState(false);
  const [sendingPanic, setSendingPanic] = useState(false);
  const [drawerOpen, setDrawerOpen]     = useState(false);

  const condoName = isSuperAdmin
    ? condos.find(c => String(c.id) === condoFilter)?.name
    : undefined;

  const loadAlerts = useCallback((showLoading = true) => {
    if (showLoading) setLoading(true);
    return api.getPanicAlerts(condoName)
      .then(res => setAlerts(Array.isArray(res) ? res : []))
      .catch(err => Alert.alert('Error', err.message))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [condoName]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  useEffect(() => {
    if (isSuperAdmin) {
      api.getCondominios()
        .then(res => {
          const list = Array.isArray(res) ? res : (res?.condominios ?? []);
          setCondos(list);
          if (list.length > 0) setCondoFilter(String(list[0].id));
        })
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isResident) {
      api.getSeguridadContacts().then(setContacts).catch(() => {});
      api.getMyProperty().then(setMyProp).catch(() => {});
    }
  }, [isResident]);

  const onRefresh = () => { setRefreshing(true); loadAlerts(false); };

  useEffect(() => { setAttendedPage(1); }, [tab, yearFilter, monthFilter]);
  useEffect(() => {
    const max = yearFilter === CURRENT_YEAR ? new Date().getMonth() + 1 : 12;
    if (monthFilter > max) setMonthFilter(0);
  }, [yearFilter]);

  const updateStatus = async (id, status) => {
    try {
      await api.updatePanicStatus(String(id), status);
      setAlerts(prev => prev.map(a => String(a.id) === String(id) ? { ...a, status } : a));
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handlePanic = async () => {
    setSendingPanic(true);
    try {
      await api.createPanicAlert({
        resident: user?.name,
        phone:    user?.phone || '',
        address:  myProp?.street || user?.condo || 'Sin dirección',
        unit:     myProp?.code || '',
        condo:    user?.condo || '',
      });
      setConfirmOpen(false);
      setSuccessOpen(true);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSendingPanic(false);
    }
  };

  const activeAlerts   = alerts.filter(a => a.status !== 'Atendida');
  const attendedAlerts = alerts.filter(a => a.status === 'Atendida');

  // Year options: all years from data + current year, always present
  const yearsInData = [...new Set(attendedAlerts.map(a => new Date(a.insertedAt || a.createdAt).getFullYear()).filter(y => !isNaN(y)))];
  if (!yearsInData.includes(CURRENT_YEAR)) yearsInData.push(CURRENT_YEAR);
  yearsInData.sort((a, b) => b - a);
  const yearOptions = yearsInData.map(y => ({ value: y, label: String(y) }));

  // Month options: up to current month if current year, all 12 if past year
  const currentMonth = new Date().getMonth() + 1;
  const maxMonth = yearFilter === CURRENT_YEAR ? currentMonth : 12;
  const monthOptions = [
    { value: 0, label: 'Todos los meses' },
    ...MESES.slice(0, maxMonth).map((m, i) => ({ value: i + 1, label: m })),
  ];

  const visibleAttended = attendedAlerts.filter(a => {
    const d = new Date(a.insertedAt || a.createdAt);
    if (isNaN(d)) return false;
    if (d.getFullYear() !== yearFilter) return false;
    if (monthFilter !== 0 && d.getMonth() + 1 !== monthFilter) return false;
    return true;
  });

  const pagedAttended  = visibleAttended.slice(0, attendedPage * PAGE_SIZE);
  const hasMoreAttended = visibleAttended.length > pagedAttended.length;

  const roleLabel =
    isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador'
    : isSeguridad ? 'Seguridad' : isOwner ? 'Propietario' : isTenant ? 'Inquilino' : 'Residente';

  // ── Resident view ──────────────────────────────────────────────────────────
  if (isResident) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
            <Text style={styles.hamburgerLines}>≡</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Botón de Pánico</Text>
          <View style={styles.rolePill}>
            <View style={styles.roleOrangeDot} />
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.panicCenter}>
            <View style={styles.panicIconWrap}>
              <Text style={styles.panicIconText}>!</Text>
            </View>
            <Text style={styles.panicH1}>Alerta de Emergencia</Text>
            <Text style={styles.panicSub}>Presioná el botón solo en caso de emergencia real</Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Información de tu propiedad</Text>
              {user?.condo ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Dirección:</Text>
                  <Text style={styles.infoVal}>{user.condo}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Unidad:</Text>
                <Text style={styles.infoVal}>{myProp?.street || user?.property || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Residente:</Text>
                <Text style={styles.infoVal}>{user?.name}</Text>
              </View>
              {user?.phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Teléfono:</Text>
                  <Text style={styles.infoVal}>{user.phone}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.panicBtn} onPress={() => setConfirmOpen(true)} activeOpacity={0.8}>
              <Text style={styles.panicBtnText}>ACTIVAR ALERTA DE EMERGENCIA</Text>
            </TouchableOpacity>

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>Advertencia</Text>
              <Text style={styles.warningText}>
                El uso indebido del botón de pánico puede resultar en sanciones. Utilizalo solo en situaciones de emergencia real.
              </Text>
            </View>

            {contacts.length > 0 && (
              <View style={[styles.card, { width: '100%', marginTop: spacing.sm }]}>
                <Text style={styles.sectionLabel}>LLAMAR A SEGURIDAD</Text>
                {contacts.map(c => (
                  <View key={c.id} style={styles.contactRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName}>{c.name}</Text>
                      <Text style={styles.contactPhone}>{c.phone || 'Sin número registrado'}</Text>
                    </View>
                    {c.phone && (
                      <TouchableOpacity
                        style={styles.callBtn}
                        onPress={() => {
                          const clean = c.phone.replace(/[^\d+]/g, '');
                          const url = `tel:${clean}`;
                          Linking.canOpenURL(url).then(supported => {
                            if (supported) Linking.openURL(url);
                            else Alert.alert('Error', 'Este dispositivo no puede realizar llamadas.');
                          });
                        }}
                      >
                        <Text style={styles.callBtnText}>Llamar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Confirm panic modal */}
        <Modal visible={confirmOpen} animationType="none" transparent onRequestClose={() => setConfirmOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.modalCard, { alignItems: 'center' }]}>
              <View style={[styles.panicIconWrap, { width: 56, height: 56, borderRadius: 28, marginBottom: spacing.sm }]}>
                <Text style={[styles.panicIconText, { fontSize: 26 }]}>!</Text>
              </View>
              <Text style={styles.modalTitle}>¿Activar alerta de pánico?</Text>
              <Text style={[styles.pageSub, { textAlign: 'center', marginBottom: spacing.md }]}>
                Se notificará al equipo de seguridad de tu condominio inmediatamente.
              </Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnSec} onPress={() => setConfirmOpen(false)}>
                  <Text style={styles.btnSecText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnDanger, sendingPanic && { opacity: 0.6 }]}
                  onPress={handlePanic}
                  disabled={sendingPanic}
                >
                  <Text style={styles.btnDangerText}>{sendingPanic ? 'Enviando…' : 'Confirmar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Success modal */}
        <Modal visible={successOpen} animationType="none" transparent onRequestClose={() => setSuccessOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.modalCard, { alignItems: 'center' }]}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <Text style={{ fontSize: 26, color: '#16a34a' }}>✓</Text>
              </View>
              <Text style={styles.modalTitle}>Alerta enviada</Text>
              <Text style={[styles.pageSub, { textAlign: 'center', marginBottom: spacing.lg }]}>
                El equipo de seguridad fue notificado. Mantente en un lugar seguro.
              </Text>
              <TouchableOpacity
                onPress={() => setSuccessOpen(false)}
                style={{ width: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: spacing.sm }}
              >
                <Text style={{ fontSize: font.sm, fontWeight: '600', color: colors.text2 }}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </SafeAreaView>
    );
  }

  // ── Security / Admin view ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
          <Text style={styles.hamburgerLines}>≡</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Botón de Pánico</Text>
        <View style={styles.rolePill}>
          <View style={styles.roleOrangeDot} />
          <Text style={styles.rolePillText}>{roleLabel}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.danger} />}
      >
        <Text style={styles.pageTitle}>Alertas de Pánico</Text>
        <Text style={styles.pageSub}>
          {canManage
            ? 'Alertas activadas por propietarios que requieren asistencia inmediata.'
            : 'Solo Seguridad puede cambiar el estado de una alerta.'}
        </Text>

        {isSuperAdmin && (
          <View style={{ paddingVertical: 4, marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Condominio</Text>
            <Text style={{ fontSize: font.sm, fontWeight: '600', color: colors.text }}>
              {ctxCondoName || '—'}
            </Text>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'activas' && styles.tabActive]}
            onPress={() => setTab('activas')}
          >
            <Text style={[styles.tabText, tab === 'activas' && styles.tabTextActive]}>
              Activas{activeAlerts.length ? ` (${activeAlerts.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'atendidas' && styles.tabActive]}
            onPress={() => setTab('atendidas')}
          >
            <Text style={[styles.tabText, tab === 'atendidas' && styles.tabTextActive]}>
              Atendidas{attendedAlerts.length ? ` (${attendedAlerts.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'atendidas' && (
          <View style={{ flexDirection: 'row', gap: spacing.sm, zIndex: 100, elevation: 10, marginBottom: spacing.sm }}>
            <View style={{ flex: 1, zIndex: 100 }}>
              <InlinePicker
                value={yearFilter}
                options={yearOptions}
                onSelect={v => setYearFilter(v)}
              />
            </View>
            <View style={{ flex: 2, zIndex: 99 }}>
              <InlinePicker
                value={monthFilter}
                options={monthOptions}
                onSelect={v => setMonthFilter(v)}
              />
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={colors.danger} style={{ marginTop: spacing.xl }} />
        ) : tab === 'activas' ? (
          activeAlerts.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.xl }]}>
              <Text style={{ color: colors.textMuted, fontSize: font.base }}>No hay alertas activas en este momento.</Text>
            </View>
          ) : activeAlerts.map(alert => (
            <View key={alert.id} style={[styles.card, styles.alertCard]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertName}>{alert.resident}</Text>
                <Text style={styles.alertAddr}>
                  {alert.address} - {alert.unit}
                  {isSuperAdmin && alert.condo ? ` · ${alert.condo}` : ''}
                </Text>
                <Text style={styles.alertMeta}>Tel: {alert.phone} · {alert.insertedAt || alert.createdAt || ''}</Text>
              </View>
              <View style={styles.alertRight}>
                <View style={[styles.statusChip,
                  alert.status === 'Pendiente' ? styles.statusPending : styles.statusWay]}>
                  <Text style={styles.statusChipText}>{alert.status}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  {canManage && (
                    alert.status === 'Pendiente' ? (
                      <TouchableOpacity style={styles.alertBtn} onPress={() => updateStatus(alert.id, 'En camino')}>
                        <Text style={styles.alertBtnText}>En camino</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[styles.alertBtn, styles.alertBtnDone]} onPress={() => updateStatus(alert.id, 'Atendida')}>
                        <Text style={styles.alertBtnText}>Atendida</Text>
                      </TouchableOpacity>
                    )
                  )}
                  {isSuperAdmin && (
                    <TouchableOpacity style={styles.alertBtnDelete} onPress={() => Alert.alert('Eliminar alerta', '¿Segura que querés eliminar esta alerta?', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await api.deletePanicAlert(String(alert.id)); setAlerts(prev => prev.filter(a => String(a.id) !== String(alert.id))); } catch (e) { Alert.alert('Error', e.message); } } },
                    ])}>
                      <TrashIcon size={15} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        ) : (
          visibleAttended.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.xl }]}>
              <Text style={{ color: colors.textMuted, fontSize: font.base }}>No hay alertas atendidas en este período.</Text>
            </View>
          ) : (
            <>
              {pagedAttended.map(alert => (
                <View key={alert.id} style={[styles.card, { opacity: 0.75 }]}>
                  <Text style={styles.alertName}>{alert.resident}</Text>
                  <Text style={styles.alertAddr}>
                    {alert.address} - {alert.unit}
                    {isSuperAdmin && alert.condo ? ` · ${alert.condo}` : ''}
                  </Text>
                  <Text style={styles.alertMeta}>Tel: {alert.phone} · {alert.insertedAt || alert.createdAt || ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 }}>
                    <View style={[styles.statusChip, styles.statusDone]}>
                      <Text style={[styles.statusChipText, { color: '#065f46' }]}>Atendida</Text>
                    </View>
                    {isSuperAdmin && (
                      <TouchableOpacity style={styles.alertBtnDelete} onPress={() => Alert.alert('Eliminar alerta', '¿Segura que querés eliminar esta alerta?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await api.deletePanicAlert(String(alert.id)); setAlerts(prev => prev.filter(a => String(a.id) !== String(alert.id))); } catch (e) { Alert.alert('Error', e.message); } } },
                      ])}>
                        <TrashIcon size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {hasMoreAttended && (
                <TouchableOpacity style={styles.verMasBtn} onPress={() => setAttendedPage(p => p + 1)}>
                  <Text style={styles.verMasBtnText}>Ver más ({visibleAttended.length - pagedAttended.length} restantes)</Text>
                </TouchableOpacity>
              )}
            </>
          )
        )}
      </ScrollView>

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
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

  content:   { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  pageTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 4 },
  pageSub:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },

  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, ...SHADOW,
  },
  pickerOpen:  { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: 'transparent', marginBottom: 0 },
  pickerText:  { fontSize: font.base, color: colors.text, flex: 1 },
  pickerArrow: { fontSize: 16, color: colors.textMuted },
  drop: {
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.border,
    backgroundColor: colors.surface, borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md, overflow: 'hidden', elevation: 8,
  },
  dropItem:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropItemActive: { backgroundColor: '#f5f3ff' },
  dropText:       { fontSize: font.base, color: colors.text, flex: 1 },
  dropTextActive: { color: colors.primary, fontWeight: '700' },

  tabs:         { flexDirection: 'row', gap: 6, marginTop: 28, marginBottom: spacing.md },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tabActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:      { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  tabTextActive:{ color: '#fff' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  alertCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderLeftWidth: 3, borderLeftColor: colors.danger },
  alertName:   { fontSize: font.base, fontWeight: '700', color: colors.text, marginBottom: 2 },
  alertAddr:   { fontSize: font.sm, color: colors.text2, marginBottom: 2 },
  alertMeta:   { fontSize: 11, color: colors.textMuted },
  alertRight:  { alignItems: 'flex-end', gap: 6 },
  alertBtn:    { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  alertBtnDone:{ backgroundColor: colors.success },
  alertBtnText:{ fontSize: 11, fontWeight: '700', color: '#fff' },

  statusChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusPending:  { backgroundColor: '#fef9c3' },
  statusWay:      { backgroundColor: '#dbeafe' },
  statusDone:     { backgroundColor: '#d1fae5' },
  statusChipText: { fontSize: 11, fontWeight: '700', color: colors.text2 },

  verMasBtn:          { alignItems: 'center', paddingVertical: 14, marginBottom: spacing.sm },
  verMasBtnText:      { fontSize: font.sm, fontWeight: '600', color: colors.primary },
  alertBtnDelete:     { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: '#fca5a5', alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, marginBottom: spacing.sm },

  // Resident view
  panicCenter: { alignItems: 'center', paddingTop: spacing.lg },
  panicIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  panicIconText: { fontSize: 36, color: '#fff', fontWeight: '900', lineHeight: 40 },
  panicH1:  { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: 4 },
  panicSub: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },

  infoBox: {
    width: '100%', backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  infoTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  infoLabel: { fontSize: font.sm, color: colors.textMuted },
  infoVal:   { fontSize: font.sm, fontWeight: '600', color: colors.text },

  panicBtn: {
    width: '100%', backgroundColor: colors.danger, borderRadius: radius.lg,
    paddingVertical: 18, alignItems: 'center', marginBottom: spacing.md,
    shadowColor: colors.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  panicBtnText: { fontSize: font.base, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

  warningBox: {
    width: '100%', backgroundColor: '#fffbeb', borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: '#fde68a',
  },
  warningTitle: { fontSize: font.sm, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  warningText:  { fontSize: font.sm, color: '#78350f', lineHeight: 20 },

  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  contactName: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  contactPhone:{ fontSize: 12, color: colors.textMuted },
  callBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  callBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...SHADOW,
  },
  modalTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  pageSub:    { fontSize: font.sm, color: colors.textMuted },
  modalBtns:  { flexDirection: 'row', gap: 8, width: '100%' },
  btnSec:     { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnSecText: { fontSize: font.sm, fontWeight: '600', color: colors.text2 },
  btnDanger:  { flex: 1, backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnDangerText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },
});
}