import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDownIcon } from '../../src/components/Icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useCondo } from '../../src/context/CondoContext';
import { colors, spacing, radius, font } from '../../src/theme';
import AppDrawer from '../../src/components/Drawer';
import { BellIcon } from '../../src/components/Icons';
import * as api from '../../src/api';

const PAGE_SIZE = 12;

const DATE_OPTIONS = [
  { value: 'todos',    label: 'Todos' },
  { value: 'semana',   label: 'Última semana' },
  { value: 'mes',      label: 'Último mes' },
  { value: 'antiguos', label: 'Más antiguos' },
];

const TARGET_OPTIONS = [
  { value: 'todos',        label: 'Todos' },
  { value: 'propietarios', label: 'Propietarios' },
  { value: 'inquilinos',   label: 'Inquilinos' },
  { value: 'seguridad',    label: 'Seguridad' },
];

const TARGET_STYLE = {
  todos:        { bg: '#ede9fe', text: '#5b21b6' },
  propietarios: { bg: '#dbeafe', text: '#1d4ed8' },
  inquilinos:   { bg: '#d1fae5', text: '#065f46' },
  seguridad:    { bg: '#fee2e2', text: '#991b1b' },
};

const SHADOW = {
  shadowColor: '#101828', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
};

function InlinePicker({ value, options, onSelect, placeholder }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [triggerH, setTriggerH] = useState(48);
  const selected = options.find(o => o.value === value);
  const ps = {
    picker:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderColor:colors.border, borderRadius:radius.sm, paddingHorizontal:12, paddingVertical:10, backgroundColor:colors.inputBg },
    pickerOpen:    { borderColor:colors.primary, borderTopLeftRadius:0, borderTopRightRadius:0, borderTopColor:'transparent' },
    pickerText:    { flex:1, fontSize:font.sm, color:colors.text },
    drop:          { backgroundColor:colors.surface, borderWidth:1, borderBottomWidth:0, borderColor:colors.primary, borderTopLeftRadius:radius.sm, borderTopRightRadius:radius.sm, zIndex:99, overflow:'hidden' },
    dropItem:      { paddingHorizontal:12, paddingVertical:10, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth:1, borderBottomColor:colors.border },
    dropItemActive:{ backgroundColor:colors.primarySoft },
    dropText:      { fontSize:font.sm, color:colors.text, flex:1 },
    dropTextActive:{ fontWeight:'700', color:colors.primary },
  };
  return (
    <View style={{ zIndex: open ? 99 : 1 }}>
      <TouchableOpacity
        style={[ps.picker, open && ps.pickerOpen]}
        onPress={() => setOpen(o => !o)}
        onLayout={e => setTriggerH(e.nativeEvent.layout.height)}
        activeOpacity={0.85}
      >
        <Text style={ps.pickerText} numberOfLines={1}>{selected?.label ?? placeholder}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDownIcon size={16} color={open ? colors.primary : colors.textMuted} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={[ps.drop, { position: 'absolute', bottom: triggerH, left: 0, right: 0 }]}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[ps.dropItem, value === opt.value && ps.dropItemActive]}
              onPress={() => { onSelect(opt.value); setOpen(false); }}
            >
              <Text style={[ps.dropText, value === opt.value && ps.dropTextActive]} numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AnunciosScreen() {
  const { user, isSuperAdmin, isAdmin, isOwner, isTenant, isSeguridad } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { condoName: ctxCondoName } = useCondo();
  const canManage = isSuperAdmin || isAdmin;

  const [dateFilter, setDateFilter]     = useState('todos');
  const [targetFilter, setTargetFilter] = useState('todos');
  const [periodoDropOpen, setPeriodoDropOpen]   = useState(false);
  const [destDropOpen, setDestDropOpen]         = useState(false);
  const [page, setPage]                 = useState(1);
  const [pageData, setPageData]       = useState({ data: [], total: 0, totalPages: 1 });
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [drawerOpen, setDrawerOpen]   = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [form, setForm]                 = useState({ title: '', message: '', target: 'todos' });
  const [formLoading, setFormLoading]   = useState(false);

  const [deletingId, setDeletingId]       = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [refreshKey, setRefreshKey]       = useState(0);
  const [detailItem, setDetailItem]       = useState(null);

  const condoName  = ctxCondoName || user?.condo || undefined;
  // For Super Admin, wait until CondoContext resolves their condo name before loading
  const condoReady = !isSuperAdmin || Boolean(ctxCondoName);

  const loadPage = useCallback((showLoading = true) => {
    if (!condoReady) return;
    if (showLoading) setLoading(true);
    const df = dateFilter !== 'todos' ? dateFilter : undefined;
    const tf = targetFilter !== 'todos' ? targetFilter : undefined;
    return api.getAnunciosPaged({ page, limit: PAGE_SIZE, condo: condoName, dateFilter: df, targetFilter: tf })
      .then(res => {
        if (res && Array.isArray(res.data)) setPageData(res);
        else setPageData({ data: Array.isArray(res) ? res : [], total: 0, totalPages: 1 });
      })
      .catch(err => Alert.alert('Error', err.message))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [page, condoName, dateFilter, targetFilter, refreshKey, condoReady]);

  useEffect(() => { loadPage(); }, [loadPage]);
  useEffect(() => { setPage(1); }, [dateFilter, targetFilter]);

  const onRefresh = () => { setRefreshing(true); loadPage(false); };

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: '', message: '', target: 'todos' });
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({ title: item.title, message: item.message, target: item.target || 'todos' });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      Alert.alert('Campos requeridos', 'Completá el título y el mensaje.');
      return;
    }
    setFormLoading(true);
    try {
      const payload = condoName ? { ...form, condo: condoName } : form;
      if (editingId) await api.updateAnuncio(String(editingId), payload);
      else            await api.createAnuncio(payload);
      setModalVisible(false);
      setPage(1);
      setRefreshKey(k => k + 1);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.deleteAnuncio(String(deletingId));
      setDeletingId(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const roleLabel =
    isSuperAdmin ? 'Super Admin'
    : isAdmin      ? 'Administrador'
    : isSeguridad  ? 'Seguridad'
    : isOwner      ? 'Propietario'
    : isTenant     ? 'Inquilino'
    : 'Residente';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
          <Text style={styles.hamburgerLines}>≡</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Anuncios</Text>
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
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Anuncios</Text>
            <Text style={styles.pageSub}>
              {canManage ? 'Gestiona los anuncios del condominio' : 'Información de tu condominio'}
            </Text>
          </View>
          {canManage && (
            <TouchableOpacity style={styles.newBtn} onPress={openCreate} activeOpacity={0.85}>
              <Text style={styles.newBtnText}>+ Nuevo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          {isSuperAdmin && (
            <View style={{ paddingVertical: 4 }}>
              <Text style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Condominio</Text>
              <Text style={{ fontSize: font.sm, fontWeight: '600', color: colors.text }}>
                {ctxCondoName || '—'}
              </Text>
            </View>
          )}
          {/* Filtros — Período + Destinatario en fila */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {/* Período */}
            <View style={{ flex: 1, zIndex: periodoDropOpen ? 200 : 1, elevation: periodoDropOpen ? 20 : 0 }}>
              <Text style={styles.filterLabel}>Período</Text>
              <TouchableOpacity
                style={{ height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                onPress={() => { setPeriodoDropOpen(o => !o); setDestDropOpen(false); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: font.sm, color: colors.text }}>
                  {{ todos: 'Todos', semana: 'Semana', mes: 'Mes', antiguos: 'Antiguos' }[dateFilter]}
                </Text>
                <View style={{ transform: [{ rotate: periodoDropOpen ? '180deg' : '0deg' }] }}>
                  <ChevronDownIcon size={15} color={periodoDropOpen ? colors.primary : colors.textMuted} />
                </View>
              </TouchableOpacity>
              {periodoDropOpen && (
                <View style={{ position: 'absolute', top: 66, left: 0, right: 0, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, elevation: 20, zIndex: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 }}>
                  {[{ value: 'todos', label: 'Todos' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }, { value: 'antiguos', label: 'Antiguos' }].map((opt, i, arr) => (
                    <TouchableOpacity key={opt.value} onPress={() => { setDateFilter(opt.value); setPeriodoDropOpen(false); setPage(1); }}
                      style={{ paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: dateFilter === opt.value ? colors.primarySoft : 'transparent' }}>
                      <Text style={{ fontSize: font.sm, color: dateFilter === opt.value ? colors.primary : colors.text, fontWeight: dateFilter === opt.value ? '700' : '400' }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Destinatario */}
            {canManage && (
              <View style={{ flex: 1, zIndex: destDropOpen ? 200 : 1, elevation: destDropOpen ? 20 : 0 }}>
                <Text style={styles.filterLabel}>Destinatario</Text>
                <TouchableOpacity
                  style={{ height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  onPress={() => { setDestDropOpen(o => !o); setPeriodoDropOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: font.sm, color: colors.text }}>
                    {{ todos: 'Todos', propietarios: 'Propiet.', inquilinos: 'Inquilinos', seguridad: 'Seguridad' }[targetFilter]}
                  </Text>
                  <View style={{ transform: [{ rotate: destDropOpen ? '180deg' : '0deg' }] }}>
                    <ChevronDownIcon size={15} color={destDropOpen ? colors.primary : colors.textMuted} />
                  </View>
                </TouchableOpacity>
                {destDropOpen && (
                  <View style={{ position: 'absolute', top: 66, left: 0, right: 0, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, elevation: 20, zIndex: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 }}>
                    {[{ value: 'todos', label: 'Todos' }, { value: 'propietarios', label: 'Propietarios' }, { value: 'inquilinos', label: 'Inquilinos' }, { value: 'seguridad', label: 'Seguridad' }].map((opt, i, arr) => (
                      <TouchableOpacity key={opt.value} onPress={() => { setTargetFilter(opt.value); setDestDropOpen(false); setPage(1); }}
                        style={{ paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: targetFilter === opt.value ? colors.primarySoft : 'transparent' }}>
                        <Text style={{ fontSize: font.sm, color: targetFilter === opt.value ? colors.primary : colors.text, fontWeight: targetFilter === opt.value ? '700' : '400' }}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {loading && pageData.data.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : pageData.data.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.xl }]}>
            <Text style={{ fontSize: font.base, color: colors.textMuted }}>No hay anuncios.</Text>
          </View>
        ) : pageData.data.map(item => {
          const tc = TARGET_STYLE[item.target] ?? TARGET_STYLE.todos;
          const CardWrapper = canManage ? View : TouchableOpacity;
          return (
            <CardWrapper key={item.id} style={styles.card} {...(!canManage && { onPress: () => setDetailItem(item), activeOpacity: 0.85 })}>
              <View style={styles.cardTop}>
                <View style={styles.bellCircle}>
                  <BellIcon size={18} color="#5b21b6" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.anuncioTitle} numberOfLines={2}>{item.title}</Text>
                    {canManage && (
                      <View style={[styles.chip, { backgroundColor: tc.bg }]}>
                        <Text style={[styles.chipText, { color: tc.text }]}>
                          {TARGET_OPTIONS.find(t => t.value === item.target)?.label ?? 'Todos'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.anuncioMsg}>{item.message}</Text>
                  <Text style={styles.anuncioDate}>{item.dateLabel}</Text>
                </View>
              </View>
              {canManage && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                    <Text style={styles.actionBtnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.danger }]}
                    onPress={() => setDeletingId(item.id)}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.danger }]}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </CardWrapper>
          );
        })}

        {pageData.totalPages > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, page <= 1 && styles.pageBtnOff]}
              onPress={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <Text style={styles.pageBtnText}>← Ant</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>Pág {page} / {pageData.totalPages}</Text>
            <TouchableOpacity
              style={[styles.pageBtn, page >= pageData.totalPages && styles.pageBtnOff]}
              onPress={() => setPage(p => Math.min(pageData.totalPages, p + 1))}
              disabled={page >= pageData.totalPages}
            >
              <Text style={styles.pageBtnText}>Sig →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Create / Edit modal */}
      <Modal visible={modalVisible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={[styles.bottomSheet, { position: 'relative' }]}>
            <View style={{ padding: spacing.lg, paddingBottom: spacing.md + insets.bottom }}>
              <View style={styles.sheetHandleRow}>
                <Text style={styles.modalTitle}>{editingId ? 'Editar Anuncio' : 'Nuevo Anuncio'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
              </View>

              <Text style={styles.label}>Título *</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={t => setForm(f => ({ ...f, title: t }))}
                placeholder="Título del anuncio"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Mensaje *</Text>
              <TextInput
                style={[styles.input, { height: 88, textAlignVertical: 'top' }]}
                value={form.message}
                onChangeText={t => setForm(f => ({ ...f, message: t }))}
                placeholder="Contenido del anuncio"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={styles.label}>Dirigido a</Text>
              <InlinePicker
                value={form.target}
                options={TARGET_OPTIONS}
                onSelect={v => setForm(f => ({ ...f, target: v }))}
                placeholder="Todos"
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
                <TouchableOpacity style={styles.btnSec} onPress={() => setModalVisible(false)}>
                  <Text style={styles.btnSecText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPri, formLoading && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={formLoading}
                >
                  <Text style={styles.btnPriText}>{formLoading ? 'Guardando…' : 'Guardar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Announcement detail modal (residents) */}
      <Modal visible={!!detailItem} animationType="none" transparent statusBarTranslucent onRequestClose={() => setDetailItem(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={() => setDetailItem(null)} />
        <View style={[styles.bottomSheet]}>
          <View style={{ padding: spacing.lg, paddingBottom: spacing.lg + 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={styles.bellCircle}>
                <BellIcon size={18} color="#5b21b6" />
              </View>
              <Text style={[styles.anuncioTitle, { flex: 1, marginLeft: spacing.sm, fontSize: font.lg }]} numberOfLines={3}>
                {detailItem?.title}
              </Text>
              <TouchableOpacity onPress={() => setDetailItem(null)} style={{ padding: 4 }}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: font.base, color: colors.text, lineHeight: 22 }}>{detailItem?.message}</Text>
            </ScrollView>
            {detailItem?.dateLabel ? (
              <Text style={[styles.anuncioDate, { marginTop: spacing.md }]}>{detailItem.dateLabel}</Text>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Delete confirm modal */}
      <Modal visible={!!deletingId} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setDeletingId(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { alignItems: 'center' }]}>
            <View style={styles.dangerCircle}>
              <Text style={{ fontSize: 22, color: '#fff', fontWeight: '700' }}>!</Text>
            </View>
            <Text style={styles.modalTitle}>¿Eliminar este anuncio?</Text>
            <Text style={[styles.pageSub, { textAlign: 'center', marginBottom: spacing.md }]}>
              Esta acción no se puede deshacer.
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.btnSec} onPress={() => setDeletingId(null)}>
                <Text style={styles.btnSecText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnDanger, deleteLoading && { opacity: 0.6 }]}
                onPress={handleDelete}
                disabled={deleteLoading}
              >
                <Text style={styles.btnPriText}>{deleteLoading ? 'Eliminando…' : 'Eliminar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

  content:  { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.md },
  pageTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 2 },
  pageSub:   { fontSize: font.sm, color: colors.textMuted },

  newBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 9,
  },
  newBtnText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },

  filterLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },

  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  pickerOpen:  { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: 'transparent' },
  pickerText:  { fontSize: font.base, color: colors.text, flex: 1 },
  pickerArrow: { fontSize: 16, color: colors.textMuted },
  drop: {
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.border,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
    elevation: 12, zIndex: 99,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  dropItem:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropItemActive: { backgroundColor: '#f5f3ff' },
  dropText:       { fontSize: font.base, color: colors.text, flex: 1 },
  dropTextActive: { color: colors.primary, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  cardTop:    { flexDirection: 'row', gap: 12, marginBottom: spacing.sm },
  bellCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  titleRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  anuncioTitle: { fontSize: font.base, fontWeight: '700', color: colors.text, flex: 1 },
  chip:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  chipText:   { fontSize: 10, fontWeight: '700' },
  anuncioMsg: { fontSize: font.sm, color: colors.text2, lineHeight: 20, marginBottom: 4 },
  anuncioDate:{ fontSize: 11, color: colors.textMuted },

  actionRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  actionBtn: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.text2 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: spacing.sm },
  pageBtn:    { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  pageBtnOff: { opacity: 0.4 },
  pageBtnText:{ fontSize: font.sm, fontWeight: '600', color: colors.text },
  pageInfo:   { fontSize: font.sm, color: colors.text2 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
  backdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
  },
  sheetHandleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  closeX: { fontSize: 18, color: colors.textMuted, padding: 4 },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, ...SHADOW,
  },
  modalTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  label:      { fontSize: 12, fontWeight: '600', color: colors.text2, marginBottom: 4, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 11,
    fontSize: font.base, color: colors.text, backgroundColor: colors.inputBg,
  },
  btnSec:     { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnSecText: { fontSize: font.sm, fontWeight: '600', color: colors.text2 },
  btnPri:     { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  btnPriText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },
  btnDanger:  { flex: 1, backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },

  dangerCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
});
}