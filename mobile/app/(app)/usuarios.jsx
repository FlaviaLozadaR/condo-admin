import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useCondo } from '../../src/context/CondoContext';
import { spacing, radius, font } from '../../src/theme';
import TopBar from '../../src/components/TopBar';
import AppDrawer from '../../src/components/Drawer';
import * as api from '../../src/api';

// ── Constants ────────────────────────────────────────────────────────────────
const ROLES = ['Super Admin', 'Administrador', 'Propietario', 'Inquilino', 'Seguridad'];
const TIPOS = ['Condominio', 'Edificio', 'Torre', 'Conjunto'];
const PAGE_SIZE = 15;

const ROLE_COLOR = {
  'Super Admin':   '#4f46e5',
  'Administrador': '#3b82f6',
  'Propietario':   '#00c853',
  'Inquilino':     '#ff9800',
  'Seguridad':     '#9ca3af',
};
const ROLE_BG = {
  'Super Admin':   '#ede9fe',
  'Administrador': '#dbeafe',
  'Propietario':   '#dcfce7',
  'Inquilino':     '#fff7ed',
  'Seguridad':     '#f3f4f6',
};


function genPass() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join('') + '!';
}
function getInitials(name = '') {
  return name.trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase();
}
// ── Small icon SVGs ───────────────────────────────────────────────────────────
function PencilIcon({ color = '#667085' }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
function RefreshIcon({ color = '#6366f1' }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Svg>
  );
}

