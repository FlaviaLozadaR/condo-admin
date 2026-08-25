import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, KeyboardAvoidingView,
  Platform, Pressable, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ChevronDownIcon } from '../../src/components/Icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { colors, spacing, radius, font } from '../../src/theme';
import TopBar from '../../src/components/TopBar';
import AppDrawer from '../../src/components/Drawer';
import * as api from '../../src/api';

const PAGE_SIZE = 20;

// ── Icons ────────────────────────────────────────────────────────────────────
function BuildingIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={1.8} strokeLinecap="round">
      <Path d="M7 3H17V21H7V3ZM10 7H11M13 7H14M10 11H11M13 11H14M10 15H11M13 15H14" />
    </Svg>
  );
}
function PencilIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z" />
    </Svg>
  );
}
function TrashIcon({ color = '#ff3040' }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6" />
    </Svg>
  );
}
function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 16C13.3 16 16 13.3 16 10C16 6.7 13.3 4 10 4C6.7 4 4 6.7 4 10C4 13.3 6.7 16 10 16ZM18 18L14.3 14.3" />
    </Svg>
  );
}
function AlertIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 9V13M12 17H12.01M4.6 18H19.4C20.7 18 21.5 16.6 20.8 15.5L13.4 4.2C12.8 3.2 11.3 3.2 10.6 4.2L3.2 15.5C2.5 16.6 3.3 18 4.6 18Z" />
    </Svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPropertyTenants(p) {
  if (Array.isArray(p.tenants)) return p.tenants.filter(Boolean);
  if (p.tenant && p.tenant !== '-') return [p.tenant];
  return [];
}
function getTenantsText(p) {
  const t = getPropertyTenants(p);
  return t.length ? t.join(', ') : '-';
}

