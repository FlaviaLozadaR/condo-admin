import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  Alert, RefreshControl, ActivityIndicator, TextInput, Switch,
  KeyboardAvoidingView, Platform, Image, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { colors, spacing, radius, font } from '../../src/theme';
import AppDrawer from '../../src/components/Drawer';
import * as api from '../../src/api';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Rect, Path, Line } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');

const SHADOW = {
  shadowColor: '#101828', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
};

const ESTADO_STYLE = {
  pendiente: { bg: '#fef9c3', text: '#92400e' },
  aprobada:  { bg: '#d1fae5', text: '#065f46' },
  rechazada: { bg: '#fee2e2', text: '#991b1b' },
};

function InlinePicker({ value, options, onSelect, placeholder }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(48);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const selected = options.find(o => o.value === value);

  const doOpen = () => {
    setOpen(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  };
  const doClose = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => setOpen(false));
  };

  const ps = {
    picker:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderColor:colors.border, borderRadius:radius.sm, paddingHorizontal:12, paddingVertical:10, backgroundColor:colors.inputBg },
    pickerOpen:    { borderColor:colors.primary },
    pickerText:    { flex:1, fontSize:font.sm, color:colors.text },
    pickerArrow:   { fontSize:16, color:colors.textMuted, marginLeft:6 },
    drop:          { backgroundColor:colors.surface, borderWidth:1, borderColor:colors.border, borderRadius:radius.sm, zIndex:99, overflow:'hidden' },
    dropItem:      { paddingHorizontal:12, paddingVertical:10, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth:1, borderBottomColor:colors.border },
    dropItemActive:{ backgroundColor:colors.primarySoft },
    dropText:      { fontSize:font.sm, color:colors.text, flex:1 },
    dropTextActive:{ fontWeight:'700', color:colors.primary },
  };
  return (
    <View style={{ zIndex: open ? 99 : 1 }}>
      <TouchableOpacity
        style={[ps.picker, open && ps.pickerOpen]}
        onPress={() => open ? doClose() : doOpen()}
        onLayout={e => setH(e.nativeEvent.layout.height)}
        activeOpacity={0.85}
      >
        <Text style={ps.pickerText} numberOfLines={1}>{selected?.label ?? placeholder ?? 'Seleccionar'}</Text>
        <Text style={ps.pickerArrow}>{open ? '∧' : '⌄'}</Text>
      </TouchableOpacity>
      {open && (
        <Animated.View style={[ps.drop, { position: 'absolute', top: h, left: 0, right: 0, opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }]}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[ps.dropItem, value === opt.value && ps.dropItemActive]}
                onPress={() => { onSelect(opt.value); doClose(); }}
              >
                <Text style={[ps.dropText, value === opt.value && ps.dropTextActive]} numberOfLines={2}>
                  {opt.label}
                </Text>
                {value === opt.value && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function CalendarIcon({ size = 14, color = '#667085' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Rect x="1" y="2" width="14" height="13" rx="2" stroke={color} strokeWidth="1.4" />
      <Line x1="1" y1="6" x2="15" y2="6" stroke={color} strokeWidth="1.4" />
      <Line x1="5" y1="1" x2="5" y2="4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <Line x1="11" y1="1" x2="11" y2="4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <Rect x="4" y="9" width="2" height="2" rx="0.4" fill={color} />
      <Rect x="7" y="9" width="2" height="2" rx="0.4" fill={color} />
      <Rect x="10" y="9" width="2" height="2" rx="0.4" fill={color} />
    </Svg>
  );
}

function CalendarPicker({ visible, value, onSelect, onClose }) {
  const { colors } = useTheme();
  const calStyles = makeCalStyles(colors);
  const init = value ? new Date(value + 'T12:00') : new Date();
  const [cal, setCal] = useState(init);
  useEffect(() => { if (visible) setCal(value ? new Date(value + 'T12:00') : new Date()); }, [visible]);

  const year = cal.getFullYear(), month = cal.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const cells = [...Array(firstDow).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={calStyles.overlay}>
        <View style={calStyles.card}>
          <View style={calStyles.header}>
            <TouchableOpacity onPress={() => setCal(new Date(year, month - 1, 1))} style={calStyles.navBtn}>
              <Text style={calStyles.navText}>‹</Text>
            </TouchableOpacity>
            <Text style={calStyles.title}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={() => setCal(new Date(year, month + 1, 1))} style={calStyles.navBtn}>
              <Text style={calStyles.navText}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={calStyles.weekRow}>
            {['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(d => (
              <Text key={d} style={calStyles.weekDay}>{d}</Text>
            ))}
          </View>
          <View style={calStyles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={calStyles.cell} />;
              const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isSel = value === ds, isToday = todayStr === ds, isPast = ds < todayStr;
              return (
                <TouchableOpacity key={i} style={[calStyles.cell, isSel && calStyles.cellSel, isToday && !isSel && calStyles.cellToday]}
                  onPress={() => { if (!isPast) { onSelect(ds); onClose(); } }} activeOpacity={isPast ? 1 : 0.7}>
                  <Text style={[calStyles.dayTxt, isSel && {color:'#fff',fontWeight:'700'}, isToday && !isSel && {color: colors.primary, fontWeight:'700'}, isPast && {color:'#ccc'}]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={calStyles.cancelBtn} onPress={onClose}>
            <Text style={calStyles.cancelTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CalendarGrid({ value, onSelect, onClose }) {
  const { colors } = useTheme();
  const calStyles = makeCalStyles(colors);
  const init = value ? new Date(value + 'T12:00') : new Date();
  const [cal, setCal] = useState(init);

  const year = cal.getFullYear(), month = cal.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const cells = [...Array(firstDow).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];

  return (
    <View style={[calStyles.card, { marginBottom: spacing.sm, shadowOpacity: 0 }]}>
      <View style={calStyles.header}>
        <TouchableOpacity onPress={() => setCal(new Date(year, month - 1, 1))} style={calStyles.navBtn}>
          <Text style={calStyles.navText}>‹</Text>
        </TouchableOpacity>
        <Text style={calStyles.title}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={() => setCal(new Date(year, month + 1, 1))} style={calStyles.navBtn}>
          <Text style={calStyles.navText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={calStyles.weekRow}>
        {['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(d => (
          <Text key={d} style={calStyles.weekDay}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={calStyles.cell} />;
          const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isSel = value === ds, isToday = todayStr === ds, isPast = ds < todayStr;
          return (
            <TouchableOpacity key={i} style={[calStyles.cell, isSel && calStyles.cellSel, isToday && !isSel && calStyles.cellToday]}
              onPress={() => { if (!isPast) { onSelect(ds); onClose(); } }} activeOpacity={isPast ? 1 : 0.7}>
              <Text style={[calStyles.dayTxt, isSel && {color:'#fff',fontWeight:'700'}, isToday && !isSel && {color: colors.primary, fontWeight:'700'}, isPast && {color:'#ccc'}]}>{day}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={calStyles.cancelBtn} onPress={onClose}>
        <Text style={calStyles.cancelTxt}>Cerrar</Text>
      </TouchableOpacity>
    </View>
  );
}

const TIME_SLOTS = Array.from({length: 48}, (_, i) => {
  const h = Math.floor(i / 2), m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2,'0')}:${m}`;
});

function TimePicker({ visible, value, onSelect, onClose, label }) {
  const { colors } = useTheme();
  const calStyles = makeCalStyles(colors);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[calStyles.overlay, {justifyContent:'flex-end'}]}>
        <View style={{backgroundColor: colors.surface, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'70%', paddingBottom: Math.max(24, insets.bottom + 16)}}>
          <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:spacing.lg, borderBottomWidth:1, borderBottomColor:colors.border}}>
            <Text style={{fontSize:font.base, fontWeight:'700', color:colors.text}}>{label}</Text>
            <TouchableOpacity onPress={onClose}><Text style={{fontSize:20, color:colors.textMuted}}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {TIME_SLOTS.map(t => {
              const sel = t === value;
              return (
                <TouchableOpacity key={t} style={[{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.lg,paddingVertical:14,borderBottomWidth:1,borderBottomColor:colors.border}, sel && {backgroundColor:colors.primarySoft}]}
                  onPress={() => { onSelect(t); onClose(); }}>
                  <Text style={{fontSize:font.base, fontWeight: sel ? '700' : '400', color: sel ? colors.primary : colors.text}}>{t}</Text>
                  {sel && <Text style={{color:colors.primary,fontWeight:'700',fontSize:16}}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeCalStyles(colors) {
  return {
    overlay:   {flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding:spacing.lg},
    card:      {backgroundColor:colors.surface, borderRadius:radius.lg, overflow:'hidden', ...SHADOW},
    header:    {flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:spacing.md, backgroundColor:colors.disabledBg},
    navBtn:    {padding:8},
    navText:   {fontSize:24, color:colors.primary, fontWeight:'700'},
    title:     {fontSize:font.base, fontWeight:'700', color:colors.text},
    weekRow:   {flexDirection:'row', backgroundColor:colors.disabledBg, paddingBottom:6},
    weekDay:   {flex:1, textAlign:'center', fontSize:11, fontWeight:'700', color:colors.textMuted},
    grid:      {flexDirection:'row', flexWrap:'wrap', padding:4},
    cell:      {width:'14.28%', aspectRatio:1, alignItems:'center', justifyContent:'center'},
    cellSel:   {backgroundColor:colors.primary, borderRadius:100},
    cellToday: {borderWidth:1.5, borderColor:colors.primary, borderRadius:100},
    dayTxt:    {fontSize:14, color:colors.text},
    cancelBtn: {margin:spacing.md, padding:12, alignItems:'center', borderRadius:radius.md, borderWidth:1, borderColor:colors.border},
    cancelTxt: {fontSize:font.sm, fontWeight:'600', color:colors.text2},
  };
}

export default function ReservasScreen() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [areas,      setAreas]      = useState([]);
  const [reservas,   setReservas]   = useState([]);
  const [residents,  setResidents]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [mainTab,    setMainTab]    = useState('reservas');
  const [reservaTab, setReservaTab] = useState('proximas');
  const [reservaPage, setReservaPage] = useState(1);
  const PAGE_SIZE = 10;

  // Area detail view
  const [detailArea,      setDetailArea]      = useState(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex,   setLightboxIndex]   = useState(0);

  // Edit area modal
  const [editModal,   setEditModal]   = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [editForm,    setEditForm]    = useState({ nombre: '', descripcion: '', activo: true });
  const [editImages,  setEditImages]  = useState([]);   // existing URLs to keep
  const [newImages,   setNewImages]   = useState([]);   // newly picked { uri, type, name }
  const [editLoading, setEditLoading] = useState(false);

  // Reservation detail modal
  const [selectedReserva, setSelectedReserva] = useState(null);
  const [deletingReserva, setDeletingReserva] = useState(false);

  // Manual reservation modal
  const [manualModal,        setManualModal]        = useState(false);
  const manualSlideAnim = useRef(new Animated.Value(700)).current;
  const [manualForm,         setManualForm]         = useState({ areaId: '', residenteId: '', fecha: '', diaCompleto: false, horaInicio: '08:00', horaFin: '10:00', nota: '' });
  const [manualLoading,      setManualLoading]      = useState(false);
  const [manualError,        setManualError]        = useState('');
  const [residentPickerOpen, setResidentPickerOpen] = useState(false);
  const [residentSearch,     setResidentSearch]     = useState('');
  const [showDatePicker,     setShowDatePicker]     = useState(false);
  const [showStartPicker,    setShowStartPicker]    = useState(false);
  const [showEndPicker,      setShowEndPicker]      = useState(false);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [areasRes, reservasRes] = await Promise.all([
        api.getAreasSociales(),
        api.getReservasAreas(),
      ]);
      setAreas(Array.isArray(areasRes) ? areasRes : []);
      setReservas(Array.isArray(reservasRes) ? reservasRes : []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [residentsError, setResidentsError] = useState('');

  const loadResidents = useCallback(() => {
    if (!isAdmin && !isSuperAdmin) return;
    setResidentsError('');
    api.getUsuarios()
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.users ?? []);
        // El backend ya filtra por condo para Administrador; solo filtramos por rol
        const filtered = list.filter(u => ['Propietario', 'Inquilino'].includes(u.role));
        setResidents(filtered);
      })
      .catch(e => setResidentsError(e.message || 'Error al cargar residentes'));
  }, [isAdmin, isSuperAdmin]);

  useEffect(() => { loadResidents(); }, [loadResidents]);

  // Keep detailArea in sync when areas reload
  useEffect(() => {
    if (detailArea) {
      const fresh = areas.find(a => a.id === detailArea.id);
      if (fresh) setDetailArea(fresh);
    }
  }, [areas]);

  // Refresh areas silently when opening detail view (gets fresh signed URLs)
  useEffect(() => {
    if (detailArea) loadData(false);
  }, [detailArea?.id]);

  const onRefresh = () => { setRefreshing(true); loadData(false); };

  useEffect(() => { setReservaPage(1); }, [reservaTab]);

  useEffect(() => {
    if (manualModal) {
      manualSlideAnim.setValue(700);
      Animated.spring(manualSlideAnim, { toValue: 0, damping: 24, stiffness: 170, useNativeDriver: true }).start();
    }
  }, [manualModal]);

  const closeManualModal = () => {
    Animated.timing(manualSlideAnim, { toValue: 700, duration: 210, useNativeDriver: true })
      .start(() => setManualModal(false));
  };

  const condoName = isAdmin ? user?.condo : undefined;

  const handleAprobar = async (id, estado) => {
    try {
      const updated = await api.aprobarReservaArea(id, estado);
      setReservas(prev => prev.map(r => r.id === id ? updated : r));
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const openEditArea = (area) => {
    setEditingArea(area);
    setEditForm({ nombre: area.nombre, descripcion: area.descripcion || '', activo: area.activo !== false });
    const imgs = Array.isArray(area.imagenUrl)
      ? area.imagenUrl
      : (area.imagenUrl ? [area.imagenUrl] : []);
    setEditImages(imgs);
    setNewImages([]);
    setEditModal(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const picked = result.assets.map(a => ({
        uri:  a.uri,
        type: a.mimeType || 'image/jpeg',
        name: a.fileName  || `foto_${Date.now()}.jpg`,
      }));
      setNewImages(prev => [...prev, ...picked]);
    }
  };

  const handleEditArea = async () => {
    if (!editForm.nombre.trim()) { Alert.alert('El nombre es requerido'); return; }
    setEditLoading(true);
    try {
      const fd = new FormData();
      fd.append('nombre',      editForm.nombre.trim());
      fd.append('descripcion', editForm.descripcion);
      fd.append('activo',      String(editForm.activo));
      fd.append('imagenesActuales', JSON.stringify(editImages));
      newImages.forEach(img => {
        fd.append('imagenes', { uri: img.uri, type: img.type, name: img.name });
      });
      const updated = await api.updateAreaSocial(editingArea.id, fd);
      setAreas(prev => prev.map(a => a.id === editingArea.id ? updated : a));
      setEditModal(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteArea = (id) => {
    Alert.alert('Eliminar área', '¿Eliminar esta área? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAreaSocial(id);
            setAreas(prev => prev.filter(a => a.id !== id));
            setDetailArea(null);
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleManualCreate = async () => {
    const { areaId, residenteId, fecha, diaCompleto, horaInicio, horaFin, nota } = manualForm;
    if (!areaId || !fecha || !residenteId) { setManualError('Completá área, residente y fecha.'); return; }
    if (!diaCompleto && horaInicio >= horaFin) { setManualError('La hora fin debe ser mayor.'); return; }
    const residente = residents.find(r => String(r.id) === String(residenteId));
    const area      = areas.find(a => String(a.id) === String(areaId));
    setManualLoading(true); setManualError('');
    try {
      const nueva = await api.createReservaArea({
        areaId, areaNombre: area?.nombre || '', fecha,
        horaInicio: diaCompleto ? '00:00' : horaInicio,
        horaFin:    diaCompleto ? '23:59' : horaFin,
        diaCompleto, nota,
        manualPropietario: residente?.name     || '',
        manualPropiedad:   residente?.property || '',
      });
      setReservas(prev => [nueva, ...prev]);
      Animated.timing(manualSlideAnim, { toValue: 700, duration: 210, useNativeDriver: true })
        .start(() => {
          setManualModal(false);
          setManualForm({ areaId: '', residenteId: '', fecha: '', diaCompleto: false, horaInicio: '08:00', horaFin: '10:00', nota: '' });
        });
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualLoading(false);
    }
  };

  const now = new Date();
  const esPasada = r => new Date(`${r.fecha}T${r.horaFin || '23:59'}`) < now;
  const filteredReservas = condoName ? reservas.filter(r => r.condo === condoName) : reservas;
  const proximas = filteredReservas.filter(r => !esPasada(r));
  const pasadas  = filteredReservas.filter(r => esPasada(r));
  const cambios  = filteredReservas.filter(r => r.solicitudCambio);
  const visibleReservas = reservaTab === 'pasadas' ? pasadas : proximas;
  const pagedReservas   = visibleReservas.slice(0, reservaPage * PAGE_SIZE);
  const hasMoreReservas = visibleReservas.length > pagedReservas.length;

  const areaMap     = Object.fromEntries(areas.map(a => [String(a.id), a]));
  const areaOptions     = areas.map(a => ({ value: String(a.id), label: a.nombre }));
  const residentOptions = residents.map(r => ({ value: String(r.id), label: `${r.name}${r.property ? ` · ${r.property}` : ''} (${r.role})` }));

  // ── AREA DETAIL VIEW ──────────────────────────────────────────────
  if (detailArea) {
    const imgs = Array.isArray(detailArea.imagenUrl)
      ? detailArea.imagenUrl
      : (detailArea.imagenUrl ? [detailArea.imagenUrl] : []);
    const areaReservas = reservas.filter(r => r.areaId === detailArea.id);
    const proximasArea = areaReservas.filter(r => !esPasada(r));
    const pasadasArea  = areaReservas.filter(r => esPasada(r));

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setDetailArea(null)} style={styles.hamburger}>
            <Text style={[styles.hamburgerLines, { fontSize: 15, color: colors.primary }]}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>{detailArea.nombre}</Text>
          <View style={styles.rolePill}>
            <View style={[styles.roleOrangeDot, { backgroundColor: detailArea.activo !== false ? '#22c55e' : '#9ca3af' }]} />
            <Text style={styles.rolePillText}>{detailArea.activo !== false ? 'Activa' : 'Inactiva'}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Photo gallery — full-bleed */}
          {imgs.length > 0 ? (
            <View style={styles.galleryWrap}>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                {imgs.map((url, i) => (
                  <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => { setLightboxIndex(i); setLightboxVisible(true); }}>
                    <Image source={{ uri: url }} style={[styles.galleryImg, { width: SW }]} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {imgs.length > 1 && (
                <View style={styles.dotsRow}>
                  {imgs.map((_, i) => <View key={i} style={styles.dot} />)}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.galleryPlaceholder}>
              <Text style={{ fontSize: 36 }}>🏛</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>Sin fotos</Text>
            </View>
          )}

          {/* Info */}
          <Text style={styles.detailName}>{detailArea.nombre}</Text>
          {detailArea.descripcion ? (
            <Text style={styles.detailDesc}>{detailArea.descripcion}</Text>
          ) : null}

          {/* Actions */}
          <View style={[styles.rowBtns, { marginTop: spacing.md, marginBottom: spacing.lg }]}>
            <TouchableOpacity style={styles.btnSec} onPress={() => openEditArea(detailArea)}>
              <Text style={styles.btnSecText}>Editar área</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSec, { borderColor: colors.danger }]} onPress={() => handleDeleteArea(detailArea.id)}>
              <Text style={[styles.btnSecText, { color: colors.danger }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>

          {/* Reservations for this area */}
          <Text style={styles.sectionLabel}>PRÓXIMAS RESERVAS ({proximasArea.length})</Text>
          {proximasArea.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.md }]}>
              <Text style={{ color: colors.textMuted, fontSize: font.sm }}>Sin reservas próximas.</Text>
            </View>
          ) : proximasArea.map(r => {
            const s = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.pendiente;
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.reservaTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reservaProp}>{r.propietario}</Text>
                    {r.propiedad ? <Text style={styles.reservaPropiedad}>{r.propiedad}</Text> : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <CalendarIcon />
                      <Text style={styles.reservaFecha}>{r.fecha}  ·  {r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}</Text>
                    </View>
                    {r.nota ? <Text style={styles.reservaNota}>"{r.nota}"</Text> : null}
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: s.bg }]}>
                    <Text style={[styles.estadoBadgeText, { color: s.text }]}>{r.estado}</Text>
                  </View>
                </View>
                {r.estado === 'pendiente' && (
                  <View style={styles.reviewBtns}>
                    <TouchableOpacity style={[styles.actionBtn, { flex: 1, borderColor: colors.danger, justifyContent: 'center' }]} onPress={() => handleAprobar(r.id, 'rechazada')}>
                      <Text style={[styles.actionBtnText, { color: colors.danger }]}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { flex: 1, borderColor: '#16a34a', justifyContent: 'center' }]} onPress={() => handleAprobar(r.id, 'aprobada')}>
                      <Text style={[styles.actionBtnText, { color: '#16a34a' }]}>Aprobar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {pasadasArea.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>HISTORIAL ({pasadasArea.length})</Text>
              {pasadasArea.map(r => {
                const s = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.pendiente;
                return (
                  <View key={r.id} style={[styles.card, { opacity: 0.75 }]}>
                    <View style={styles.reservaTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reservaProp}>{r.propietario}</Text>
                        {r.propiedad ? <Text style={styles.reservaPropiedad}>{r.propiedad}</Text> : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <CalendarIcon />
                          <Text style={styles.reservaFecha}>{r.fecha}  ·  {r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}</Text>
                        </View>
                      </View>
                      <View style={[styles.estadoBadge, { backgroundColor: s.bg }]}>
                        <Text style={[styles.estadoBadgeText, { color: s.text }]}>{r.estado}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* Edit area modal */}
        <Modal visible={editModal} animationType="none" transparent onRequestClose={() => setEditModal(false)}>
          <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Editar Área</Text>

                <Text style={styles.label}>Nombre *</Text>
                <TextInput style={styles.input} value={editForm.nombre} onChangeText={t => setEditForm(f => ({ ...f, nombre: t }))} placeholder="Nombre del área" placeholderTextColor={colors.textMuted} />

                <Text style={styles.label}>Descripción</Text>
                <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]} value={editForm.descripcion} onChangeText={t => setEditForm(f => ({ ...f, descripcion: t }))} placeholder="Descripción" placeholderTextColor={colors.textMuted} multiline />

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Área activa</Text>
                  <Switch value={editForm.activo} onValueChange={v => setEditForm(f => ({ ...f, activo: v }))} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
                </View>

                {/* Images */}
                <Text style={[styles.label, { marginTop: spacing.sm }]}>Fotos</Text>
                <View style={styles.imgGrid}>
                  {/* Existing images */}
                  {editImages.map((url, i) => (
                    <View key={`e-${i}`} style={styles.imgThumbWrap}>
                      <Image source={{ uri: url }} style={styles.imgThumb} resizeMode="cover" />
                      <TouchableOpacity style={styles.imgRemoveBtn} onPress={() => setEditImages(prev => prev.filter((_, j) => j !== i))}>
                        <Text style={styles.imgRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {/* New images */}
                  {newImages.map((img, i) => (
                    <View key={`n-${i}`} style={styles.imgThumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.imgThumb} resizeMode="cover" />
                      <TouchableOpacity style={styles.imgRemoveBtn} onPress={() => setNewImages(prev => prev.filter((_, j) => j !== i))}>
                        <Text style={styles.imgRemoveText}>✕</Text>
                      </TouchableOpacity>
                      <View style={styles.imgNewBadge}><Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>NUEVA</Text></View>
                    </View>
                  ))}
                  {/* Add button */}
                  <TouchableOpacity style={styles.imgAddBtn} onPress={pickImage}>
                    <Text style={styles.imgAddIcon}>+</Text>
                    <Text style={styles.imgAddText}>Agregar</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.rowBtns, { marginTop: spacing.md }]}>
                  <TouchableOpacity style={styles.btnSec} onPress={() => setEditModal(false)}>
                    <Text style={styles.btnSecText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnPri, editLoading && { opacity: 0.6 }]} onPress={handleEditArea} disabled={editLoading}>
                    <Text style={styles.btnPriText}>{editLoading ? 'Guardando…' : 'Guardar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Lightbox */}
        <Modal visible={lightboxVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setLightboxVisible(false)}>
          <View style={styles.lightboxBg}>
            <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxVisible(false)}>
              <Text style={styles.lightboxCloseText}>✕</Text>
            </TouchableOpacity>
            {imgs.length > 1 && (
              <Text style={styles.lightboxCounter}>{lightboxIndex + 1} / {imgs.length}</Text>
            )}
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: lightboxIndex * SW, y: 0 }}
              onMomentumScrollEnd={e => setLightboxIndex(Math.round(e.nativeEvent.contentOffset.x / SW))}
              style={{ flex: 1 }}
            >
              {imgs.map((url, i) => (
                <View key={i} style={{ width: SW, flex: 1, justifyContent: 'center' }}>
                  <Image source={{ uri: url }} style={{ width: SW, height: '100%' }} resizeMode="contain" />
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>

        <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </SafeAreaView>
    );
  }

  // ── MAIN LIST VIEW ────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
          <Text style={styles.hamburgerLines}>≡</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Reservas</Text>
        <TouchableOpacity style={styles.manualBtn} onPress={() => { setManualModal(true); setManualError(''); }} activeOpacity={0.85}>
          <Text style={styles.manualBtnText}>+ Manual</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.pageTitle}>Gestión de Reservas</Text>
        <Text style={styles.pageSub}>Administrá áreas sociales y reservas del condominio</Text>

        {/* ── 3 tabs ── */}
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, mainTab === 'areas' && styles.tabActive]} onPress={() => setMainTab('areas')}>
            <Text style={[styles.tabText, mainTab === 'areas' && styles.tabTextActive]}>Áreas Sociales</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, mainTab === 'reservas' && styles.tabActive]} onPress={() => setMainTab('reservas')}>
            <Text style={[styles.tabText, mainTab === 'reservas' && styles.tabTextActive]}>Reservas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, mainTab === 'cambios' && styles.tabActive]} onPress={() => setMainTab('cambios')}>
            <Text style={[styles.tabText, mainTab === 'cambios' && styles.tabTextActive]}>Cambios{cambios.length > 0 ? ` (${cambios.length})` : ''}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />

        ) : mainTab === 'areas' ? (
          /* ── ÁREAS SOCIALES ── */
          areas.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.xl }]}>
              <Text style={{ color: colors.textMuted }}>No hay áreas sociales configuradas.</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Creá las áreas desde la versión web.</Text>
            </View>
          ) : areas.map(area => {
            const imgs = Array.isArray(area.imagenUrl) ? area.imagenUrl : (area.imagenUrl ? [area.imagenUrl] : []);
            const activas = reservas.filter(r => r.areaId === area.id && !esPasada(r)).length;
            return (
              <TouchableOpacity key={area.id} style={styles.areaCardNew} onPress={() => setDetailArea(area)} activeOpacity={0.88}>
                <View style={styles.areaCardImgWrap}>
                  {imgs.length > 0 ? (
                    <Image source={{ uri: imgs[0] }} style={styles.areaCardImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.areaCardImg, { backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 32 }}>🏛</Text>
                    </View>
                  )}
                  {imgs.length > 1 && (
                    <View style={styles.fotosBadge}>
                      <Text style={styles.fotosBadgeText}>{imgs.length} fotos</Text>
                    </View>
                  )}
                  <View style={[styles.activoBadgeImg, { backgroundColor: area.activo !== false ? '#d1fae5' : '#f3f4f6' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: area.activo !== false ? '#065f46' : colors.textMuted }}>
                      {area.activo !== false ? 'Activa' : 'Inactiva'}
                    </Text>
                  </View>
                </View>
                <View style={styles.areaCardBody}>
                  <Text style={styles.areaCardName}>{area.nombre}</Text>
                  {area.descripcion ? <Text style={styles.areaCardDesc} numberOfLines={2}>{area.descripcion}</Text> : null}
                  {area.precio > 0 && <Text style={styles.areaCardPrice}>Bs. {area.precio} por reserva</Text>}
                  <Text style={styles.areaCardCount}>{activas} reserva{activas !== 1 ? 's' : ''} activa{activas !== 1 ? 's' : ''}</Text>
                </View>
              </TouchableOpacity>
            );
          })

        ) : mainTab === 'reservas' ? (
          /* ── RESERVAS ── */
          <>
            <View style={styles.subTabs}>
              <TouchableOpacity style={[styles.subTab, reservaTab === 'proximas' && styles.subTabActive]} onPress={() => setReservaTab('proximas')}>
                <Text style={[styles.subTabText, reservaTab === 'proximas' && styles.subTabTextActive]}>Próximas ({proximas.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subTab, reservaTab === 'pasadas' && styles.subTabActive]} onPress={() => setReservaTab('pasadas')}>
                <Text style={[styles.subTabText, reservaTab === 'pasadas' && styles.subTabTextActive]}>Pasadas ({pasadas.length})</Text>
              </TouchableOpacity>
            </View>

            {visibleReservas.length === 0 ? (
              <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.xl }]}>
                <Text style={{ color: colors.textMuted, fontWeight: '600', marginBottom: 4 }}>
                  {reservaTab === 'proximas' ? 'Sin reservas próximas' : 'Sin reservas pasadas'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {reservaTab === 'proximas' ? 'Aún no hay solicitudes de reserva próximas.' : 'No hay reservas anteriores.'}
                </Text>
              </View>
            ) : (
              <>
                {pagedReservas.map(r => {
                  const s = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.pendiente;
                  const areaImgs = (() => { const a = areaMap[String(r.areaId)]; if (!a) return []; return Array.isArray(a.imagenUrl) ? a.imagenUrl : (a.imagenUrl ? [a.imagenUrl] : []); })();
                  return (
                    <TouchableOpacity key={r.id} style={styles.reservaCardNew} onPress={() => setSelectedReserva(r)} activeOpacity={0.88}>
                      {areaImgs.length > 0 && (
                        <Image source={{ uri: areaImgs[0] }} style={styles.reservaCardImg} resizeMode="cover" />
                      )}
                      <View style={styles.reservaCardContent}>
                        <View style={styles.reservaTop}>
                          <Text style={styles.reservaArea}>{r.areaNombre}</Text>
                          <View style={[styles.estadoBadge, { backgroundColor: s.bg }]}>
                            <Text style={[styles.estadoBadgeText, { color: s.text }]}>{r.estado}</Text>
                          </View>
                        </View>
                        <Text style={styles.reservaProp}>{r.propietario}{r.propiedad ? ` · ${r.propiedad}` : ''}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <CalendarIcon />
                          <Text style={styles.reservaFecha}>{r.fecha}  ·  {r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}</Text>
                        </View>
                        {isSuperAdmin && r.condo && <Text style={{ fontSize: 11, color: colors.primary, marginTop: 2 }}>{r.condo}</Text>}
                        {r.nota ? <Text style={styles.reservaNota}>"{r.nota}"</Text> : null}

                        {r.estado === 'pendiente' && reservaTab === 'proximas' && (
                          <View style={styles.reviewBtns}>
                            <TouchableOpacity style={styles.btnRechazar} onPress={e => { e.stopPropagation?.(); handleAprobar(r.id, 'rechazada'); }}>
                              <Text style={styles.btnRechazarText}>✕  Rechazar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnAprobar} onPress={e => { e.stopPropagation?.(); handleAprobar(r.id, 'aprobada'); }}>
                              <Text style={styles.btnAprobarText}>✓  Aprobar</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {hasMoreReservas && (
                  <TouchableOpacity style={styles.verMasBtn} onPress={() => setReservaPage(p => p + 1)} activeOpacity={0.8}>
                    <Text style={styles.verMasBtnText}>Ver más ({visibleReservas.length - pagedReservas.length} restantes)</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </>

        ) : (
          /* ── CAMBIOS ── */
          cambios.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.xl }]}>
              <Text style={{ color: colors.textMuted, fontWeight: '600', marginBottom: 4 }}>Sin solicitudes de cambio</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>No hay cambios de horario pendientes.</Text>
            </View>
          ) : cambios.map(r => {
            const s = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.pendiente;
            const areaImgs = (() => { const a = areaMap[String(r.areaId)]; if (!a) return []; return Array.isArray(a.imagenUrl) ? a.imagenUrl : (a.imagenUrl ? [a.imagenUrl] : []); })();
            return (
              <View key={r.id} style={styles.reservaCardNew}>
                {areaImgs.length > 0 && (
                  <Image source={{ uri: areaImgs[0] }} style={styles.reservaCardImg} resizeMode="cover" />
                )}
                <View style={styles.reservaCardContent}>
                  <View style={styles.reservaTop}>
                    <Text style={styles.reservaArea}>{r.areaNombre}</Text>
                    <View style={[styles.estadoBadge, { backgroundColor: s.bg }]}>
                      <Text style={[styles.estadoBadgeText, { color: s.text }]}>{r.estado}</Text>
                    </View>
                  </View>
                  <Text style={styles.reservaProp}>{r.propietario}{r.propiedad ? ` · ${r.propiedad}` : ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <CalendarIcon />
                    <Text style={styles.reservaFecha}>{r.fecha}  ·  {r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}</Text>
                  </View>
                  <View style={styles.cambioBox}>
                    <Text style={styles.cambioTitle}>Solicitud de cambio · {r.solicitudCambio.estado}</Text>
                    <Text style={styles.cambioDetail}>Actual: {r.fecha}  {r.diaCompleto ? 'Todo el día' : `${r.horaInicio}–${r.horaFin}`}</Text>
                    <Text style={styles.cambioDetail}>Nueva: {r.solicitudCambio.fecha}  {r.solicitudCambio.diaCompleto ? 'Todo el día' : `${r.solicitudCambio.horaInicio}–${r.solicitudCambio.horaFin}`}</Text>
                    {r.solicitudCambio.nota ? <Text style={styles.cambioNota}>"{r.solicitudCambio.nota}"</Text> : null}
                    {r.solicitudCambio.estado === 'pendiente' && (
                      <View style={styles.reviewBtns}>
                        <TouchableOpacity style={styles.btnRechazar} onPress={async () => { try { const u = await api.responderCambioReserva(r.id, false); setReservas(p => p.map(x => x.id === r.id ? u : x)); } catch (e) { Alert.alert('Error', e.message); } }}>
                          <Text style={styles.btnRechazarText}>✕  Rechazar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnAprobar} onPress={async () => { try { const u = await api.responderCambioReserva(r.id, true); setReservas(p => p.map(x => x.id === r.id ? u : x)); } catch (e) { Alert.alert('Error', e.message); } }}>
                          <Text style={styles.btnAprobarText}>✓  Aprobar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Reservation Detail Modal ── */}
      {selectedReserva && (() => {
        const r = selectedReserva;
        const s = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.pendiente;
        const a = areaMap[String(r.areaId)];
        const areaImgs = a ? (Array.isArray(a.imagenUrl) ? a.imagenUrl : (a.imagenUrl ? [a.imagenUrl] : [])) : [];
        return (
          <Modal visible animationType="none" transparent onRequestClose={() => setSelectedReserva(null)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: insets.bottom }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {areaImgs.length > 0 && (
                    <Image source={{ uri: areaImgs[0] }} style={{ width: '100%', height: 200, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} resizeMode="cover" />
                  )}
                  <View style={{ padding: spacing.lg }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
                      <Text style={{ fontSize: font.lg, fontWeight: '800', color: colors.text, flex: 1, marginRight: spacing.sm }}>{r.areaNombre}</Text>
                      <View style={[styles.estadoBadge, { backgroundColor: s.bg }]}>
                        <Text style={[styles.estadoBadgeText, { color: s.text }]}>{r.estado}</Text>
                      </View>
                    </View>

                    {/* Info rows */}
                    <View style={{ gap: spacing.sm }}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Residente</Text>
                        <Text style={styles.detailVal}>{r.propietario || '—'}</Text>
                      </View>
                      {r.propiedad ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Propiedad</Text>
                          <Text style={styles.detailVal}>{r.propiedad}</Text>
                        </View>
                      ) : null}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Fecha</Text>
                        <Text style={styles.detailVal}>{r.fecha}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Horario</Text>
                        <Text style={styles.detailVal}>{r.diaCompleto ? 'Todo el día' : `${r.horaInicio} – ${r.horaFin}`}</Text>
                      </View>
                      {isSuperAdmin && r.condo ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Condominio</Text>
                          <Text style={styles.detailVal}>{r.condo}</Text>
                        </View>
                      ) : null}
                      {r.nota ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Nota</Text>
                          <Text style={styles.detailVal}>"{r.nota}"</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Approve/Reject for pending */}
                    {r.estado === 'pendiente' && (
                      <View style={[styles.reviewBtns, { marginTop: spacing.md }]}>
                        <TouchableOpacity style={styles.btnRechazar} onPress={() => { handleAprobar(r.id, 'rechazada'); setSelectedReserva(null); }}>
                          <Text style={styles.btnRechazarText}>✕  Rechazar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnAprobar} onPress={() => { handleAprobar(r.id, 'aprobada'); setSelectedReserva(null); }}>
                          <Text style={styles.btnAprobarText}>✓  Aprobar</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Delete */}
                    {(isAdmin || isSuperAdmin) && (
                      <TouchableOpacity
                        style={[styles.btnRechazar, { marginTop: spacing.md, opacity: deletingReserva ? 0.5 : 1 }]}
                        disabled={deletingReserva}
                        onPress={() => Alert.alert('Eliminar reserva', '¿Eliminar esta reserva? Esta acción no se puede deshacer.', [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Eliminar', style: 'destructive', onPress: async () => {
                            setDeletingReserva(true);
                            try {
                              await api.deleteReservaArea(r.id);
                              setReservas(p => p.filter(x => x.id !== r.id));
                              setSelectedReserva(null);
                            } catch (e) { Alert.alert('Error', e.message); }
                            finally { setDeletingReserva(false); }
                          }},
                        ])}
                      >
                        {deletingReserva ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnRechazarText}>Eliminar reserva</Text>}
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity style={[styles.verMasBtn, { marginTop: spacing.sm }]} onPress={() => setSelectedReserva(null)}>
                      <Text style={styles.verMasBtnText}>Cerrar</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* Manual reservation modal */}
      <Modal visible={manualModal} animationType="none" transparent statusBarTranslucent onRequestClose={closeManualModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={closeManualModal} />
          <Animated.View style={[styles.modalCard, { borderRadius: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 0, transform: [{ translateY: manualSlideAnim }] }]}>
            {/* Header */}
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
              <Text style={styles.modalTitle}>Reserva Manual</Text>
              <Text style={styles.modalSub}>Registrá una reserva en nombre de un residente.</Text>
            </View>

            {/* Scrollable form fields */}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }} style={{ maxHeight: SH * 0.62 }}>
              <Text style={styles.label}>Área *</Text>
              <View style={{ marginBottom: spacing.sm }}>
                <InlinePicker value={manualForm.areaId} options={areaOptions} onSelect={v => setManualForm(f => ({ ...f, areaId: v }))} placeholder="Seleccioná un área" />
              </View>

              <Text style={styles.label}>Residente *</Text>
              {(() => {
                const sel = residents.find(x => String(x.id) === String(manualForm.residenteId));
                const q = residentSearch.toLowerCase().trim();
                const filteredRes = q
                  ? residents.filter(r => r.name?.toLowerCase().includes(q) || r.property?.toLowerCase().includes(q) || r.role?.toLowerCase().includes(q))
                  : residents;
                return (
                  <View style={{ marginBottom: spacing.sm, zIndex: residentPickerOpen ? 200 : 1 }}>
                    <TouchableOpacity
                      style={[styles.picker, residentPickerOpen && styles.pickerOpen]}
                      onPress={() => { setResidentSearch(''); setResidentPickerOpen(o => !o); }}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.pickerText, !sel && { color: colors.textMuted }]} numberOfLines={1}>
                        {sel ? `${sel.name}${sel.property ? ` · ${sel.property}` : ''}` : 'Buscar residente…'}
                      </Text>
                      <Text style={styles.pickerArrow}>{residentPickerOpen ? '∧' : '⌄'}</Text>
                    </TouchableOpacity>
                    {residentPickerOpen && (
                      <View style={{ position: 'absolute', top: 46, left: 0, right: 0, zIndex: 200, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 }}>
                        <TextInput
                          style={{ paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border, fontSize: font.sm, color: colors.text }}
                          value={residentSearch}
                          onChangeText={setResidentSearch}
                          placeholder="Buscar por nombre, unidad o rol…"
                          placeholderTextColor={colors.textMuted}
                        />
                        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 200 }}>
                          {filteredRes.length === 0
                            ? (
                              <View style={{ padding: spacing.md }}>
                                <Text style={{ color: residentsError ? colors.danger : colors.textMuted, fontSize: font.sm, marginBottom: 8 }}>
                                  {residentsError || (residents.length === 0 ? 'No se encontraron residentes.' : 'Sin resultados')}
                                </Text>
                                {(residentsError || residents.length === 0) && (
                                  <TouchableOpacity onPress={loadResidents} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.primary, borderRadius: radius.sm, alignSelf: 'flex-start' }}>
                                    <Text style={{ color: '#fff', fontSize: font.sm, fontWeight: '600' }}>Reintentar</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            )
                            : filteredRes.map(r => {
                                const selected = String(r.id) === String(manualForm.residenteId);
                                return (
                                  <TouchableOpacity key={r.id}
                                    style={{ paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', backgroundColor: selected ? colors.primarySoft : 'transparent' }}
                                    onPress={() => { setManualForm(f => ({ ...f, residenteId: String(r.id) })); setResidentPickerOpen(false); }}
                                  >
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ fontSize: font.sm, fontWeight: selected ? '700' : '500', color: selected ? colors.primary : colors.text }}>{r.name}</Text>
                                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{r.role}{r.property ? `  ·  ${r.property}` : ''}</Text>
                                    </View>
                                    {selected && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
                                  </TouchableOpacity>
                                );
                              })
                          }
                        </ScrollView>
                      </View>
                    )}
                  </View>
                );
              })()}

              <Text style={styles.label}>Fecha *</Text>
              <TouchableOpacity style={[styles.input, styles.pickerBtn]} onPress={() => setShowDatePicker(o => !o)}>
                <Text style={[styles.pickerBtnText, !manualForm.fecha && { color: colors.textMuted }]}>
                  {manualForm.fecha ? manualForm.fecha.split('-').reverse().join('/') : 'Seleccioná una fecha'}
                </Text>
                <CalendarIcon size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.label}>Todo el día</Text>
                <Switch value={manualForm.diaCompleto} onValueChange={v => setManualForm(f => ({ ...f, diaCompleto: v }))} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
              </View>

              {!manualForm.diaCompleto && (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Hora inicio</Text>
                    <TouchableOpacity style={[styles.input, styles.pickerBtn]} onPress={() => setShowStartPicker(true)}>
                      <Text style={styles.pickerBtnText}>{manualForm.horaInicio || '08:00'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Hora fin</Text>
                    <TouchableOpacity style={[styles.input, styles.pickerBtn]} onPress={() => setShowEndPicker(true)}>
                      <Text style={styles.pickerBtnText}>{manualForm.horaFin || '10:00'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={styles.label}>Nota (opcional)</Text>
              <TextInput style={styles.input} value={manualForm.nota} onChangeText={t => setManualForm(f => ({ ...f, nota: t }))} placeholder="Motivo o comentario" placeholderTextColor={colors.textMuted} />
            </ScrollView>

            {/* Fixed footer — always visible */}
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg + insets.bottom }}>
              {manualError ? <Text style={[styles.errorText, { marginBottom: spacing.sm }]}>{manualError}</Text> : null}
              <View style={styles.rowBtns}>
                <TouchableOpacity style={styles.btnSec} onPress={closeManualModal}>
                  <Text style={styles.btnSecText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnPri, manualLoading && { opacity: 0.6 }]} onPress={handleManualCreate} disabled={manualLoading}>
                  <Text style={styles.btnPriText}>{manualLoading ? 'Guardando…' : 'Confirmar Reserva'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

        </KeyboardAvoidingView>
      </Modal>

      {/* Date picker — Modal propio para garantizar z-order en Android */}
      <Modal visible={showDatePicker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowDatePicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg }}>
          <CalendarGrid
            value={manualForm.fecha}
            onSelect={ds => setManualForm(f => ({ ...f, fecha: ds }))}
            onClose={() => setShowDatePicker(false)}
          />
        </View>
      </Modal>

      {/* Time picker — Modal propio para garantizar z-order en Android */}
      {(() => {
        const isStart = showStartPicker;
        const currentVal = isStart ? manualForm.horaInicio : manualForm.horaFin;
        const onTimeSelect = t => {
          setManualForm(f => ({ ...f, [isStart ? 'horaInicio' : 'horaFin']: t }));
          setShowStartPicker(false);
          setShowEndPicker(false);
        };
        return (
          <Modal visible={showStartPicker || showEndPicker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { setShowStartPicker(false); setShowEndPicker(false); }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: font.base, fontWeight: '700', color: colors.text }}>{isStart ? 'Hora de inicio' : 'Hora de fin'}</Text>
                  <TouchableOpacity onPress={() => { setShowStartPicker(false); setShowEndPicker(false); }}>
                    <Text style={{ fontSize: 20, color: colors.textMuted }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: SH * 0.55 }}>
                  {TIME_SLOTS.map(t => {
                    const sel = t === currentVal;
                    return (
                      <TouchableOpacity key={t} onPress={() => onTimeSelect(t)}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: sel ? colors.primarySoft : 'transparent' }}>
                        <Text style={{ fontSize: font.base, fontWeight: sel ? '700' : '400', color: sel ? colors.primary : colors.text }}>{t}</Text>
                        {sel && <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>
        );
      })()}

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
  manualBtn:     { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  manualBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  content:   { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  pageTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 2 },
  pageSub:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, marginBottom: spacing.sm },

  // Area detail
  galleryWrap:      { marginHorizontal: -spacing.lg, marginTop: -spacing.lg, marginBottom: spacing.lg },
  galleryImg:       { height: 300 },
  galleryPlaceholder: { marginHorizontal: -spacing.lg, marginTop: -spacing.lg, height: 200, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  dotsRow:          { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 8 },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, opacity: 0.5 },
  detailName:       { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: 6 },
  detailDesc:       { fontSize: font.sm, color: colors.text2, lineHeight: 22, marginBottom: spacing.sm },

  // ── New area card (full-width image) ──
  areaCardNew:     { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing.md, overflow: 'hidden', ...SHADOW },
  areaCardImgWrap: { position: 'relative' },
  areaCardImg:     { width: '100%', height: 180 },
  fotosBadge:      { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  fotosBadgeText:  { color: '#fff', fontSize: 11, fontWeight: '600' },
  activoBadgeImg:  { position: 'absolute', top: 8, right: 8, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  areaCardBody:    { padding: spacing.md },
  areaCardName:    { fontSize: font.base, fontWeight: '700', color: colors.text, marginBottom: 2 },
  areaCardDesc:    { fontSize: font.sm, color: colors.textMuted, marginBottom: 4 },
  areaCardPrice:   { fontSize: font.sm, color: colors.primary, fontWeight: '600', marginBottom: 2 },
  areaCardCount:   { fontSize: 11, color: colors.textMuted },
  // ── New reservation card (with area image) ──
  reservaCardNew:     { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing.md, overflow: 'hidden', ...SHADOW },
  reservaCardImg:     { width: '100%', height: 140 },
  reservaCardContent: { padding: spacing.md },

  // Reservation card
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  reservaTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: spacing.sm },
  reservaArea:     { fontSize: font.base, fontWeight: '700', color: colors.text, marginBottom: 2 },
  reservaProp:     { fontSize: font.sm, fontWeight: '600', color: colors.text2, marginBottom: 1 },
  reservaPropiedad:{ fontSize: 12, color: colors.primary, marginBottom: 2 },
  reservaFecha:    { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  reservaNota:     { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  estadoBadge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', flexShrink: 0 },
  estadoBadgeText: { fontSize: 11, fontWeight: '700' },

  reviewBtns:    { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  actionBtn:     { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.text2, textAlign: 'center' },
  btnRechazar:   { flex: 1, backgroundColor: '#ef4444', borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  btnRechazarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnAprobar:    { flex: 1, backgroundColor: '#16a34a', borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  btnAprobarText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  verMasBtn:     { alignItems: 'center', paddingVertical: 14, marginBottom: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  verMasBtnText: { color: colors.primary, fontWeight: '700', fontSize: font.sm },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel:   { fontSize: font.sm, color: colors.textMuted, fontWeight: '600', flex: 1 },
  detailVal:     { fontSize: font.sm, color: colors.text, fontWeight: '500', flex: 2, textAlign: 'right' },

  cambioBox:    { backgroundColor: '#f8faff', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm, borderWidth: 1, borderColor: '#e0e7ff' },
  cambioTitle:  { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 2 },
  cambioDetail: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  cambioNota:   { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.sm },

  tabs:          { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  tab:           { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  tabActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText:       { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: '#fff' },
  subTabs:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md },
  subTab:        { paddingVertical: 10, paddingHorizontal: spacing.md, marginBottom: -1 },
  subTabActive:  { borderBottomWidth: 2, borderBottomColor: colors.primary },
  subTabText:    { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  subTabTextActive: { color: colors.primary },

  picker:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 13, borderWidth: 1, borderColor: colors.border, ...SHADOW },
  pickerOpen:  { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: 'transparent' },
  pickerText:  { fontSize: font.base, color: colors.text, flex: 1 },
  pickerArrow: { fontSize: 16, color: colors.textMuted },
  drop:        { borderWidth: 1, borderTopWidth: 0, borderColor: colors.border, backgroundColor: colors.surface, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, elevation: 12, zIndex: 99, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  dropItem:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropItemActive: { backgroundColor: '#f5f3ff' },
  dropText:    { fontSize: font.base, color: colors.text, flex: 1 },
  dropTextActive: { color: colors.primary, fontWeight: '700' },

  // Modals
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
  modalCard:  { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...SHADOW },
  modalTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginBottom: 4 },
  modalSub:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },

  residenteCard:    { backgroundColor: '#f0f4ff', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#c7d2fe' },
  residenteNombre:  { fontSize: font.sm, fontWeight: '700', color: colors.text },
  residenteDetalle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  label:     { fontSize: 12, fontWeight: '600', color: colors.text2, marginBottom: 4, marginTop: spacing.sm },
  input:     { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: font.base, color: colors.text, backgroundColor: colors.inputBg },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.xs },
  rowBtns:   { flexDirection: 'row', gap: 8 },
  btnSec:    { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnSecText:{ fontSize: font.sm, fontWeight: '600', color: colors.text2 },
  btnPri:    { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnPriText:{ fontSize: font.sm, fontWeight: '700', color: '#fff' },
  pickerBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerBtnText: { fontSize: font.base, color: colors.text },
  errorText: { fontSize: 12, color: colors.danger, marginTop: spacing.sm },

  // Lightbox
  lightboxBg:        { flex: 1, backgroundColor: '#000' },
  lightboxClose:     { position: 'absolute', top: 48, right: 16, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  lightboxCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  lightboxCounter:   { position: 'absolute', top: 54, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', zIndex: 10 },


  // Image grid in edit modal
  imgGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  imgThumbWrap:  { width: 80, height: 80, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
  imgThumb:      { width: 80, height: 80 },
  imgRemoveBtn:  { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  imgRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 14 },
  imgNewBadge:   { position: 'absolute', bottom: 3, left: 3, backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  imgAddBtn:     { width: 80, height: 80, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  imgAddIcon:    { fontSize: 22, color: colors.primary, lineHeight: 26 },
  imgAddText:    { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
});
}