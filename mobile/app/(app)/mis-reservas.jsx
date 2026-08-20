import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  Alert, RefreshControl, ActivityIndicator, TextInput, Switch,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { spacing, radius, font } from '../../src/theme';
import AppDrawer from '../../src/components/Drawer';
import * as api from '../../src/api';

const SHADOW = {
  shadowColor: '#101828', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
};

const ESTADO_STYLE = {
  pendiente: { bg: '#fef9c3', text: '#92400e' },
  aprobada:  { bg: '#d1fae5', text: '#065f46' },
  rechazada: { bg: '#fee2e2', text: '#991b1b' },
};

const TODAY = new Date().toISOString().split('T')[0];

function horariosConflictan(ini1, fin1, ini2, fin2) {
  return !(fin1 <= ini2 || ini1 >= fin2);
}
function reservasConflictan(a, b) {
  if (a.diaCompleto || b.diaCompleto) return true;
  return horariosConflictan(a.horaInicio, a.horaFin, b.horaInicio, b.horaFin);
}

export default function MisReservasScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [areas,    setAreas]    = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Area selection + form
  const [selectedArea, setSelectedArea] = useState(null);
  const [form, setForm] = useState({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '', diaCompleto: false });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Change request
  const [changingId, setChangingId] = useState(null);
  const [changeForm, setChangeForm] = useState({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '', diaCompleto: false });
  const [changeLoading, setChangeLoading] = useState(false);

  const [reservaTab, setReservaTab] = useState('proximas');

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [areasRes, reservasRes] = await Promise.all([
        api.getAreasSociales(),
        api.getReservasAreas(),
      ]);
      setAreas(Array.isArray(areasRes) ? areasRes.filter(a => a.activo !== false) : []);
      setReservas(Array.isArray(reservasRes) ? reservasRes : []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(false); };

  const misReservas = reservas.filter(r => r.propietario === user?.name);
  const now = new Date();
  const esPasada = r => new Date(`${r.fecha}T${r.horaFin || '23:59'}`) < now;
  const proximas = misReservas.filter(r => !esPasada(r));
  const pasadas  = misReservas.filter(r => esPasada(r));
  const visible  = reservaTab === 'pasadas' ? pasadas : proximas;

  // Conflict detection
  const ocupados = selectedArea && form.fecha
    ? reservas.filter(r => r.areaId === selectedArea.id && r.fecha === form.fecha && r.estado !== 'rechazada')
    : [];
  const conflicto = ocupados.find(r => reservasConflictan(
    { diaCompleto: form.diaCompleto, horaInicio: form.diaCompleto ? '00:00' : form.horaInicio, horaFin: form.diaCompleto ? '23:59' : form.horaFin },
    { diaCompleto: r.diaCompleto, horaInicio: r.horaInicio, horaFin: r.horaFin }
  ));

  const handleCrear = async () => {
    if (!form.fecha) { setFormError('Elegí una fecha.'); return; }
    if (!form.diaCompleto && form.horaInicio >= form.horaFin) {
      setFormError('La hora de fin debe ser mayor a la de inicio.'); return;
    }
    if (conflicto) { setFormError('Ese horario ya está ocupado.'); return; }
    setFormLoading(true); setFormError('');
    try {
      const nueva = await api.createReservaArea({
        areaId:      selectedArea.id,
        areaNombre:  selectedArea.nombre,
        fecha:       form.fecha,
        horaInicio:  form.horaInicio,
        horaFin:     form.horaFin,
        diaCompleto: form.diaCompleto,
        nota:        form.nota,
      });
      setReservas(prev => [nueva, ...prev]);
      setSelectedArea(null);
      setForm({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '', diaCompleto: false });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleCambio = async (reservaId) => {
    if (!changeForm.fecha) { Alert.alert('Fecha requerida'); return; }
    if (!changeForm.diaCompleto && changeForm.horaInicio >= changeForm.horaFin) {
      Alert.alert('La hora de fin debe ser mayor'); return;
    }
    setChangeLoading(true);
    try {
      const updated = await api.solicitarCambioReserva(reservaId, changeForm);
      setReservas(prev => prev.map(r => r.id === reservaId ? updated : r));
      setChangingId(null);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setChangeLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Area selection view
  if (selectedArea) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setSelectedArea(null)} style={styles.hamburger}>
            <Text style={[styles.hamburgerLines, { fontSize: 18 }]}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>{selectedArea.nombre}</Text>
          <View style={{ width: 60 }} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.pageTitle}>Reservar: {selectedArea.nombre}</Text>
            <Text style={styles.anticipacion}>Las reservas deben hacerse con al menos 24 hs de anticipación.</Text>

            <View style={styles.card}>
              <Text style={styles.label}>Fecha *</Text>
              <TextInput
                style={styles.input}
                value={form.fecha}
                onChangeText={t => setForm(f => ({ ...f, fecha: t }))}
                placeholder={TODAY}
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.switchRow}>
                <Text style={styles.label}>Reservar todo el día</Text>
                <Switch
                  value={form.diaCompleto}
                  onValueChange={v => setForm(f => ({ ...f, diaCompleto: v }))}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor="#fff"
                  disabled={ocupados.length > 0}
                />
              </View>

              {!form.diaCompleto && (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Hora inicio</Text>
                    <TextInput
                      style={styles.input}
                      value={form.horaInicio}
                      onChangeText={t => setForm(f => ({ ...f, horaInicio: t }))}
                      placeholder="08:00"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Hora fin</Text>
                    <TextInput
                      style={styles.input}
                      value={form.horaFin}
                      onChangeText={t => setForm(f => ({ ...f, horaFin: t }))}
                      placeholder="10:00"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              )}

              <Text style={styles.label}>Nota (opcional)</Text>
              <TextInput
                style={styles.input}
                value={form.nota}
                onChangeText={t => setForm(f => ({ ...f, nota: t }))}
                placeholder="Motivo o comentario"
                placeholderTextColor={colors.textMuted}
              />

              {form.fecha && ocupados.length > 0 && (
                <View style={styles.ocupadosBox}>
                  <Text style={styles.ocupadosTitle}>Horarios ocupados ese día:</Text>
                  {ocupados.map(r => (
                    <Text key={r.id} style={styles.ocupadoChip}>
                      {r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}
                    </Text>
                  ))}
                  {conflicto && <Text style={styles.conflictoMsg}>⚠ Ese horario ya está ocupado — elegí otro.</Text>}
                </View>
              )}

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              <View style={[styles.rowBtns, { marginTop: spacing.sm }]}>
                <TouchableOpacity style={styles.btnSec} onPress={() => setSelectedArea(null)}>
                  <Text style={styles.btnSecText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPri, (formLoading || !!conflicto) && { opacity: 0.5 }]}
                  onPress={handleCrear}
                  disabled={formLoading || !!conflicto}
                >
                  <Text style={styles.btnPriText}>{formLoading ? 'Enviando…' : 'Solicitar Reserva'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
          <Text style={styles.hamburgerLines}>≡</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Reservas</Text>
        <View style={styles.rolePill}>
          <View style={styles.roleOrangeDot} />
          <Text style={styles.rolePillText}>Residente</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.pageTitle}>Reservar Áreas</Text>
        <Text style={styles.pageSub}>Consultá las áreas sociales disponibles y realizá tu reserva.</Text>

        {/* Available areas */}
        {areas.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.xl }]}>
            <Text style={{ color: colors.textMuted }}>El administrador aún no creó áreas sociales.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>ÁREAS DISPONIBLES</Text>
            {areas.map(area => {
              const imgs = Array.isArray(area.imagenUrl)
                ? area.imagenUrl
                : (area.imagenUrl ? [area.imagenUrl] : []);
              return (
              <View key={area.id} style={styles.areaCard}>
                {imgs.length > 0 && (
                  <Image source={{ uri: imgs[0] }} style={styles.areaThumb} resizeMode="cover" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.areaName}>{area.nombre}</Text>
                  {area.descripcion ? <Text style={styles.areaDesc} numberOfLines={2}>{area.descripcion}</Text> : null}
                </View>
                <TouchableOpacity
                  style={styles.reservarBtn}
                  onPress={() => {
                    setSelectedArea(area);
                    setForm({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '', diaCompleto: false });
                    setFormError('');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.reservarBtnText}>Reservar</Text>
                </TouchableOpacity>
              </View>
            );})}

          </>
        )}

        {/* My reservations */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>MIS RESERVAS</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, reservaTab === 'proximas' && styles.tabActive]}
            onPress={() => setReservaTab('proximas')}
          >
            <Text style={[styles.tabText, reservaTab === 'proximas' && styles.tabTextActive]}>
              Próximas{proximas.length ? ` (${proximas.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, reservaTab === 'pasadas' && styles.tabActive]}
            onPress={() => setReservaTab('pasadas')}
          >
            <Text style={[styles.tabText, reservaTab === 'pasadas' && styles.tabTextActive]}>
              Pasadas{pasadas.length ? ` (${pasadas.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {visible.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.lg }]}>
            <Text style={{ color: colors.textMuted, fontSize: font.sm }}>
              {reservaTab === 'pasadas' ? 'Sin reservas pasadas.' : 'Aún no realizaste ninguna reserva.'}
            </Text>
          </View>
        ) : visible.map(r => {
          const s = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.pendiente;
          const isChanging = changingId === r.id;
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.reservaTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reservaArea}>{r.areaNombre}</Text>
                  <Text style={styles.reservaFecha}>
                    📅 {r.fecha}  ·  🕐 {r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}
                  </Text>
                  {r.nota ? <Text style={styles.reservaNota}>"{r.nota}"</Text> : null}
                  {r.solicitudCambio && (
                    <Text style={[styles.cambioStatus, {
                      color: r.solicitudCambio.estado === 'aprobada' ? colors.success
                        : r.solicitudCambio.estado === 'rechazada' ? colors.danger
                        : '#f59e0b',
                    }]}>
                      Cambio {r.solicitudCambio.estado}: {r.solicitudCambio.fecha} {r.solicitudCambio.horaInicio}–{r.solicitudCambio.horaFin}
                    </Text>
                  )}
                </View>
                <View style={[styles.estadoBadge, { backgroundColor: s.bg }]}>
                  <Text style={[styles.estadoBadgeText, { color: s.text }]}>{r.estado}</Text>
                </View>
              </View>

              {reservaTab === 'proximas' && r.estado === 'aprobada' && !r.solicitudCambio?.estado?.includes('pendiente') && (
                isChanging ? (
                  <View style={styles.changeForm}>
                    <Text style={styles.label}>Nueva fecha</Text>
                    <TextInput
                      style={styles.input}
                      value={changeForm.fecha}
                      onChangeText={t => setChangeForm(f => ({ ...f, fecha: t }))}
                      placeholder={TODAY}
                      placeholderTextColor={colors.textMuted}
                    />
                    <View style={styles.switchRow}>
                      <Text style={styles.label}>Todo el día</Text>
                      <Switch
                        value={changeForm.diaCompleto}
                        onValueChange={v => setChangeForm(f => ({ ...f, diaCompleto: v }))}
                        trackColor={{ true: colors.primary, false: colors.border }}
                        thumbColor="#fff"
                      />
                    </View>
                    {!changeForm.diaCompleto && (
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Hora inicio</Text>
                          <TextInput style={styles.input} value={changeForm.horaInicio} onChangeText={t => setChangeForm(f => ({ ...f, horaInicio: t }))} placeholder="08:00" placeholderTextColor={colors.textMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Hora fin</Text>
                          <TextInput style={styles.input} value={changeForm.horaFin} onChangeText={t => setChangeForm(f => ({ ...f, horaFin: t }))} placeholder="10:00" placeholderTextColor={colors.textMuted} />
                        </View>
                      </View>
                    )}
                    <Text style={styles.label}>Motivo</Text>
                    <TextInput style={styles.input} value={changeForm.nota} onChangeText={t => setChangeForm(f => ({ ...f, nota: t }))} placeholder="Motivo del cambio" placeholderTextColor={colors.textMuted} />
                    <View style={[styles.rowBtns, { marginTop: spacing.sm }]}>
                      <TouchableOpacity style={styles.btnSec} onPress={() => setChangingId(null)}>
                        <Text style={styles.btnSecText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnPri, changeLoading && { opacity: 0.6 }]}
                        onPress={() => handleCambio(r.id)}
                        disabled={changeLoading}
                      >
                        <Text style={styles.btnPriText}>{changeLoading ? '…' : 'Enviar solicitud'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.changeBtn}
                    onPress={() => { setChangingId(r.id); setChangeForm({ fecha: r.fecha, horaInicio: r.horaInicio, horaFin: r.horaFin, nota: '', diaCompleto: !!r.diaCompleto }); }}
                  >
                    <Text style={styles.changeBtnText}>Solicitar cambio de fecha</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          );
        })}
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
    backgroundColor: '#f2f4f7', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  roleOrangeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f59e0b' },
  rolePillText:  { fontSize: 11, fontWeight: '600', color: colors.text2 },

  content:   { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  pageTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 2 },
  pageSub:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, marginBottom: spacing.sm },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  areaCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  areaThumb:   { width: 64, height: 64, borderRadius: radius.md, marginRight: spacing.sm },
  areaName:    { fontSize: font.base, fontWeight: '700', color: colors.text, marginBottom: 2 },
  areaDesc:    { fontSize: font.sm, color: colors.text2, marginBottom: 4 },
  areaPrice:   { fontSize: 12, fontWeight: '600', color: colors.primary },
  anticipacion:{ fontSize: 12, color: '#92400e', backgroundColor: '#fffbeb', borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: '#fde68a' },
  reservarBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 9, marginLeft: spacing.sm,
  },
  reservarBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  tabs:         { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tabActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:      { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  tabTextActive:{ color: '#fff' },

  reservaTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: spacing.xs },
  reservaArea:  { fontSize: font.base, fontWeight: '700', color: colors.text, marginBottom: 2 },
  reservaFecha: { fontSize: font.sm, color: colors.text2, marginBottom: 2 },
  reservaNota:  { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: 2 },
  cambioStatus: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  estadoBadge:  { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', flexShrink: 0 },
  estadoBadgeText: { fontSize: 11, fontWeight: '700' },

  changeBtn:     { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
  changeBtnText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  changeForm:    { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },

  label:      { fontSize: 12, fontWeight: '600', color: colors.text2, marginBottom: 4, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 11,
    fontSize: font.base, color: colors.text, backgroundColor: '#f9fafb',
  },
  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  rowBtns:     { flexDirection: 'row', gap: 8 },
  btnSec:      { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnSecText:  { fontSize: font.sm, fontWeight: '600', color: colors.text2 },
  btnPri:      { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnPriText:  { fontSize: font.sm, fontWeight: '700', color: '#fff' },

  ocupadosBox:   { backgroundColor: '#fff8ec', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm, borderWidth: 1, borderColor: '#fde68a' },
  ocupadosTitle: { fontSize: 12, fontWeight: '600', color: '#92400e', marginBottom: 4 },
  ocupadoChip:   { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  conflictoMsg:  { fontSize: 12, color: colors.danger, marginTop: 4 },
  errorText:     { fontSize: 12, color: colors.danger, marginTop: spacing.sm },
});
}