// ── Inline dropdown ───────────────────────────────────────────────────────────
function InlinePicker({ value, options, onSelect, placeholder, open, onToggle }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ zIndex: open ? 99 : 1 }}>
      <TouchableOpacity
        style={[styles.pickerBtn, { backgroundColor: c.inputBg }, open && styles.pickerBtnOpen]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Text style={[styles.pickerBtnText, !value && { color: c.textMuted }]} numberOfLines={1}>
          {value || placeholder || '— Seleccionar —'}
        </Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDownIcon size={16} color={open ? c.primary : c.textMuted} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={[styles.inlineDrop, { backgroundColor: c.surface }]}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.key ?? opt.label}
              style={[styles.inlineDropItem, value === opt.label && styles.inlineDropItemActive]}
              onPress={() => { onSelect(opt); onToggle(); }}
            >
              <Text style={[styles.inlineDropText, value === opt.label && styles.inlineDropTextActive]} numberOfLines={1}>
                {opt.label}
              </Text>
              {value === opt.label && <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Searchable dropdown ───────────────────────────────────────────────────────
function SearchablePicker({ value, options, onSelect, placeholder, open, onToggle, title }) {
  const { colors: c } = useTheme();
  const [q, setQ] = useState('');
  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()) && o.key !== '');

  const handleClose = () => { setQ(''); onToggle(); };
  const handleSelect = (opt) => { onSelect(opt); handleClose(); };

  return (
    <View>
      <TouchableOpacity
        style={[styles.pickerBtn, { backgroundColor: c.inputBg, borderColor: open ? c.primary : c.border }]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Text style={[styles.pickerBtnText, { color: value ? c.text : c.textMuted }]} numberOfLines={1}>
          {value || placeholder || '— Seleccionar —'}
        </Text>
        <ChevronDownIcon size={16} color={value ? c.primary : c.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg }} activeOpacity={1} onPress={handleClose}>
          <Pressable style={{ backgroundColor: c.surface, borderRadius: radius.xl, overflow: 'hidden', maxHeight: '75%' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text style={{ fontSize: font.md, fontWeight: '700', color: c.text }}>{title || placeholder || 'Seleccionar'}</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 18, color: c.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Search */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, padding: 10, backgroundColor: c.inputBg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border }}>
              <SearchIcon />
              <TextInput
                style={{ flex: 1, fontSize: font.sm, color: c.text }}
                placeholder="Buscar..."
                placeholderTextColor={c.textMuted}
                value={q}
                onChangeText={setQ}
                autoCapitalize="none"
                autoFocus
              />
              {q.length > 0 && (
                <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 14, color: c.textMuted }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Selected pinned */}
            {value && !q && (
              <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: c.primarySoft, borderRadius: radius.md, padding: 12, gap: 8 }}>
                <Text style={{ flex: 1, fontSize: font.sm, fontWeight: '700', color: c.primary }} numberOfLines={1}>{value}</Text>
                <TouchableOpacity onPress={() => { onSelect({ key: '', label: '' }); handleClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 12, color: c.textMuted }}>✕ Quitar</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* List */}
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
              {filtered.length === 0 && (
                <View style={{ padding: spacing.md }}>
                  <Text style={{ fontSize: font.sm, color: c.textMuted }}>Sin resultados.</Text>
                </View>
              )}
              {filtered.filter(o => o.label !== value).map(opt => (
                <TouchableOpacity
                  key={opt.key ?? opt.label}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border }}
                  onPress={() => handleSelect(opt)}
                >
                  <Text style={{ flex: 1, fontSize: font.sm, color: c.text }} numberOfLines={1}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Form primitives ───────────────────────────────────────────────────────────
function FL({ children }) {
  return <Text style={styles.formLabel}>{children}</Text>;
}
function FI({ style, ...props }) {
  const { colors: c } = useTheme();
  return (
    <TextInput
      style={[styles.formInput, { backgroundColor: c.inputBg, color: c.text }, style]}
      placeholderTextColor={c.textMuted}
      {...props}
    />
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <View style={[styles.toast, toast.type === 'error' && styles.toastError]}>
      <Text style={styles.toastText}>{toast.msg}</Text>
    </View>
  );
}

// ── Street picker with search ─────────────────────────────────────────────────
function StreetPicker({ value, streets, onSelect, open, onToggle }) {
  const { colors: c } = useTheme();
  const [q, setQ] = useState('');
  const filtered = streets.filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
  const showNew  = q.trim().length > 0 && !streets.some(s => s.name.toLowerCase() === q.trim().toLowerCase());

  const handleClose = () => { setQ(''); onToggle(); };
  const handleSelect = (name) => { onSelect(name); handleClose(); };

  return (
    <View>
      <TouchableOpacity
        style={[styles.pickerBtn, { backgroundColor: c.inputBg, borderColor: open ? c.primary : c.border }]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Text style={[styles.pickerBtnText, { color: value ? c.text : c.textMuted }]} numberOfLines={1}>
          {value || '— Seleccioná una calle —'}
        </Text>
        <ChevronDownIcon size={16} color={value ? c.primary : c.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg }} activeOpacity={1} onPress={handleClose}>
          <Pressable style={{ backgroundColor: c.surface, borderRadius: radius.xl, overflow: 'hidden', maxHeight: '75%' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text style={{ fontSize: font.md, fontWeight: '700', color: c.text }}>Seleccionar Calle</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 18, color: c.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Search */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: spacing.md, padding: 10, backgroundColor: c.inputBg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border }}>
              <SearchIcon />
              <TextInput
                style={{ flex: 1, fontSize: font.sm, color: c.text }}
                placeholder="Buscar o escribir nueva calle..."
                placeholderTextColor={c.textMuted}
                value={q}
                onChangeText={setQ}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
              />
              {q.length > 0 && (
                <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 14, color: c.textMuted }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Selected pinned */}
            {value && !q && (
              <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: c.primarySoft, borderRadius: radius.md, padding: 12, gap: 8 }}>
                <Text style={{ flex: 1, fontSize: font.sm, fontWeight: '700', color: c.primary }} numberOfLines={1}>{value}</Text>
                <TouchableOpacity onPress={() => { onSelect(''); handleClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 12, color: c.textMuted }}>✕ Quitar</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* List */}
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
              {showNew && (
                <TouchableOpacity
                  style={{ paddingHorizontal: spacing.md, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border }}
                  onPress={() => handleSelect(q.trim())}
                >
                  <Text style={{ fontSize: font.sm, color: c.primary, fontWeight: '700' }}>+ Crear: "{q.trim()}"</Text>
                </TouchableOpacity>
              )}
              {filtered.length === 0 && !showNew && (
                <View style={{ padding: spacing.md }}>
                  <Text style={{ fontSize: font.sm, color: c.textMuted }}>Escribí para crear una calle nueva.</Text>
                </View>
              )}
              {filtered.filter(s => s.name !== value).map(s => (
                <TouchableOpacity
                  key={s.name}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border, gap: 8 }}
                  onPress={() => handleSelect(s.name)}
                >
                  <Text style={{ flex: 1, fontSize: font.sm, color: c.text }} numberOfLines={1}>{s.name}</Text>
                  <Text style={{ fontSize: 11, color: c.textMuted }}>{s.count} prop.</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PropiedadesScreen() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador' : 'Residente';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [condos,     setCondos]     = useState([]);
  const [usuarios,   setUsuarios]   = useState([]);
  const [allProps,    setAllProps]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [search,      setSearch]      = useState('');
  const [condoId,     setCondoId]     = useState(0);
  const [selectedStreet, setSelectedStreet] = useState(null);
  const [streetSearch, setStreetSearch] = useState('');
  const [toast,       setToast]       = useState(null);

  // Modals
  const [createModal,  setCreateModal]  = useState(false);
  const [editModal,    setEditModal]    = useState(null);
  const [deleteModal,  setDeleteModal]  = useState(null);
  const [renameModal,  setRenameModal]  = useState(null); // { name, newName }
  const [streetMenu,   setStreetMenu]   = useState(null); // { name, count }
  const [deleteStreet, setDeleteStreet] = useState(null); // { name, count }
  const [newCalleModal, setNewCalleModal] = useState(false);
  const [newCalleName,  setNewCalleName]  = useState('');
  const [callesDB,      setCallesDB]      = useState([]); // calles sin propiedades aún

  // Create form
  const [createForm, setCreateForm] = useState({
    condoId: '', calle: '', numero: '', bloque: '', propietario: '', inquilinos: [''],
  });

  // Dropdown states in modals (tracked by field name)
  const [openDrop, setOpenDrop] = useState(null); // 'condo'|'owner'|`tenant-${i}`

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const condoParam = isSuperAdmin
    ? (condoId === 0 ? undefined : condos.find(c => c.id === condoId)?.name)
    : user?.condo;

  const loadBase = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([api.getCondominios(), api.getUsuarios()]);
      setCondos(Array.isArray(c) ? c : (c.condominios ?? []));
      setUsuarios(Array.isArray(u) ? u : (u.usuarios ?? u.data ?? []));
    } catch {}
  }, []);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [res, calles] = await Promise.all([
        api.getPropiedadesPaged({ limit: 1000, condo: condoParam }),
        api.getCalles(condoParam).catch(() => []),
      ]);
      setAllProps(Array.isArray(res) ? res : (res?.data ?? []));
      setCallesDB(Array.isArray(calles) ? calles : []);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [condoParam]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-select first condo for Super Admin
  useEffect(() => {
    if (isSuperAdmin && condos.length > 0 && condoId === 0) setCondoId(condos[0].id);
  }, [condos, isSuperAdmin]);

  // Owners and tenants lists
  const propietariosOptions = usuarios
    .filter(u => u.role === 'Propietario' && (!condoParam || u.condo === condoParam))
    .map(u => ({ key: u.id, label: u.name }));

  const inquilinosOptions = usuarios
    .filter(u => u.role === 'Inquilino' && (!condoParam || u.condo === condoParam))
    .map(u => ({ key: u.id, label: u.name }));

  const condoOptions = [
    { key: 0, label: 'Seleccionar condominio' },
    ...condos.map(c => ({ key: c.id, label: `${c.type}: ${c.name}`, id: c.id, type: c.type, name: c.name })),
  ];

  // Selected condo type for "isEdificio"
  const selectedCondoObj = condos.find(c => String(c.id) === String(createForm.condoId));
  const isEdificio = selectedCondoObj?.type === 'Edificio';

  // ── CREATE ────────────────────────────────────────────────────────────────
  function openCreate(prefillStreet = null) {
    const defaultId = String(condos[0]?.id ?? '');
    setCreateForm({ condoId: defaultId, calle: prefillStreet ?? '', numero: '', bloque: '', propietario: '', inquilinos: [''] });
    setOpenDrop(null);
    setCreateModal(true);
  }

  async function handleCreate() {
    const cObj = condos.find(c => String(c.id) === String(createForm.condoId));
    if (!cObj || !createForm.calle.trim() || !createForm.numero.trim()) {
      showToast('Calle y número son obligatorios', 'error'); return;
    }
    setSaving(true);
    try {
      const tenants = createForm.inquilinos.filter(t => t && t !== '-');
      await api.createPropiedad({
        code: createForm.numero.trim(),
        street: createForm.calle.trim(),
        block: (isEdificio ? createForm.bloque.trim() : '-') || '-',
        owner: createForm.propietario || '-',
        tenants,
        debt: 0,
        condo: cObj.name,
      });
      setCreateModal(false);
      showToast('Propiedad creada');
      loadAll(true);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  // ── EDIT ──────────────────────────────────────────────────────────────────
  function openEdit(p) {
    const tenants = getPropertyTenants(p);
    setEditModal({
      id: p.id,
      calle: p.street ?? '',
      numero: p.code ?? '',
      bloque: p.block ?? '-',
      propietario: p.owner ?? '',
      inquilinos: tenants.length ? tenants : [''],
      deuda: String(p.debt ?? 0),
    });
    setOpenDrop(null);
  }

  async function handleEdit() {
    if (!editModal.calle.trim() || !editModal.numero.trim()) {
      showToast('Calle y número son obligatorios', 'error'); return;
    }
    setSaving(true);
    try {
      const tenants = editModal.inquilinos.filter(t => t && t !== '-');
      const debt = Math.max(0, Number(editModal.deuda) || 0);
      await api.updatePropiedad(String(editModal.id), {
        street: editModal.calle.trim(),
        code: editModal.numero.trim(),
        block: editModal.bloque.trim() || '-',
        owner: editModal.propietario || '-',
        tenants,
        debt,
      });
      setEditModal(null);
      showToast('Propiedad actualizada');
      loadAll(true);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteModal) return;
    setSaving(true);
    try {
      await api.deletePropiedad(String(deleteModal.id));
      setDeleteModal(null);
      showToast('Propiedad eliminada');
      loadAll(true);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  // ── STREET MENU ───────────────────────────────────────────────────────────
  function openStreetMenu(streetName, count) {
    setStreetMenu({ name: streetName, count });
  }

  async function handleRenameStreet() {
    const { name, newName } = renameModal;
    if (!newName.trim() || newName.trim() === name) { setRenameModal(null); return; }
    setSaving(true);
    try {
      const propsToRename = allProps.filter(p => p.street?.trim() === name);
      await Promise.all(propsToRename.map(p => api.updatePropiedad(String(p.id), { street: newName.trim() })));
      setRenameModal(null);
      showToast('Calle renombrada');
      loadAll(true);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  // ── DELETE STREET ─────────────────────────────────────────────────────────
  async function confirmDeleteStreet() {
    const { name } = deleteStreet;
    setDeleteStreet(null);
    setSaving(true);
    try {
      const propsToDelete = allProps.filter(p => p.street?.trim() === name);
      await Promise.all(propsToDelete.map(p => api.deletePropiedad(String(p.id))));
      showToast(`Calle "${name}" eliminada`);
      loadAll(true);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  // ── Tenant helpers ────────────────────────────────────────────────────────
  function addTenant(form, setForm) {
    setForm(f => ({ ...f, inquilinos: [...f.inquilinos, ''] }));
  }
  function removeTenant(form, setForm, idx) {
    setForm(f => {
      const next = f.inquilinos.filter((_, i) => i !== idx);
      return { ...f, inquilinos: next.length ? next : [''] };
    });
  }
  function updateTenant(form, setForm, idx, val) {
    setForm(f => {
      const next = [...f.inquilinos];
      next[idx] = val;
      return { ...f, inquilinos: next };
    });
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const streets = (() => {
    const map = new Map();
    // calles con propiedades
    allProps.forEach(p => {
      if (!p.street) return;
      const s = p.street.trim();
      map.set(s, (map.get(s) ?? 0) + 1);
    });
    // calles creadas sin propiedades aún
    callesDB.forEach(c => {
      if (!map.has(c.name)) map.set(c.name, 0);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, fromDB: callesDB.some(c => c.name === name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const streetProps = selectedStreet
    ? allProps.filter(p => p.street?.trim() === selectedStreet &&
        (!search.trim() || [p.code, p.owner, p.block].some(f => f?.toLowerCase().includes(search.toLowerCase()))))
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Propiedades" onMenuPress={() => setDrawerOpen(true)} roleLabel={roleLabel} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.pageTitle}>Gestion de Propiedades</Text>
        <Text style={styles.pageSub}>Gestiona las propiedades del condominio seleccionado.</Text>

        {/* Condominio — static label */}
        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectorLabel}>CONDOMINIO</Text>
          <Text style={{ fontSize: font.sm, fontWeight: '600', color: colors.text }}>
            {(() => { const c = condos.find(x => x.id === condoId); return c ? `${c.type}: ${c.name}` : (user?.condo || '—'); })()}
          </Text>
        </View>

        {selectedStreet === null ? (
          /* ── VISTA CALLES ── */
          <>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <TouchableOpacity style={[styles.btnPrimary, { flex: 1, height: 48, marginBottom: 0, alignItems: 'center', justifyContent: 'center' }]} onPress={() => { setNewCalleName(''); setNewCalleModal(true); }} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText} numberOfLines={1}>+ Nueva Calle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSecondary, { flex: 1, height: 48, marginBottom: 0, alignItems: 'center', justifyContent: 'center' }]} onPress={() => openCreate()} activeOpacity={0.85}>
                <Text style={styles.btnSecondaryText} numberOfLines={1}>+ Nueva Propiedad</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
              <View style={{ marginLeft: 10 }}><SearchIcon /></View>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar calle..."
                placeholderTextColor={colors.textMuted}
                value={streetSearch}
                onChangeText={setStreetSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {loading ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : streets.length === 0 ? (
              <Text style={styles.emptyText}>No hay propiedades registradas aún.</Text>
            ) : (
              <View style={styles.streetGrid}>
                {streets.filter(s => s.name.toLowerCase().includes(streetSearch.toLowerCase())).map(s => (
                  <View key={s.name} style={styles.streetTile}>
                    {(isSuperAdmin || isAdmin) && (
                      <TouchableOpacity
                        onPress={() => openStreetMenu(s.name, s.count)}
                        style={styles.streetTileMenu}
                        activeOpacity={0.6}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Text style={styles.streetTileMenuDots}>⋮</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={{ flex: 1, alignItems: 'center', width: '100%' }}
                      onPress={() => { setSelectedStreet(s.name); setSearch(''); }}
                      activeOpacity={0.82}
                    >
                      <View style={styles.streetTileIcon}>
                        <BuildingIcon />
                      </View>
                      <Text style={styles.streetTileName} numberOfLines={2}>{s.name}</Text>
                      <Text style={styles.streetTileCount}>{s.count} {s.count === 1 ? 'propiedad' : 'propiedades'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          /* ── VISTA DETALLE DE CALLE ── */
          <>
            <TouchableOpacity style={styles.backBtn} onPress={() => { setSelectedStreet(null); setSearch(''); }} activeOpacity={0.7}>
              <Text style={styles.backBtnText}>← Todas las calles</Text>
            </TouchableOpacity>

            <Text style={styles.streetDetailTitle}>{selectedStreet}</Text>
            <Text style={styles.streetDetailSub}>{streetProps.length} {streetProps.length === 1 ? 'propiedad' : 'propiedades'}</Text>

            <TouchableOpacity style={[styles.btnPrimary, { marginBottom: spacing.sm }]} onPress={() => openCreate(selectedStreet)} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryText}>+ Agregar propiedad</Text>
            </TouchableOpacity>

            <View style={styles.searchWrap}>
              <View style={{ marginLeft: 10 }}><SearchIcon /></View>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por número, propietario..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {streetProps.length === 0 ? (
              <Text style={styles.emptyText}>No se encontraron propiedades en esta calle.</Text>
            ) : streetProps.map(p => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardTitleWrap}>
                    <View style={styles.cardIcon}><BuildingIcon /></View>
                    <View>
                      <Text style={styles.cardCode}>{p.code}</Text>
                      {p.block && p.block !== '-' && <Text style={styles.cardStreet}>Bloque {p.block}</Text>}
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => openEdit(p)}>
                      <PencilIcon />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionDanger]} onPress={() => setDeleteModal(p)}>
                      <TrashIcon />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardLine}>
                    <Text style={styles.cardLineLabel}>Propietario:</Text>
                    <Text style={[styles.cardLineVal, { fontWeight: '700' }]}>{p.owner || '-'}</Text>
                  </View>
                  <View style={styles.cardLine}>
                    <Text style={styles.cardLineLabel}>Inquilino(s):</Text>
                    <Text style={[styles.cardLineVal, { fontWeight: '700' }]}>{getTenantsText(p)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* ── CREATE MODAL ── */}
      <Modal visible={createModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setCreateModal(false)}>
        <View style={{ flex: 1 }}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setCreateModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View style={[styles.bottomSheet, { position: 'relative' }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Crear Propiedad</Text>
                  <TouchableOpacity onPress={() => setCreateModal(false)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
                </View>

                {/* Calle */}
                <FL>CALLE <Text style={{ color: colors.danger }}>*</Text></FL>
                {selectedStreet ? (
                  <View style={[styles.formInput, { justifyContent: 'center' }]}>
                    <Text style={{ fontSize: font.sm, color: colors.text, fontWeight: '600' }}>{createForm.calle}</Text>
                  </View>
                ) : (
                  <StreetPicker
                    value={createForm.calle}
                    streets={streets}
                    open={openDrop === 'street'}
                    onToggle={() => setOpenDrop(d => d === 'street' ? null : 'street')}
                    onSelect={name => setCreateForm(f => ({ ...f, calle: name }))}
                  />
                )}
                <View style={{ height: spacing.sm }} />
                {/* Número */}
                <FL>NÚMERO <Text style={{ color: colors.danger }}>*</Text></FL>
                <FI placeholder="Ej: A-101" value={createForm.numero} onChangeText={v => setCreateForm(f => ({ ...f, numero: v }))} />
                <View style={{ height: spacing.md }} />

                {/* Bloque — only if Edificio */}
                {isEdificio && (
                  <>
                    <FL>BLOQUE <Text style={{ color: colors.danger }}>*</Text></FL>
                    <FI placeholder="Ej: A" value={createForm.bloque} onChangeText={v => setCreateForm(f => ({ ...f, bloque: v }))} />
                    <View style={{ height: spacing.md }} />
                  </>
                )}

                {/* Propietario */}
                <FL>PROPIETARIO</FL>
                <SearchablePicker
                  value={createForm.propietario}
                  options={[{ key: '', label: 'Seleccionar propietario' }, ...propietariosOptions]}
                  placeholder="Seleccionar propietario"
                  title="Propietario"
                  open={openDrop === 'owner'}
                  onToggle={() => setOpenDrop(d => d === 'owner' ? null : 'owner')}
                  onSelect={opt => setCreateForm(f => ({ ...f, propietario: opt.key === '' ? '' : opt.label }))}
                />
                <View style={{ height: spacing.md }} />

                {/* Inquilinos */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <FL>INQUILINO(S)</FL>
                  <TouchableOpacity onPress={() => addTenant(createForm, setCreateForm)}>
                    <Text style={{ fontSize: font.sm, color: colors.primary, fontWeight: '700' }}>+ Agregar</Text>
                  </TouchableOpacity>
                </View>
                {createForm.inquilinos.map((inq, idx) => {
                  const available = inquilinosOptions.filter(o => !createForm.inquilinos.includes(o.label) || o.label === inq);
                  return (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, zIndex: openDrop === `ti-${idx}` ? 50 : 1 }}>
                      <View style={{ flex: 1 }}>
                        <SearchablePicker
                          value={inq}
                          options={[{ key: '', label: 'Seleccionar inquilino' }, ...available]}
                          placeholder="Seleccionar inquilino"
                          title="Inquilino"
                          open={openDrop === `ti-${idx}`}
                          onToggle={() => setOpenDrop(d => d === `ti-${idx}` ? null : `ti-${idx}`)}
                          onSelect={opt => { updateTenant(createForm, setCreateForm, idx, opt.key === '' ? '' : opt.label); }}
                        />
                      </View>
                      {createForm.inquilinos.length > 1 && (
                        <TouchableOpacity
                          style={styles.removeTenantBtn}
                          onPress={() => removeTenant(createForm, setCreateForm, idx)}
                        >
                          <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.btnOutline} onPress={() => setCreateModal(false)}>
                    <Text style={styles.btnOutlineText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnPrimarySmall} onPress={handleCreate} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Crear</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
        </View>
        </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── EDIT MODAL ── */}
      <Modal visible={!!editModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setEditModal(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setEditModal(null)} />
        <View style={styles.bottomSheet}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Editar Propiedad</Text>
                  <TouchableOpacity onPress={() => setEditModal(null)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
                </View>

                <FL>CALLE</FL>
                <FI value={editModal?.calle ?? ''} onChangeText={v => setEditModal(f => ({ ...f, calle: v }))} />
                <View style={{ height: spacing.sm }} />

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <FL>NÚMERO</FL>
                    <FI value={editModal?.numero ?? ''} onChangeText={v => setEditModal(f => ({ ...f, numero: v }))} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FL>BLOQUE</FL>
                    <FI value={editModal?.bloque ?? ''} onChangeText={v => setEditModal(f => ({ ...f, bloque: v }))} />
                  </View>
                </View>
                <View style={{ height: spacing.sm }} />

                {/* Propietario */}
                <FL>PROPIETARIO</FL>
                <SearchablePicker
                  value={editModal?.propietario}
                  options={[{ key: '', label: 'Seleccionar propietario' }, ...propietariosOptions]}
                  placeholder="Seleccionar propietario"
                  title="Propietario"
                  open={openDrop === 'eowner'}
                  onToggle={() => setOpenDrop(d => d === 'eowner' ? null : 'eowner')}
                  onSelect={opt => setEditModal(f => ({ ...f, propietario: opt.key === '' ? '' : opt.label }))}
                />
                <View style={{ height: spacing.sm }} />

                {/* Inquilinos */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <FL>INQUILINO(S)</FL>
                  <TouchableOpacity onPress={() => addTenant(editModal, setEditModal)}>
                    <Text style={{ fontSize: font.sm, color: colors.primary, fontWeight: '700' }}>+ Agregar</Text>
                  </TouchableOpacity>
                </View>
                {editModal?.inquilinos?.map((inq, idx) => {
                  const available = inquilinosOptions.filter(o => !editModal.inquilinos.includes(o.label) || o.label === inq);
                  return (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, zIndex: openDrop === `ei-${idx}` ? 50 : 1 }}>
                      <View style={{ flex: 1 }}>
                        <SearchablePicker
                          value={inq}
                          options={[{ key: '', label: 'Seleccionar inquilino' }, ...available]}
                          placeholder="Seleccionar inquilino"
                          title="Inquilino"
                          open={openDrop === `ei-${idx}`}
                          onToggle={() => setOpenDrop(d => d === `ei-${idx}` ? null : `ei-${idx}`)}
                          onSelect={opt => { updateTenant(editModal, setEditModal, idx, opt.key === '' ? '' : opt.label); }}
                        />
                      </View>
                      {editModal.inquilinos.length > 1 && (
                        <TouchableOpacity
                          style={styles.removeTenantBtn}
                          onPress={() => removeTenant(editModal, setEditModal, idx)}
                        >
                          <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
                <View style={{ height: spacing.sm }} />

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.btnOutline} onPress={() => setEditModal(null)}>
                    <Text style={styles.btnOutlineText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnPrimarySmall} onPress={handleEdit} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
        </View>
      </Modal>

      {/* ── DELETE CONFIRM ── */}
      <Modal visible={!!deleteModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDeleteModal(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <Text style={styles.sheetTitle}>Eliminar propiedad</Text>
              <TouchableOpacity onPress={() => setDeleteModal(null)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.trashWrap}>
              <TrashIcon color={colors.danger} />
            </View>
            <Text style={styles.confirmQ}>
              ¿Eliminar "{deleteModal?.street} - {deleteModal?.code}"?
            </Text>
            <Text style={styles.confirmSub}>Esta acción no se puede deshacer.</Text>
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setDeleteModal(null)}>
                <Text style={styles.btnOutlineText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimarySmall, { backgroundColor: colors.danger }]} onPress={handleDelete} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Sí, eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── RENAME STREET MODAL ── */}
      <Modal visible={!!renameModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setRenameModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.confirmOverlay} activeOpacity={1} onPress={() => setRenameModal(null)}>
            <Pressable style={[styles.confirmCard, { paddingBottom: spacing.lg }]}>
              <View style={styles.confirmHeader}>
                <Text style={styles.sheetTitle}>Editar nombre de calle</Text>
                <TouchableOpacity onPress={() => setRenameModal(null)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm }}>
                Se actualizará en todas las propiedades de esta calle.
              </Text>
              <TextInput
                style={styles.formInput}
                value={renameModal?.newName ?? ''}
                onChangeText={v => setRenameModal(m => ({ ...m, newName: v }))}
                autoFocus
                autoCapitalize="words"
                placeholder="Nombre de la calle"
                placeholderTextColor={colors.textMuted}
              />
              <View style={[styles.formActions, { marginTop: spacing.md }]}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => setRenameModal(null)}>
                  <Text style={styles.btnOutlineText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimarySmall} onPress={handleRenameStreet} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Street action sheet ── */}
      <Modal visible={!!streetMenu} transparent animationType="fade" onRequestClose={() => setStreetMenu(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setStreetMenu(null)}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Math.max(32, insets.bottom + 16), paddingTop: 8 }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 }}>{streetMenu?.name}</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border }}
              onPress={() => { setStreetMenu(null); setRenameModal({ name: streetMenu.name, newName: streetMenu.name }); }}
            >
              <Text style={{ fontSize: 16, color: colors.text }}>Editar nombre</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border }}
              onPress={() => { setDeleteStreet(streetMenu); setStreetMenu(null); }}
            >
              <Text style={{ fontSize: 16, color: '#ef4444' }}>Eliminar calle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginHorizontal: 20, marginTop: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              onPress={() => setStreetMenu(null)}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </TouchableOpacity>
      </Modal>

      {/* ── Confirm delete street ── */}
      <Modal visible={!!deleteStreet} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDeleteStreet(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} activeOpacity={1} onPress={() => setDeleteStreet(null)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Eliminar calle</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24, lineHeight: 20 }}>
              ¿Eliminar "{deleteStreet?.name}"? Esto eliminará {deleteStreet?.count} {deleteStreet?.count === 1 ? 'propiedad' : 'propiedades'} permanentemente.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }} onPress={() => setDeleteStreet(null)}>
                <Text style={{ fontWeight: '600', color: colors.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 13, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center' }} onPress={confirmDeleteStreet}>
                <Text style={{ fontWeight: '600', color: '#fff' }}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </TouchableOpacity>
      </Modal>

      {/* ── Nueva Calle Modal ── */}
      <Modal visible={newCalleModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setNewCalleModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.confirmOverlay} activeOpacity={1} onPress={() => setNewCalleModal(false)}>
            <Pressable style={[styles.confirmCard, { paddingBottom: spacing.lg }]}>
              <View style={styles.confirmHeader}>
                <Text style={styles.sheetTitle}>Nueva Calle</Text>
                <TouchableOpacity onPress={() => setNewCalleModal(false)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
              </View>
              <TextInput
                style={styles.formInput}
                value={newCalleName}
                onChangeText={setNewCalleName}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="Ej: Calle Principal"
                placeholderTextColor={colors.textMuted}
              />
              <View style={[styles.formActions, { marginTop: spacing.md }]}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => setNewCalleModal(false)}>
                  <Text style={styles.btnOutlineText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimarySmall, (!newCalleName.trim() || saving) && { opacity: 0.5 }]}
                  disabled={!newCalleName.trim() || saving}
                  onPress={async () => {
                    if (!newCalleName.trim()) return;
                    setSaving(true);
                    try {
                      const condoName = condos.find(c => c.id === condoId)?.name ?? user?.condo;
                      await api.createCalle(newCalleName.trim(), condoName);
                      setNewCalleModal(false);
                      showToast('Calle creada');
                      loadAll(true);
                    } catch (e) { showToast(e.message, 'error'); }
                    finally { setSaving(false); }
                  }}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Crear</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Toast toast={toast} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const SHADOW = {
  shadowColor: '#101828', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
};

function makeStyles(colors) {
  return StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },

  pageTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 4 },
  pageSub:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },

  btnPrimary: {
    backgroundColor: colors.primaryDark, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start', marginBottom: spacing.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: font.sm },
  btnSecondary: {
    backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start', marginBottom: spacing.md,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  btnSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: font.sm },

  sectorLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },

  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  pickerText:  { fontSize: font.base, color: colors.text, fontWeight: '500', flex: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, ...SHADOW,
  },
  searchInput: { flex: 1, height: 44, paddingHorizontal: spacing.sm, fontSize: font.sm, color: colors.text },

  card: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...SHADOW,
  },
  cardHead:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitleWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardIcon:       { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  cardCode:       { fontSize: font.lg, fontWeight: '800', color: colors.text },
  cardStreet:     { fontSize: font.sm, color: colors.textMuted },
  cardActions:    { flexDirection: 'row', gap: 6 },
  cardActionBtn:  { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  cardActionDanger: { borderColor: '#fee2e2', backgroundColor: '#fff5f5' },
  cardBody:       { gap: 4 },
  cardLine:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  cardLineLabel:  { fontSize: font.sm, color: colors.text2 },
  cardLineVal:    { fontSize: font.sm, color: colors.text, textAlign: 'right', flex: 1, marginLeft: 8 },
  debtBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm, backgroundColor: '#fffbeb', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#fde68a' },
  debtText:       { fontSize: 12, color: '#d97706', fontWeight: '600' },

  emptyText:  { textAlign: 'center', color: colors.textMuted, fontSize: font.sm, padding: spacing.lg },

  // Street grid
  streetGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  streetTile: {
    width: '47.5%', backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...SHADOW,
    alignItems: 'center', minHeight: 120, position: 'relative',
  },
  streetTileIcon:  { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  streetTileName:  { fontSize: font.sm, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4 },
  streetTileCount: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  streetTileMenu:  { position: 'absolute', top: 6, right: 6, zIndex: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  streetTileMenuDots: { fontSize: 15, color: colors.textMuted, fontWeight: '700', lineHeight: 17 },

  // Street picker dropdown
  streetPickerDrop: {
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.border,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    shadowColor: '#101828', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 6,
  },
  streetPickerSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.sm, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  streetPickerInput:   { flex: 1, fontSize: font.sm, color: colors.text, paddingVertical: 4 },
  streetPickerItem:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 8 },
  streetPickerItemActive: { backgroundColor: '#f5f3ff' },
  streetPickerItemText:{ fontSize: font.sm, color: colors.text, flex: 1 },
  streetPickerCount:   { fontSize: 11, color: colors.textMuted },

  // Street detail
  backBtn:     { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  backBtnText: { fontSize: font.base, color: colors.primary, fontWeight: '700' },
  streetDetailTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: 2 },
  streetDetailSub:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },

  // Picker inline
  pickerBtn: {
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerBtnOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: colors.primary, borderBottomColor: 'transparent' },
  pickerBtnText: { fontSize: font.sm, color: colors.text, flex: 1 },

  inlineDrop: {
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.border,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    maxHeight: 200, overflow: 'hidden',
    shadowColor: '#101828', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 6,
  },
  inlineDropItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  inlineDropItemActive: { backgroundColor: '#f5f3ff' },
  inlineDropText:       { fontSize: font.sm, color: colors.text, flex: 1, marginRight: 6 },
  inlineDropTextActive: { color: colors.primary, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
  },
  sheetContent: { padding: spacing.lg, paddingBottom: spacing.md },
  formSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, maxHeight: '82%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sheetTitle:  { fontSize: font.lg, fontWeight: '700', color: colors.text },
  closeX:      { fontSize: 18, color: colors.textMuted },

  formLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  formInput: {
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.inputBg, paddingHorizontal: 12, fontSize: font.sm, color: colors.text,
  },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

  btnOutline: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  btnPrimarySmall: {
    flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },

  removeTenantBtn: { width: 34, height: 46, alignItems: 'center', justifyContent: 'center' },

  // Confirm
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: spacing.lg },
  confirmCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...SHADOW },
  confirmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  trashWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239,68,68,0.10)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.sm },
  confirmQ:  { fontSize: font.md, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 6 },
  confirmSub:{ fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },

  toast: { position: 'absolute', bottom: 30, left: spacing.lg, right: spacing.lg, backgroundColor: colors.success, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  toastError: { backgroundColor: colors.danger },
  toastText:  { color: '#fff', fontSize: font.sm, fontWeight: '600' },
});
}