// ── Reusable primitives ───────────────────────────────────────────────────────
function FormLabel({ children }) {
  const { colors } = useTheme();
  return <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>{children}</Text>;
}
function FormInput({ style, ...props }) {
  const { colors } = useTheme();
  const base = { height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 12, fontSize: font.sm, color: colors.text };
  return <TextInput style={[base, style]} placeholderTextColor={colors.textMuted} {...props} />;
}
function Picker({ value, options, onSelect, placeholder }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const ps = {
    btn:      { height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    btnOpen:  { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: 'transparent' },
    btnText:  { fontSize: font.sm, color: colors.text, flex: 1 },
    dropdown: { borderWidth: 1, borderTopWidth: 0, borderColor: colors.border, backgroundColor: colors.surface, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden' },
    item:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    itemSel:  { backgroundColor: colors.primarySoft },
    itemText: { fontSize: font.sm, color: colors.text },
    itemTextSel: { color: colors.primary, fontWeight: '700' },
  };
  return (
    <View style={{ zIndex: open ? 99 : 1 }}>
      <TouchableOpacity style={[ps.btn, open && ps.btnOpen]} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Text style={[ps.btnText, !value && { color: colors.textMuted }]}>
          {value || placeholder || '— Seleccionar —'}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, transform: [{ rotate: open ? '180deg' : '0deg' }] }}>⌄</Text>
      </TouchableOpacity>
      {open && (
        <View style={ps.dropdown}>
          {options.map(opt => (
            <TouchableOpacity key={opt} style={[ps.item, value === opt && ps.itemSel]} onPress={() => { onSelect(opt); setOpen(false); }}>
              <Text style={[ps.itemText, value === opt && ps.itemTextSel]}>{opt}</Text>
              {value === opt && <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function DetailRow({ label, value, last }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection:'row', paddingVertical:10, borderBottomWidth: last ? 0 : 1, borderBottomColor:colors.border }}>
      <Text style={{ flex:1, fontSize:font.sm, color:colors.textMuted, fontWeight:'600' }}>{label}</Text>
      <Text style={{ flex:2, fontSize:font.sm, color:colors.text, textAlign:'right' }} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

function Toast({ toast, styles }) {
  if (!toast) return null;
  return (
    <View style={[styles.toast, toast.type === 'error' && styles.toastError]}>
      <Text style={styles.toastText}>{toast.msg}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function UsuariosScreen() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { reloadCondo } = useCondo();
  const showAdmin = isSuperAdmin || isAdmin;
  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador' : 'Residente';

  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [condos,       setCondos]       = useState([]);
  const [propiedades,  setPropiedades]  = useState([]);
  const [pageData,     setPageData]     = useState({ data: [], total: 0, totalPages: 1 });
  const [loading,      setLoading]      = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const silentRef = useRef(false);
  const [saving,       setSaving]       = useState(false);
  const [page,         setPage]         = useState(1);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [debouncedQ,   setDebouncedQ]   = useState('');
  const [condoFilter,     setCondoFilter]     = useState(0); // 0 = todos
  const [roleFilter,      setRoleFilter]      = useState('');
  const [condoDropOpen,   setCondoDropOpen]   = useState(false);
  const [roleDropOpen,    setRoleDropOpen]    = useState(false);
  const [toast, setToast] = useState(null);

  // Modals
  const [editCondoModal,   setEditCondoModal]   = useState(null);
  const [deleteCondoModal, setDeleteCondoModal] = useState(null);
  const [createUserModal,  setCreateUserModal]  = useState(false);
  const [editUserModal,    setEditUserModal]     = useState(null);
  const [deleteUserModal,  setDeleteUserModal]  = useState(null);
  const [detailUser,       setDetailUser]       = useState(null);

  // Forms
  const [userForm,  setUserForm]  = useState({ nombre: '', apellido: '', email: '', telefono: '', condoId: '', role: 'Propietario', password: genPass() });
  const [editForm,  setEditForm]  = useState({});
  const [newPass,   setNewPass]   = useState('');

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => { setPage(1); }, [debouncedQ, condoFilter, roleFilter]);

  const refreshUsers = useCallback((silent = false) => {
    silentRef.current = silent;
    setRefreshKey(k => k + 1);
  }, []);

  // Load base data (condos + propiedades only — users load separately via refreshKey)
  const loadBase = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [c, props] = await Promise.all([
        api.getCondominios(), api.getPropiedades(),
      ]);
      setCondos(Array.isArray(c) ? c : (c.condominios ?? []));
      setPropiedades(Array.isArray(props) ? props : (props.propiedades ?? []));
    } catch (e) { showToast(e.message, 'error'); }
    finally { if (showSpinner) setLoading(false); }
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);


  // Load paginated users — refreshKey is the only manual trigger after CRUD
  useEffect(() => {
    const condoParam = isSuperAdmin
      ? (condoFilter === 0 ? undefined : condos.find(c => c.id === condoFilter)?.name)
      : user?.condo;
    const silent = silentRef.current;
    silentRef.current = false;
    let cancelled = false;
    if (!silent) setUsersLoading(true);
    api.getUsuariosPaged({ page, limit: PAGE_SIZE, q: debouncedQ || undefined, condo: condoParam, role: roleFilter || undefined })
      .then(data => { if (!cancelled) setPageData(data); })
      .catch(e => { if (!cancelled) showToast(e.message, 'error'); })
      .finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, [page, debouncedQ, condoFilter, roleFilter, refreshKey]);

  const visibleCondos = condoFilter === 0
    ? condos
    : condos.filter(c => c.id === condoFilter);

  // ── CONDO CRUD ──────────────────────────────────────────────────────────────
  async function handleEditCondo() {
    if (!editCondoModal?.nombre?.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSaving(true);
    try {
      await api.updateCondo(editCondoModal.id, { type: editCondoModal.tipo, name: editCondoModal.nombre.trim(), address: editCondoModal.direccion?.trim() });
      setEditCondoModal(null);
      showToast('Condominio actualizado');
      reloadCondo();
      loadBase(false);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteCondo() {
    if (!deleteCondoModal) return;
    setSaving(true);
    try {
      await api.deleteCondo(deleteCondoModal.id);
      setDeleteCondoModal(null);
      showToast('Condominio eliminado');
      loadBase(false);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  // ── USER CRUD ───────────────────────────────────────────────────────────────
  async function handleCreateUser() {
    if (!userForm.nombre.trim() || !userForm.email.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y correo son obligatorios.'); return;
    }
    setSaving(true);
    try {
      const res = await api.createUsuario({
        name: `${userForm.nombre.trim()} ${userForm.apellido.trim()}`.trim(),
        email: userForm.email.trim(),
        phone: userForm.telefono.trim(),
        role: userForm.role,
        condo: condos[0]?.name || undefined,
        password: userForm.password,
      });
      setCreateUserModal(false);
      setUserForm({ nombre: '', apellido: '', email: '', telefono: '', condoId: '', role: 'Propietario', password: genPass() });
      refreshUsers(true);
      if (res.emailSent) {
        showToast('Usuario registrado y correo enviado');
      } else {
        Alert.alert(
          'Usuario registrado',
          `El usuario fue creado pero el email no se pudo enviar.\n\nError: ${res.emailError || 'desconocido'}\n\nContraseña temporal: ${res.tempPassword}`,
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo registrar el usuario.');
    }
    finally { setSaving(false); }
  }

  async function handleEditUser() {
    setSaving(true);
    try {
      await api.updateUsuario(editForm.id, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
      });
      if (newPass.trim().length >= 8) {
        await api.changePassword(editForm.id, { newPassword: newPass.trim() });
      }
      setEditUserModal(null);
      setNewPass('');
      showToast('Usuario actualizado');
      refreshUsers(true);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteUser() {
    if (!deleteUserModal) return;
    const deletedId = deleteUserModal.id;
    setSaving(true);
    try {
      await api.deleteUsuario(String(deletedId));
      // Remove instantly from the visible list
      setPageData(prev => ({
        ...prev,
        data:  prev.data.filter(u => u.id !== deletedId),
        total: Math.max(0, (prev.total || 0) - 1),
      }));
      setDeleteUserModal(null);
      showToast('Usuario eliminado.');
      refreshUsers(true); // silent — no loading spinner
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Usuarios" onMenuPress={() => setDrawerOpen(true)} roleLabel={roleLabel} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Usuarios" onMenuPress={() => setDrawerOpen(true)} roleLabel={roleLabel} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Page header */}
        <Text style={styles.pageTitle}>Gestión de Usuarios</Text>
        <Text style={styles.pageSub}>
          {isSuperAdmin
            ? 'Crea administradores y asígnalos a sus condominios. Ellos luego registrarán a sus residentes.'
            : `Administra los usuarios de ${user?.condo}.`}
        </Text>

        {/* ── SUPER ADMIN SECTION ── */}
        {isSuperAdmin && (
          <>
            {/* Condo label — static */}
            {condos.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={styles.selectorLabel}>CONDOMINIO</Text>
                <Text style={{ fontSize: font.base, fontWeight: '600', color: colors.text }}>
                  {condos[0].type}: {condos[0].name}
                </Text>
              </View>
            )}

            {/* Condo cards */}
            {visibleCondos.map(condo => {
              const unidades = propiedades.filter(p => p.condo === condo.name).length;
              return (
                <View key={condo.id} style={styles.condoCard}>
                  <View style={styles.condoCardHead}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.condoTypePill}>
                        <Text style={styles.condoTypeText}>{condo.type?.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.condoCardName}>{condo.name}</Text>
                      {!!condo.address && <Text style={styles.condoAddress}>{condo.address}</Text>}
                    </View>
                    <TouchableOpacity
                      style={styles.editCondoBtn}
                      onPress={() => setEditCondoModal({ id: condo.id, tipo: condo.type, nombre: condo.name, direccion: condo.address ?? '' })}
                    >
                      <PencilIcon color={colors.primary} />
                      <Text style={styles.editCondoBtnText}>Editar nombre</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.condoStats}>
                    <View style={styles.condoStat}>
                      <Text style={styles.condoStatVal}>{unidades}</Text>
                      <Text style={styles.condoStatLabel}>Unidades</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={() => { setUserForm({ nombre: '', apellido: '', email: '', telefono: '', condoId: '', role: 'Propietario', password: genPass() }); setCreateUserModal(true); }}
                activeOpacity={0.8}
              >
                <Text style={styles.btnPrimaryText}>Registrar Usuario</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Search */}
        <View style={styles.searchWrap}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10 }}>
            <Path d="M10 16C13.3 16 16 13.3 16 10C16 6.7 13.3 4 10 4C6.7 4 4 6.7 4 10C4 13.3 6.7 16 10 16ZM18 18L14.3 14.3" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o email..."
            placeholderTextColor={colors.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Role filter — inline dropdown */}
        <Text style={styles.selectorLabel}>FILTRAR POR ROL</Text>
        <View style={{ zIndex: roleDropOpen ? 99 : 1, marginBottom: spacing.md }}>
          <TouchableOpacity
            style={[styles.picker, { marginBottom: 0 }]}
            onPress={() => { setRoleDropOpen(o => !o); setCondoDropOpen(false); }}
            activeOpacity={0.85}
          >
            <Text style={styles.pickerText}>{roleFilter || '— Todos —'}</Text>
            <Text style={styles.pickerArrow}>{roleDropOpen ? '∧' : '⌄'}</Text>
          </TouchableOpacity>
          {roleDropOpen && (
            <View style={[styles.inlineDropdown, { position: 'absolute', top: 46, left: 0, right: 0 }]}>
              {['', ...ROLES].map(r => (
                <TouchableOpacity
                  key={r || 'todos'}
                  style={[styles.inlineDropdownItem, roleFilter === r && styles.inlineDropdownItemActive]}
                  onPress={() => { setRoleFilter(r); setRoleDropOpen(false); }}
                >
                  <Text style={[styles.inlineDropdownText, roleFilter === r && styles.inlineDropdownTextActive]}>
                    {r || '— Todos —'}
                  </Text>
                  {roleFilter === r && <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Users table */}
        <View style={styles.card}>
          {/* Table header */}
          <View style={styles.tableHead}>
            <Text style={[styles.tableHCell, { flex: 2 }]}>Nombre</Text>
            <Text style={[styles.tableHCell, { flex: 1, textAlign: 'center' }]}>Rol</Text>
            <Text style={[styles.tableHCell, { flex: 1, textAlign: 'right' }]}>Acciones</Text>
          </View>

          {usersLoading ? (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : pageData.data.length === 0 ? (
            <Text style={styles.emptyRow}>No se encontraron usuarios.</Text>
          ) : pageData.data.map(usuario => {
            const roleColor = ROLE_COLOR[usuario.role] ?? '#6b7280';
            const roleBg    = ROLE_BG[usuario.role]    ?? '#f3f4f6';
            const initials  = getInitials(usuario.name);
            const canEdit   = usuario.role !== 'Super Admin' || isSuperAdmin;
            return (
              <View key={usuario.id} style={styles.tableRow}>
                {/* Avatar + name → toca para ver detalle */}
                <TouchableOpacity
                  style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                  onPress={() => setDetailUser(usuario)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { backgroundColor: roleColor }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <Text style={[styles.userName, { color: colors.primary }]} numberOfLines={1}>{usuario.name}</Text>
                </TouchableOpacity>
                {/* Role badge */}
                <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                  <View style={[styles.roleBadge, { borderColor: roleColor, backgroundColor: roleBg }]}>
                    <Text style={[styles.roleBadgeText, { color: roleColor }]} numberOfLines={1}>
                      {(usuario.role ?? '').length > 5 ? usuario.role.substring(0, 4) + '...' : usuario.role}
                    </Text>
                  </View>
                </View>
                {/* Actions */}
                <View style={[styles.tableCell, { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                  {canEdit && <>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => { setEditForm({ ...usuario }); setNewPass(''); setEditUserModal(true); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <PencilIcon color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      onPress={() => setDeleteUserModal(usuario)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <TrashIcon color={colors.danger} />
                    </TouchableOpacity>
                  </>}
                </View>
              </View>
            );
          })}

          {/* Pagination */}
          {pageData.totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                onPress={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <Text style={styles.pageBtnText}>Anterior</Text>
              </TouchableOpacity>
              <Text style={styles.pageInfo}>{page} / {pageData.totalPages}</Text>
              <TouchableOpacity
                style={[styles.pageBtn, page === pageData.totalPages && styles.pageBtnDisabled]}
                onPress={() => setPage(p => Math.min(pageData.totalPages, p + 1))}
                disabled={page === pageData.totalPages}
              >
                <Text style={styles.pageBtnText}>Siguiente</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── MODALS ── */}

      {/* Edit Condo modal */}
      <Modal visible={!!editCondoModal} transparent animationType="none" onRequestClose={() => setEditCondoModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditCondoModal(null)}>
            <Pressable style={styles.formSheet}>
              <View style={styles.formSheetHeader}>
                <Text style={styles.formSheetTitle}>Editar Condominio</Text>
                <TouchableOpacity onPress={() => setEditCondoModal(null)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
              </View>
              <FormLabel>NOMBRE <Text style={{ color: colors.danger }}>*</Text></FormLabel>
              <FormInput value={editCondoModal?.nombre ?? ''} onChangeText={v => setEditCondoModal(f => ({ ...f, nombre: v }))} />
              <View style={{ height: spacing.md }} />
              <FormLabel>UBICACIÓN</FormLabel>
              <FormInput value={editCondoModal?.direccion ?? ''} onChangeText={v => setEditCondoModal(f => ({ ...f, direccion: v }))} />
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => setEditCondoModal(null)}><Text style={styles.btnOutlineText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleEditCondo} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Guardar cambios</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Condo confirm */}
      <Modal visible={!!deleteCondoModal} transparent animationType="fade" onRequestClose={() => setDeleteCondoModal(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <Text style={styles.formSheetTitle}>Eliminar condominio</Text>
              <TouchableOpacity onPress={() => setDeleteCondoModal(null)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.trashIconWrap}>
              <TrashIcon color={colors.danger} />
            </View>
            <Text style={styles.confirmQuestion}>¿Eliminar "{deleteCondoModal?.name}"?</Text>
            <Text style={styles.confirmSub}>Esta acción no se puede deshacer.</Text>
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setDeleteCondoModal(null)}><Text style={styles.btnOutlineText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: colors.danger }]} onPress={handleDeleteCondo} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Sí, eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create User modal */}
      <Modal visible={createUserModal} transparent animationType="none" onRequestClose={() => setCreateUserModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCreateUserModal(false)}>
            <Pressable style={styles.formSheet}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.formSheetHeader}>
                  <Text style={styles.formSheetTitle}>Registrar Usuario</Text>
                  <TouchableOpacity onPress={() => setCreateUserModal(false)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
                </View>
                <Text style={styles.formNote}>El usuario recibirá un correo con sus credenciales al registrarse.</Text>

                <FormLabel>NOMBRE <Text style={{ color: colors.danger }}>*</Text></FormLabel>
                <FormInput placeholder="Ej: Juan" value={userForm.nombre} onChangeText={v => setUserForm(f => ({ ...f, nombre: v }))} />
                <View style={{ height: spacing.sm }} />

                <FormLabel>APELLIDO</FormLabel>
                <FormInput placeholder="Ej: Pérez" value={userForm.apellido} onChangeText={v => setUserForm(f => ({ ...f, apellido: v }))} />
                <View style={{ height: spacing.sm }} />

                <FormLabel>CORREO ELECTRÓNICO <Text style={{ color: colors.danger }}>*</Text></FormLabel>
                <FormInput placeholder="usuario@ejemplo.com" value={userForm.email} onChangeText={v => setUserForm(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
                <View style={{ height: spacing.sm }} />

                <FormLabel>TELÉFONO</FormLabel>
                <View style={styles.phoneRow}>
                  <View style={styles.phonePrefix}><Text style={styles.phonePrefixText}>+591</Text></View>
                  <FormInput style={[styles.formInput, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]} placeholder="Ej: 69444833" value={userForm.telefono} onChangeText={v => setUserForm(f => ({ ...f, telefono: v }))} keyboardType="phone-pad" />
                </View>
                <View style={{ height: spacing.sm }} />

                <FormLabel>ROL <Text style={{ color: colors.danger }}>*</Text></FormLabel>
                <Picker
                  value={userForm.role}
                  options={isSuperAdmin
                    ? ['Administrador', 'Propietario', 'Inquilino', 'Seguridad']
                    : ['Propietario', 'Inquilino', 'Seguridad']}
                  onSelect={v => setUserForm(f => ({ ...f, role: v }))}
                  placeholder="— Seleccioná un rol —"
                />
                <View style={{ height: spacing.sm }} />

                <FormLabel>CONTRASEÑA TEMPORAL</FormLabel>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6, marginTop: -2 }}>
                  El usuario puede cambiarla desde Mi Perfil.
                </Text>
                <View style={styles.passRow}>
                  <FormInput style={[styles.formInput, { flex: 1 }]} value={userForm.password} onChangeText={v => setUserForm(f => ({ ...f, password: v }))} autoCapitalize="none" />
                  <TouchableOpacity style={styles.refreshBtn} onPress={() => setUserForm(f => ({ ...f, password: genPass() }))}>
                    <RefreshIcon />
                  </TouchableOpacity>
                </View>

                <View style={[styles.formActions, { marginTop: spacing.lg }]}>
                  <TouchableOpacity style={styles.btnOutline} onPress={() => setCreateUserModal(false)}><Text style={styles.btnOutlineText}>Cancelar</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateUser} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Registrar y enviar email</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit User modal */}
      <Modal visible={!!editUserModal} transparent animationType="none" onRequestClose={() => setEditUserModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditUserModal(null)}>
            <Pressable style={styles.formSheet}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.formSheetHeader}>
                  <Text style={styles.formSheetTitle}>Editar Usuario</Text>
                  <TouchableOpacity onPress={() => setEditUserModal(null)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
                </View>

                <FormLabel>NOMBRE</FormLabel>
                <FormInput value={editForm.name ?? ''} onChangeText={v => setEditForm(f => ({ ...f, name: v }))} />
                <View style={{ height: spacing.sm }} />

                <FormLabel>EMAIL</FormLabel>
                <FormInput value={editForm.email ?? ''} onChangeText={v => setEditForm(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" />
                <View style={{ height: spacing.sm }} />

                <FormLabel>TELÉFONO</FormLabel>
                <View style={styles.phoneRow}>
                  <View style={styles.phonePrefix}><Text style={styles.phonePrefixText}>+591</Text></View>
                  <FormInput style={[styles.formInput, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }]} value={editForm.phone ?? ''} onChangeText={v => setEditForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />
                </View>
                <View style={{ height: spacing.sm }} />

                <FormLabel>ROL</FormLabel>
                <Picker
                  value={editForm.role}
                  options={isSuperAdmin ? ROLES : ['Propietario', 'Inquilino', 'Seguridad']}
                  onSelect={v => setEditForm(f => ({ ...f, role: v }))}
                />
                <View style={{ height: spacing.md }} />

                <FormLabel>RESTABLECER CONTRASEÑA</FormLabel>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6, marginTop: -2 }}>
                  Se cambia sin necesitar la contraseña actual.
                </Text>
                <View style={styles.passRow}>
                  <FormInput
                    style={[styles.formInput, { flex: 1 }]}
                    placeholder="Nueva contraseña (mín. 8 caracteres)"
                    value={newPass}
                    onChangeText={setNewPass}
                    autoCapitalize="none"
                    secureTextEntry
                  />
                  <TouchableOpacity style={styles.refreshBtn} onPress={() => setNewPass(genPass())}>
                    <RefreshIcon />
                  </TouchableOpacity>
                </View>
                {newPass.length > 0 && newPass.length < 8 && (
                  <Text style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>Mínimo 8 caracteres</Text>
                )}

                <View style={[styles.formActions, { marginTop: spacing.lg }]}>
                  <TouchableOpacity style={styles.btnOutline} onPress={() => setEditUserModal(null)}><Text style={styles.btnOutlineText}>Cancelar</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnPrimary} onPress={handleEditUser} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete User confirm */}
      <Modal visible={!!deleteUserModal} transparent animationType="fade" onRequestClose={() => setDeleteUserModal(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <Text style={styles.formSheetTitle}>Eliminar usuario</Text>
              <TouchableOpacity onPress={() => setDeleteUserModal(null)}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.trashIconWrap}>
              <TrashIcon color={colors.danger} />
            </View>
            <Text style={styles.confirmQuestion}>¿Eliminar a "{deleteUserModal?.name}"?</Text>
            <Text style={styles.confirmSub}>Esta acción no se puede deshacer.</Text>
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setDeleteUserModal(null)}><Text style={styles.btnOutlineText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: colors.danger }]} onPress={handleDeleteUser} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Sí, eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* User detail bottom sheet */}
      <Modal visible={!!detailUser} transparent animationType="slide" onRequestClose={() => setDetailUser(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailUser(null)}>
          <Pressable style={styles.detailSheet}>
            <View style={styles.sheetHandle} />

            {/* Avatar + nombre + badge */}
            <View style={styles.detailHeader}>
              <View style={[styles.detailAvatar, { backgroundColor: ROLE_COLOR[detailUser?.role] ?? '#6b7280' }]}>
                <Text style={styles.detailAvatarText}>{getInitials(detailUser?.name)}</Text>
              </View>
              <Text style={styles.detailName}>{detailUser?.name}</Text>
              <View style={[styles.roleBadge, { borderColor: ROLE_COLOR[detailUser?.role], backgroundColor: ROLE_BG[detailUser?.role], alignSelf: 'center', marginTop: 6, paddingHorizontal: 10, paddingVertical: 4 }]}>
                <Text style={[styles.roleBadgeText, { color: ROLE_COLOR[detailUser?.role], fontSize: font.xs }]}>{detailUser?.role}</Text>
              </View>
            </View>

            {/* Info */}
            <View style={styles.detailRows}>
              <DetailRow label="Correo" value={detailUser?.email} />
              <DetailRow label="Teléfono" value={detailUser?.phone ? `+591 ${detailUser.phone}` : null} />
              <DetailRow label="Condominio" value={detailUser?.condo} />
              <DetailRow label="Propiedad" value={detailUser?.property} last />
            </View>

            {/* Acciones */}
            {(detailUser?.role !== 'Super Admin' || isSuperAdmin) && (
              <View style={styles.detailActions}>
                <TouchableOpacity
                  style={styles.btnOutline}
                  onPress={() => { setDetailUser(null); setTimeout(() => { setEditForm({ ...detailUser }); setNewPass(''); setEditUserModal(true); }, 300); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnOutlineText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: colors.danger }]}
                  onPress={() => { setDetailUser(null); setTimeout(() => setDeleteUserModal(detailUser), 300); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnPrimaryText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={[styles.btnOutline, { marginTop: spacing.xs }]} onPress={() => setDetailUser(null)} activeOpacity={0.8}>
              <Text style={styles.btnOutlineText}>Cerrar</Text>
            </TouchableOpacity>
          </Pressable>
        </TouchableOpacity>
      </Modal>

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Toast toast={toast} styles={styles} />
    </SafeAreaView>
  );
}

const CARD_SHADOW = {
  shadowColor: '#101828', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
};

function makeStyles(colors) {
  return StyleSheet.create({
  content:   { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  pageTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 4 },
  pageSub:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },

  selectorLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, ...CARD_SHADOW,
  },
  pickerText:  { fontSize: font.base, color: colors.text, fontWeight: '500', flex: 1 },
  pickerArrow: { fontSize: 16, color: colors.textMuted },

  condoCard: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, ...CARD_SHADOW,
  },
  condoCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  condoTypePill: { backgroundColor: colors.chipBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  condoTypeText: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  condoCardName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  condoAddress:  { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  condoCardBtns: { flexDirection: 'row', gap: 6 },
  editCondoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.chipBg, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  editCondoBtnText: { fontSize: font.xs, fontWeight: '600', color: colors.primary },
  condoActionBtn: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  condoActionDanger: { borderColor: '#fee2e2' },
  condoStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  condoStat:  { flex: 1, minWidth: '45%', backgroundColor: colors.metricBg, borderRadius: radius.sm, padding: spacing.sm },
  condoStatVal:   { fontSize: font.md, fontWeight: '800', color: colors.text },
  condoStatLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  btnOutline: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  btnPrimary: {
    flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnPrimaryText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, ...CARD_SHADOW,
  },
  searchInput: { flex: 1, height: 44, paddingHorizontal: spacing.sm, fontSize: font.sm, color: colors.text },

  card: {
    backgroundColor: colors.cardBg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', ...CARD_SHADOW,
  },
  tableHead: {
    flexDirection: 'row', backgroundColor: colors.disabledBg,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tableHCell: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tableCell:    { flexDirection: 'row', alignItems: 'center' },
  avatar:       { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 11, fontWeight: '700', color: '#fff' },
  userName:     { fontSize: font.sm, color: colors.text, fontWeight: '500', flex: 1 },
  roleBadge:    { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  roleBadgeText:{ fontSize: 10, fontWeight: '600' },
  actionBtn:    { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  actionBtnDanger: { borderColor: '#fee2e2', backgroundColor: '#fff5f5' },
  emptyRow:     { padding: spacing.lg, textAlign: 'center', color: colors.textMuted, fontSize: font.sm },
  pagination:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  pageBtn:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText:  { fontSize: font.sm, color: colors.text, fontWeight: '600' },
  pageInfo:     { fontSize: font.sm, color: colors.textMuted },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '75%',
  },
  modalTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  sheetItem:  { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between' },
  sheetItemActive: { backgroundColor: '#f5f3ff' },
  sheetItemText:   { fontSize: font.base, color: colors.text },
  sheetItemTextActive: { color: colors.primary, fontWeight: '700' },

  formSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '90%',
  },
  formSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  formSheetTitle:  { fontSize: font.lg, fontWeight: '700', color: colors.text },
  closeX:          { fontSize: 18, color: colors.textMuted },
  formNote:        { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  formLabel:       { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  formInput: {
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#f9fafb', paddingHorizontal: 12, fontSize: font.sm, color: colors.text,
  },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  phoneRow:    { flexDirection: 'row' },
  phonePrefix: {
    height: 46, paddingHorizontal: 10, backgroundColor: '#f3f4f6',
    borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  phonePrefixText: { fontSize: font.sm, color: colors.text2, fontWeight: '600' },
  passRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshBtn:{ width: 40, height: 46, alignItems: 'center', justifyContent: 'center' },

  pickerBtn: {
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#f9fafb', paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerBtnText: { fontSize: font.sm, color: colors.text, flex: 1 },

  inlineDropdown: {
    borderWidth: 1, borderTopWidth: 0, borderColor: colors.border,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    overflow: 'hidden',
    shadowColor: '#101828', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 6,
  },
  inlineDropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  inlineDropdownItemActive: { backgroundColor: '#f5f3ff' },
  inlineDropdownText:       { fontSize: font.sm, color: colors.text },
  inlineDropdownTextActive: { color: colors.primary, fontWeight: '700' },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: spacing.lg },
  confirmCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.lg, ...CARD_SHADOW,
  },
  confirmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  trashIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(239,68,68,0.10)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: spacing.sm,
  },
  confirmQuestion: { fontSize: font.md, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 6 },
  confirmSub:      { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },

  // User detail bottom sheet
  detailSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: spacing.lg,
    paddingTop: spacing.sm, maxHeight: '85%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md,
  },
  detailHeader: { alignItems: 'center', marginBottom: spacing.md },
  detailAvatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  detailAvatarText: { fontSize: font.xl, fontWeight: '800', color: '#fff' },
  detailName:   { fontSize: font.lg, fontWeight: '700', color: colors.text, textAlign: 'center' },
  detailRows:   { backgroundColor: colors.bg, borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  detailRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailRowLabel: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 },
  detailRowValue: { fontSize: font.sm, color: colors.text, fontWeight: '500', flex: 2, textAlign: 'right' },
  detailActions:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },

  toast: {
    position: 'absolute', bottom: 30, left: spacing.lg, right: spacing.lg,
    backgroundColor: colors.success, borderRadius: radius.md,
    padding: 14, alignItems: 'center',
  },
  toastError: { backgroundColor: colors.danger },
  toastText:  { color: '#fff', fontSize: font.sm, fontWeight: '600' },
});
}