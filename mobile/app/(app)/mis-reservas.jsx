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
import { CalendarIcon, ClockIcon } from '../../src/components/Icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as api from '../../src/api';

const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function CustomCalendar({ selected, onSelect, minDate }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekDay = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const cells = [];
  for (let i = 0; i < firstWeekDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: '#111827', fontWeight: '600' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: '#111827', fontWeight: '600' }}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAY_NAMES.map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#6b7280' }}>{d}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((day, ci) => {
            if (!day) return <View key={`e-${ri}-${ci}`} style={{ flex: 1, height: 42 }} />;
            const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const cellDate = new Date(viewYear, viewMonth, day);
            const isPast = minDate && cellDate < today;
            const isSelected = selected === dateStr;
            return (
              <TouchableOpacity
                key={day}
                onPress={() => !isPast && onSelect(dateStr)}
                disabled={isPast}
                style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isSelected ? '#6d28d9' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '400', color: isSelected ? '#fff' : isPast ? '#d1d5db' : '#111827' }}>{day}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

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
  const { user, isSuperAdmin, isAdmin, isOwner, isTenant, isSeguridad } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [areas,    setAreas]    = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Area detail (before form)
  const [detailArea, setDetailArea] = useState(null);
  const [imgModal, setImgModal]     = useState(null);

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
  const [reservaPage, setReservaPage] = useState(1);
  const PAGE_SIZE = 10;
  const [picker, setPicker] = useState({ visible: false, mode: 'date', target: 'fecha', form: 'main' });

  const openPicker = (mode, target, form) => setPicker({ visible: true, mode, target, form });
  const onPickerChange = (event, selected) => {
    setPicker(p => ({ ...p, visible: false }));
    if (!selected) return;
    if (picker.mode === 'date') {
      const dateStr = selected.toISOString().split('T')[0];
      if (picker.form === 'main') setForm(f => ({ ...f, fecha: dateStr }));
      else setChangeForm(f => ({ ...f, fecha: dateStr }));
    } else {
      const h = String(selected.getHours()).padStart(2, '0');
      const m = String(selected.getMinutes()).padStart(2, '0');
      const timeStr = `${h}:${m}`;
      if (picker.form === 'main') setForm(f => ({ ...f, [picker.target]: timeStr }));
      else setChangeForm(f => ({ ...f, [picker.target]: timeStr }));
    }
  };
  const toTimeDate = (str) => { const [h, m] = (str || '08:00').split(':'); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; };
  const [iosPickerTemp, setIosPickerTemp] = useState(null);
  const pickerValue = () => {
    const isMain = picker.form === 'main';
    if (picker.mode === 'date') {
      const f = isMain ? form.fecha : changeForm.fecha;
      return f ? new Date(f + 'T12:00:00') : new Date();
    }
    const t = isMain
      ? (picker.target === 'horaInicio' ? form.horaInicio : form.horaFin)
      : (picker.target === 'horaInicio' ? changeForm.horaInicio : changeForm.horaFin);
    return toTimeDate(t);
  };
  const onIosConfirm = () => {
    onPickerChange({ type: 'set' }, iosPickerTemp ?? new Date());
    setIosPickerTemp(null);
  };

  const toDateStr = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  };
  const iosDateStr = iosPickerTemp ? toDateStr(iosPickerTemp) : toDateStr(new Date());

  const pickerJSX = Platform.OS === 'ios' ? (
    <Modal visible={picker.visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { setPicker(p => ({ ...p, visible: false })); setIosPickerTemp(null); }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => { setPicker(p => ({ ...p, visible: false })); setIosPickerTemp(null); }}>
              <Text style={{ fontSize: 16, color: '#6b7280' }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{picker.mode === 'date' ? 'Seleccioná fecha' : 'Seleccioná hora'}</Text>
            <TouchableOpacity onPress={onIosConfirm}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>Listo</Text>
            </TouchableOpacity>
          </View>
          {picker.mode === 'date' ? (
            <CustomCalendar
              key={picker.visible ? 'open' : 'closed'}
              selected={iosDateStr}
              minDate={new Date()}
              onSelect={(dateStr) => {
                const [y, mo, d] = dateStr.split('-').map(Number);
                const dt = new Date(y, mo - 1, d, 12, 0, 0);
                setIosPickerTemp(dt);
              }}
            />
          ) : (
            <DateTimePicker
              value={iosPickerTemp ?? pickerValue()}
              mode="time"
              display="spinner"
              onChange={(e, d) => { if (d) setIosPickerTemp(d); }}
              textColor="#000000"
              style={{ alignSelf: 'center', width: '100%', backgroundColor: '#ffffff' }}
            />
          )}
        </View>
      </View>
    </Modal>
  ) : picker.visible ? (
    <DateTimePicker
      value={pickerValue()}
      mode={picker.mode}
      display={picker.mode === 'date' ? 'calendar' : 'clock'}
      onChange={onPickerChange}
      minimumDate={picker.mode === 'date' ? new Date() : undefined}
    />
  ) : null;

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

  const now = new Date();
  const esPasada = r => new Date(`${r.fecha}T${r.horaFin || '23:59'}`) < now;
  const proximas = reservas.filter(r => !esPasada(r));
  const pasadas  = reservas.filter(r => esPasada(r));
  const allVisible = reservaTab === 'pasadas' ? pasadas : proximas;
  const totalPages = Math.max(1, Math.ceil(allVisible.length / PAGE_SIZE));
  const visible = allVisible.slice((reservaPage - 1) * PAGE_SIZE, reservaPage * PAGE_SIZE);

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

  // Area detail view
  if (detailArea) {
    const imgs = Array.isArray(detailArea.imagenUrl)
      ? detailArea.imagenUrl
      : (detailArea.imagenUrl ? [detailArea.imagenUrl] : []);
    const firstImg = imgs[0] ?? null;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setDetailArea(null)} style={styles.hamburger}>
            <Text style={[styles.hamburgerLines, { fontSize: 18 }]}>← Volver</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {firstImg && (
            <TouchableOpacity onPress={() => setImgModal(firstImg)} activeOpacity={0.9}>
              <Image source={{ uri: firstImg }} style={{ width: '100%', height: 220, borderRadius: radius.lg, marginBottom: spacing.md }} resizeMode="cover" />
            </TouchableOpacity>
          )}
          <Text style={styles.pageTitle}>{detailArea.nombre}</Text>
          {detailArea.descripcion ? (
            <Text style={[styles.pageSub, { marginBottom: spacing.md }]}>{detailArea.descripcion}</Text>
          ) : null}
          <TouchableOpacity
            style={{ marginTop: spacing.sm, alignSelf: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: 14 }}
            onPress={() => {
              setDetailArea(null);
              setSelectedArea(detailArea);
              setForm({ fecha: '', horaInicio: '08:00', horaFin: '10:00', nota: '', diaCompleto: false });
              setFormError('');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnPriText, { fontSize: font.base }]}>Reservar área</Text>
          </TouchableOpacity>
        </ScrollView>
        <Modal visible={!!imgModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setImgModal(null)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={1} onPress={() => setImgModal(null)}>
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} maximumZoomScale={4} minimumZoomScale={1} bouncesZoom centerContent>
              {imgModal && <Image source={{ uri: imgModal }} style={{ width: '100%', height: 340 }} resizeMode="contain" />}
            </ScrollView>
            <TouchableOpacity style={{ position: 'absolute', top: 48, right: 20, padding: 8 }} onPress={() => setImgModal(null)}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '300' }}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
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
              <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('date', 'fecha', 'main')} activeOpacity={0.8}>
                <CalendarIcon size={16} color={colors.primary} />
                <Text style={[styles.pickerBtnText, !form.fecha && { color: colors.textMuted }]}>
                  {form.fecha || 'Seleccioná una fecha'}
                </Text>
              </TouchableOpacity>

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
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('time', 'horaInicio', 'main')} activeOpacity={0.8}>
                      <ClockIcon size={16} color={colors.primary} />
                      <Text style={styles.pickerBtnText}>{form.horaInicio}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Hora fin</Text>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('time', 'horaFin', 'main')} activeOpacity={0.8}>
                      <ClockIcon size={16} color={colors.primary} />
                      <Text style={styles.pickerBtnText}>{form.horaFin}</Text>
                    </TouchableOpacity>
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
        {pickerJSX}
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
          <Text style={styles.rolePillText}>{isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador' : isSeguridad ? 'Seguridad' : isOwner ? 'Propietario' : isTenant ? 'Inquilino' : 'Residente'}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.pageTitle}>Reservar Áreas</Text>
        <Text style={styles.pageSub}>Consultá las áreas sociales disponibles y realizá tu reserva.</Text>

        {/* Available areas — horizontal scroll */}
        <Text style={styles.sectionLabel}>ÁREAS DISPONIBLES</Text>
        {areas.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.lg }]}>
            <Text style={{ color: colors.textMuted }}>El administrador aún no creó áreas sociales.</Text>
          </View>
        ) : (
          <>{areas.map(area => {
            const imgs = Array.isArray(area.imagenUrl)
              ? area.imagenUrl
              : (area.imagenUrl ? [area.imagenUrl] : []);
            return (
              <TouchableOpacity
                key={area.id}
                style={styles.areaCard}
                onPress={() => setDetailArea(area)}
                activeOpacity={0.85}
              >
                {imgs.length > 0 ? (
                  <Image source={{ uri: imgs[0] }} style={styles.areaThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.areaThumb, { backgroundColor: colors.inputBg }]} />
                )}
                <Text style={styles.areaName} numberOfLines={1}>{area.nombre}</Text>
              </TouchableOpacity>
            );
          })}</>
        )}

        {/* My reservations */}
        <View style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          <Text style={styles.sectionLabel}>MIS RESERVAS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <TouchableOpacity style={[styles.tabBtn, reservaTab === 'proximas' && styles.tabBtnActive]} onPress={() => { setReservaTab('proximas'); setReservaPage(1); }}>
              <Text style={[styles.tabText, reservaTab === 'proximas' && styles.tabTextActive]}>
                Próximas{proximas.length ? ` (${proximas.length})` : ''}
              </Text>
            </TouchableOpacity>
            <Text style={styles.tabSep}>|</Text>
            <TouchableOpacity style={[styles.tabBtn, reservaTab === 'pasadas' && styles.tabBtnActive]} onPress={() => { setReservaTab('pasadas'); setReservaPage(1); }}>
              <Text style={[styles.tabText, reservaTab === 'pasadas' && styles.tabTextActive]}>
                Pasadas{pasadas.length ? ` (${pasadas.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2, flexWrap: 'wrap' }}>
                    <CalendarIcon size={13} color={colors.textMuted} />
                    <Text style={styles.reservaFecha}>{r.fecha}</Text>
                    <Text style={styles.reservaFecha}>·</Text>
                    <ClockIcon size={13} color={colors.textMuted} />
                    <Text style={styles.reservaFecha}>{r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}</Text>
                  </View>
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
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('date', 'fecha', 'change')} activeOpacity={0.8}>
                      <CalendarIcon size={16} color={colors.primary} />
                      <Text style={[styles.pickerBtnText, !changeForm.fecha && { color: colors.textMuted }]}>
                        {changeForm.fecha || 'Seleccioná una fecha'}
                      </Text>
                    </TouchableOpacity>
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
                          <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('time', 'horaInicio', 'change')} activeOpacity={0.8}>
                            <ClockIcon size={16} color={colors.primary} />
                            <Text style={styles.pickerBtnText}>{changeForm.horaInicio}</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Hora fin</Text>
                          <TouchableOpacity style={styles.pickerBtn} onPress={() => openPicker('time', 'horaFin', 'change')} activeOpacity={0.8}>
                            <ClockIcon size={16} color={colors.primary} />
                            <Text style={styles.pickerBtnText}>{changeForm.horaFin}</Text>
                          </TouchableOpacity>
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

        {totalPages > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, gap: 12 }}>
            <TouchableOpacity
              onPress={() => setReservaPage(p => Math.max(1, p - 1))}
              disabled={reservaPage === 1}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: reservaPage === 1 ? colors.border : colors.primary }}
            >
              <Text style={{ color: reservaPage === 1 ? colors.textMuted : '#fff', fontWeight: '600', fontSize: font.sm }}>‹ Anterior</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textMuted, fontSize: font.sm }}>{reservaPage} / {totalPages}</Text>
            <TouchableOpacity
              onPress={() => setReservaPage(p => Math.min(totalPages, p + 1))}
              disabled={reservaPage === totalPages}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: reservaPage === totalPages ? colors.border : colors.primary }}
            >
              <Text style={{ color: reservaPage === totalPages ? colors.textMuted : '#fff', fontWeight: '600', fontSize: font.sm }}>Siguiente ›</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {picker.visible && (
        <DateTimePicker
          value={picker.mode === 'date'
            ? (() => { const f = picker.form === 'main' ? form.fecha : changeForm.fecha; return f ? new Date(f + 'T12:00:00') : new Date(); })()
            : toTimeDate(picker.form === 'main' ? (picker.target === 'horaInicio' ? form.horaInicio : form.horaFin) : (picker.target === 'horaInicio' ? changeForm.horaInicio : changeForm.horaFin))
          }
          mode={picker.mode}
          display={picker.mode === 'date' ? 'calendar' : 'clock'}
          onChange={onPickerChange}
          minimumDate={picker.mode === 'date' ? new Date() : undefined}
        />
      )}

      <Modal visible={!!imgModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setImgModal(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={1} onPress={() => setImgModal(null)}>
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            bouncesZoom
            centerContent
          >
            {imgModal && (
              <Image source={{ uri: imgModal }} style={{ width: '100%', height: 340 }} resizeMode="contain" />
            )}
          </ScrollView>
          <TouchableOpacity style={{ position: 'absolute', top: 48, right: 20, padding: 8 }} onPress={() => setImgModal(null)}>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '300' }}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
    padding: spacing.sm, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  areaThumb:   { width: 72, height: 72, borderRadius: radius.md, marginRight: spacing.sm, flexShrink: 0 },
  areaName:    { fontSize: font.base, fontWeight: '700', color: colors.text, flex: 1 },
  anticipacion:{ fontSize: 12, color: colors.warningText, backgroundColor: colors.warningBg, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },

  tabBtn:        { paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:  { borderBottomColor: colors.primary },
  tabText:       { fontSize: font.base, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  tabSep:        { fontSize: font.lg, color: colors.border },

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
  pickerBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.inputBg },
  pickerBtnText: { fontSize: font.base, color: colors.text, flex: 1 },
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

  ocupadosBox:   { backgroundColor: colors.warningBg, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  ocupadosTitle: { fontSize: 12, fontWeight: '600', color: colors.warningText, marginBottom: 4 },
  ocupadoChip:   { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  conflictoMsg:  { fontSize: 12, color: colors.danger, marginTop: 4 },
  errorText:     { fontSize: 12, color: colors.danger, marginTop: spacing.sm },
});
}