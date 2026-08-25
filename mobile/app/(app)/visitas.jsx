import { useMemo, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Share, Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ChevronDownIcon } from '../../src/components/Icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useCondo } from '../../src/context/CondoContext';
import { spacing, radius, font } from '../../src/theme';
import TopBar from '../../src/components/TopBar';
import AppDrawer from '../../src/components/Drawer';
import * as api from '../../src/api';

const PAGE_SIZE = 20;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const DOC_TYPES = [
  { type: 'front', label: 'Carnet (frente)', flag: 'hasIdDocumentFront' },
  { type: 'back',  label: 'Carnet (dorso)',  flag: 'hasIdDocumentBack' },
  { type: 'plate', label: 'Foto de placa',   flag: 'hasPlatePhoto', vehicularOnly: true },
];

function parseFecha(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (y > 1000) return new Date(y, m - 1, d);
    return new Date(d, m - 1, y);
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function ClockIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round">
      <Path d="M12 8V12L15 14M3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3" />
    </Svg>
  );
}
function WalkIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5C13.1 5 14 4.1 14 3C14 1.9 13.1 1 12 1C10.9 1 10 1.9 10 3C10 4.1 10.9 5 12 5ZM8 22V14H6V8C6 6.9 6.9 6 8 6H16C17.1 6 18 6.9 18 8V14H16V22H14V15H10V22H8Z" />
    </Svg>
  );
}
function CarIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 17H5M19 17H21M6 17H18M7 17L9 10H15L17 17M8 21H16" />
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
function TrashIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6" />
    </Svg>
  );
}
function ExcelIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 6h16v14H4z" />
      <Path d="M4 10h16M4 14h16M9 6v14M14 6v14" />
    </Svg>
  );
}
function PdfIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M8 13h8M8 17h5" />
    </Svg>
  );
}

// ── Visit detail row ──────────────────────────────────────────────────────────
function VisitaRow({ label, value, last }) {
  return (
    <View style={[styles.visitaRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.visitaRowLabel}>{label}</Text>
      <Text style={styles.visitaRowValue} numberOfLines={3}>{value || '—'}</Text>
    </View>
  );
}

// ── Inline picker (single select) ─────────────────────────────────────────────
function InlinePicker({ value, options, onSelect, placeholder }) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState(false);
  const label = options.find(o => o.value === value)?.label || placeholder || '— Seleccionar —';
  return (
    <View style={{ zIndex: open ? 99 : 1 }}>
      <TouchableOpacity
        style={[styles.pickerBtn, { backgroundColor: c.inputBg }, open && styles.pickerBtnOpen]}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <Text style={[styles.pickerBtnText, { color: c.text }]} numberOfLines={1}>{label}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDownIcon size={16} color={open ? c.primary : c.textMuted} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={[styles.inlineDrop, { backgroundColor: c.surface }]}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.inlineDropItem, value === opt.value && styles.inlineDropItemActive]}
              onPress={() => { onSelect(opt.value); setOpen(false); }}
            >
              <Text style={[styles.inlineDropText, { color: value === opt.value ? c.primary : c.text }, value === opt.value && styles.inlineDropTextActive]} numberOfLines={1}>
                {opt.label}
              </Text>
              {value === opt.value && <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Multi-select month picker (grouped by year) ───────────────────────────────
function MonthPicker({ allMonths, selected, onToggle, onToggleYear, onToggleAll }) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState(new Set());

  const byYear = (() => {
    const map = new Map();
    allMonths.forEach(m => {
      if (!map.has(m.year)) map.set(m.year, []);
      map.get(m.year).push(m);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => ({ year, months }));
  })();

  const handleToggleOpen = () => {
    if (!open && byYear.length > 0) setExpandedYears(new Set([byYear[0].year]));
    setOpen(o => !o);
  };

  const toggleExpandYear = year => setExpandedYears(prev => {
    const n = new Set(prev); n.has(year) ? n.delete(year) : n.add(year); return n;
  });

  const allSelected = allMonths.length > 0 && selected.size === allMonths.length;
  const label = selected.size === 0
    ? 'Todos los meses'
    : `${selected.size} mes${selected.size !== 1 ? 'es' : ''} seleccionado${selected.size !== 1 ? 's' : ''}`;

  return (
    <View style={{ zIndex: open ? 99 : 1 }}>
      <TouchableOpacity
        style={[styles.pickerBtn, { backgroundColor: c.inputBg }, open && styles.pickerBtnOpen]}
        onPress={handleToggleOpen}
        activeOpacity={0.8}
      >
        <Text style={[styles.pickerBtnText, { color: c.text }]} numberOfLines={1}>{label}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDownIcon size={16} color={open ? c.primary : c.textMuted} />
        </View>
      </TouchableOpacity>
      {open && (
        <View style={[styles.inlineDrop, { backgroundColor: c.surface }]}>
          <TouchableOpacity
            style={[styles.inlineDropItem, { borderBottomWidth: 1, borderBottomColor: c.border }]}
            onPress={onToggleAll}
          >
            <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
              {allSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.inlineDropText, { color: c.text }]}>{allSelected ? 'Quitar todos' : 'Seleccionar todos'}</Text>
          </TouchableOpacity>
          {allMonths.length === 0 ? (
            <View style={styles.inlineDropItem}>
              <Text style={[styles.inlineDropText, { color: c.textMuted }]}>Sin visitas registradas todavía.</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {byYear.map(({ year, months }) => {
                const yearKeys = months.map(m => m.key);
                const allYearSel  = yearKeys.every(k => selected.has(k));
                const someYearSel = yearKeys.some(k => selected.has(k));
                const expanded = expandedYears.has(year);
                return (
                  <View key={year}>
                    <View style={[styles.yearHeader, { backgroundColor: c.surface }]}>
                      <TouchableOpacity
                        style={styles.yearCheckRow}
                        onPress={() => onToggleYear(yearKeys, !allYearSel)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.checkbox,
                          allYearSel && styles.checkboxChecked,
                          someYearSel && !allYearSel && styles.checkboxPartial,
                        ]}>
                          {allYearSel
                            ? <Text style={styles.checkmark}>✓</Text>
                            : someYearSel && <Text style={styles.checkmarkPartial}>−</Text>}
                        </View>
                        <Text style={[styles.yearLabel, { color: c.text }]}>{year}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => toggleExpandYear(year)} style={styles.yearExpandBtn} activeOpacity={0.7}>
                        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <ChevronDownIcon size={15} color={c.textMuted} />
        </View>
                      </TouchableOpacity>
                    </View>
                    {expanded && months.map(opt => (
                      <TouchableOpacity key={opt.key} style={[styles.inlineDropItem, styles.monthIndent]} onPress={() => onToggle(opt.key)} activeOpacity={0.7}>
                        <View style={[styles.checkbox, selected.has(opt.key) && styles.checkboxChecked]}>
                          {selected.has(opt.key) && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.inlineDropText, { color: opt.count === 0 ? c.textMuted : c.text }]}>{opt.label}</Text>
                        <Text style={[styles.monthRecordCount, { color: c.textMuted }]}>{opt.count} reg.</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function VisitasScreen() {
  const { user, isSuperAdmin, isAdmin, isSeguridad, isOwner, isTenant } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { condoName } = useCondo();
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [condos, setCondos]           = useState([]);
  const [allVisitas, setAllVisitas]   = useState([]);
  const [searchTerm, setSearchTerm]   = useState('');
  const [debSearch, setDebSearch]     = useState('');
  const [typeFilter, setTypeFilter]   = useState('todos');
  const [condoFilter, setCondoFilter] = useState('todos');
  const [page, setPage]               = useState(1);
  const [pageData, setPageData]       = useState({ data: [], total: 0, totalPeatonales: 0, totalVehiculares: 0, totalPages: 1 });
  const [loading, setLoading]         = useState(false);
  const [exportMonths, setExportMonths] = useState(new Set());
  const [deletingId, setDeletingId]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [refreshKey, setRefreshKey]   = useState(0);
  const [docsItem, setDocsItem]       = useState(null);
  const [docsBusy, setDocsBusy]       = useState(null);
  const [previewModal, setPreviewModal] = useState(null); // { url, label }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedVisita, setSelectedVisita] = useState(null);
  const [editItem,    setEditItem]    = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState('');

  const canDelete = ['Super Admin', 'Administrador', 'Seguridad'].includes(user?.role);
  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador' : isSeguridad ? 'Seguridad' : isOwner ? 'Propietario' : isTenant ? 'Inquilino' : 'Residente';

  useEffect(() => { api.getCondominios().then(setCondos).catch(() => {}); }, []);
  useEffect(() => {
    if (isSuperAdmin && condos.length > 0 && condoFilter === 'todos') {
      setCondoFilter(String(condos[0].id));
    }
  }, [condos, isSuperAdmin]);
  useEffect(() => {
    api.getHistorialVisitas()
      .then(res => setAllVisitas(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => { setPage(1); }, [debSearch, typeFilter, condoFilter]);

  const selectedCondoName = (() => {
    if (user?.role === 'Administrador' || user?.role === 'Seguridad') return user.condo || '';
    if (condoFilter === 'todos') return '';
    return condos.find(c => String(c.id) === condoFilter)?.name || '';
  })();

  useEffect(() => {
    setLoading(true);
    api.getHistorialVisitasPaged({ page, limit: PAGE_SIZE, tipo: typeFilter, q: debSearch, condo: selectedCondoName })
      .then(res => {
        if (res && Array.isArray(res.data)) setPageData(res);
        else if (Array.isArray(res)) setPageData({ data: res, total: res.length, totalPeatonales: 0, totalVehiculares: 0, totalPages: 1 });
      })
      .catch(err => Alert.alert('Error', err.message || 'No se pudo cargar el historial'))
      .finally(() => setLoading(false));
  }, [page, typeFilter, debSearch, selectedCondoName, refreshKey]);

  // Export month options: all months in range, with record count per month
  const exportMonthOptions = (() => {
    const countByKey = new Map();
    allVisitas.forEach(r => {
      const d = parseFecha(r.fecha);
      if (!d || isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      countByKey.set(key, (countByKey.get(key) || 0) + 1);
    });

    const now = new Date();
    let startYear = now.getFullYear();
    let startMonth = now.getMonth();

    if (countByKey.size > 0) {
      const [ey, em] = Array.from(countByKey.keys()).sort()[0].split('-').map(Number);
      startYear = ey; startMonth = em - 1;
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      startYear = d.getFullYear(); startMonth = d.getMonth();
    }

    const months = [];
    let y = now.getFullYear(), m = now.getMonth();
    while (y > startYear || (y === startYear && m >= startMonth)) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      months.push({ key, year: y, month: m, label: `${MESES[m]} ${y}`, count: countByKey.get(key) || 0 });
      if (m === 0) { y--; m = 11; } else m--;
    }
    return months;
  })();

  const toggleMonth    = key => setExportMonths(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleAllMonths = () => setExportMonths(prev => prev.size === exportMonthOptions.length ? new Set() : new Set(exportMonthOptions.map(o => o.key)));
  const toggleYear     = (yearKeys, add) => setExportMonths(prev => { const n = new Set(prev); yearKeys.forEach(k => add ? n.add(k) : n.delete(k)); return n; });

  const getExportData = () => {
    let records = allVisitas;
    if (exportMonths.size > 0) {
      records = records.filter(r => {
        const d = parseFecha(r.fecha);
        if (!d || isNaN(d)) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return exportMonths.has(key);
      });
    }
    if (typeFilter !== 'todos') records = records.filter(r => r.tipo === typeFilter);
    if (debSearch.trim()) {
      const q = debSearch.toLowerCase();
      records = records.filter(r =>
        (r.visitante || '').toLowerCase().includes(q) ||
        (r.cedula || '').toLowerCase().includes(q) ||
        (r.placa || '').toLowerCase().includes(q) ||
        (r.propiedad || '').toLowerCase().includes(q)
      );
    }
    return records;
  };

  const handleExportExcel = async () => {
    const records = getExportData();
    if (records.length === 0) { Alert.alert('Sin datos', 'No hay registros para el período seleccionado.'); return; }
    const headers = ['Visitante', 'Cedula', 'Propiedad', 'Tipo', 'Placa', 'Fecha', 'Entrada', 'Salida', 'Motivo'];
    const csvRows = [
      headers.join(','),
      ...records.map(r => [
        `"${r.visitante || ''}"`,
        `"${r.cedula || ''}"`,
        `"${r.propiedad || ''}"`,
        `"${r.tipo || ''}"`,
        `"${r.placa || ''}"`,
        `"${r.fecha || ''}"`,
        `"${r.entrada || ''}"`,
        `"${r.salida || ''}"`,
        `"${(r.motivo || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ];
    try {
      await Share.share({ message: csvRows.join('\n'), title: 'Historial de Visitas.csv' });
    } catch (err) {
      if (err.message !== 'User did not share') Alert.alert('Error', 'No se pudo compartir el archivo.');
    }
  };

  const handleExportPdf = async () => {
    const records = getExportData();
    if (records.length === 0) { Alert.alert('Sin datos', 'No hay registros para el período seleccionado.'); return; }
    const period = exportMonths.size > 0
      ? exportMonthOptions.filter(o => exportMonths.has(o.key)).map(o => o.label).join(', ')
      : 'Todos los períodos';
    const header = [
      'HISTORIAL DE VISITAS',
      `Condominio: ${condoName || selectedCondoName || ''}`,
      `Período: ${period}`,
      `Total registros: ${records.length}`,
      '─'.repeat(50),
      '',
    ].join('\n');
    const body = records.map((r, i) => [
      `${i + 1}. ${r.visitante || '—'} (${r.cedula || '—'})`,
      `   Propiedad: ${r.propiedad || '—'} | Tipo: ${r.tipo || '—'}`,
      `   Fecha: ${r.fecha || '—'} | Entrada: ${r.entrada || '—'} | Salida: ${r.salida || '—'}`,
      ...(r.placa ? [`   Placa: ${r.placa}`] : []),
      ...(r.motivo ? [`   Motivo: ${r.motivo}`] : []),
    ].join('\n')).join('\n\n');
    try {
      await Share.share({ message: header + body, title: 'Historial de Visitas.txt' });
    } catch (err) {
      if (err.message !== 'User did not share') Alert.alert('Error', 'No se pudo compartir el informe.');
    }
  };

  const handleViewDoc = async (visitaId, type, label) => {
    setDocsBusy(`${type}-view`);
    try {
      const { url } = await api.getVisitaDocumentUrl(visitaId, type);
      setDocsItem(null);
      setPreviewModal({ url, label });
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo cargar el documento.');
    } finally {
      setDocsBusy(null);
    }
  };

  const handleDownloadDoc = async (visitaId, type, label) => {
    setDocsBusy(`${type}-download`);
    try {
      const { url } = await api.getVisitaDocumentUrl(visitaId, type);
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
      const localUri = FileSystem.cacheDirectory + `doc_${type}_${Date.now()}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(url, localUri);
      await Sharing.shareAsync(uri, {
        mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
        dialogTitle: label,
      });
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo descargar el documento.');
    } finally {
      setDocsBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setDeleteLoading(true);
    try {
      await api.deleteHistorialVisita(String(deletingId));
      setDeletingId(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      Alert.alert('Error al eliminar', err.message || 'No se pudo eliminar el registro.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEdit = (item) => {
    setEditForm({
      visitante: item.visitante || '',
      cedula:    item.cedula    || '',
      propiedad: item.propiedad || '',
      tipo:      item.tipo      || 'peatonal',
      placa:     item.placa     || '',
      fecha:     item.fecha     || '',
      entrada:   item.entrada   || '',
      salida:    item.salida    || '',
      motivo:    item.motivo    || '',
    });
    setEditError('');
    setEditItem(item);
  };

  const confirmEdit = async () => {
    if (!editForm.visitante.trim()) { setEditError('El nombre del visitante es requerido.'); return; }
    setEditLoading(true);
    try {
      await api.updateHistorialVisita(String(editItem.id), {
        visitante: editForm.visitante.trim(),
        cedula:    editForm.cedula.trim(),
        propiedad: editForm.propiedad.trim(),
        tipo:      editForm.tipo,
        placa:     editForm.tipo === 'vehicular' ? editForm.placa.trim() : '',
        fecha:     editForm.fecha.trim(),
        entrada:   editForm.entrada.trim(),
        salida:    editForm.salida.trim(),
        motivo:    editForm.motivo.trim(),
      });
      setEditItem(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setEditError(err.message || 'No se pudo guardar los cambios.');
    } finally {
      setEditLoading(false);
    }
  };

  const typeOptions = [
    { value: 'todos',     label: 'Todos los tipos' },
    { value: 'peatonal',  label: 'Peatonal' },
    { value: 'vehicular', label: 'Vehicular' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <TopBar title="Historial Visitas" onMenuPress={() => setDrawerOpen(true)} roleLabel={roleLabel} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <Text style={styles.pageTitle}>Historial de Visitas</Text>
        <Text style={styles.pageSub}>Registro completo de entradas y salidas</Text>

        {/* Export section */}
        <View style={styles.exportCard}>
          <Text style={styles.exportLabel}>PERÍODO A EXPORTAR</Text>
          <MonthPicker
            allMonths={exportMonthOptions}
            selected={exportMonths}
            onToggle={toggleMonth}
            onToggleYear={toggleYear}
            onToggleAll={toggleAllMonths}
          />
          <View style={styles.exportBtns}>
            <TouchableOpacity style={[styles.exportBtn, styles.exportBtnExcel]} onPress={handleExportExcel} activeOpacity={0.8}>
              <ExcelIcon />
              <Text style={[styles.exportBtnText, { color: '#16a34a' }]}>CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportBtn, styles.exportBtnPdf]} onPress={handleExportPdf} activeOpacity={0.8}>
              <PdfIcon />
              <Text style={[styles.exportBtnText, { color: '#dc2626' }]}>Texto</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Condo label — static, never a button */}
        <View style={{ marginBottom: spacing.md }}>
          <Text style={{ fontSize: font.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Condominio</Text>
          <Text style={{ fontSize: font.sm, fontWeight: '600', color: colors.text }}>
            {isSuperAdmin ? (condoName || '—') : (user?.condo || '—')}
          </Text>
        </View>

        {/* KPI cards */}
        <View style={styles.kpiTotal}>
          <View style={styles.kpiInner}>
            <Text style={[styles.kpiLabel, { color: colors.primary, flex: 1 }]}>TOTAL VISITAS ESTE MES</Text>
            <View style={[styles.kpiIconWrap, { backgroundColor: colors.primary }]}>
              <ClockIcon />
            </View>
          </View>
          <Text style={styles.kpiValue}>{pageData.total}</Text>
          <Text style={[styles.kpiSub, { color: colors.primary }]}>visitantes registrados este mes</Text>
        </View>

        <View style={styles.kpiPair}>
          <View style={[styles.kpiWalk, { flex: 1 }]}>
            <View style={styles.kpiInner}>
              <Text style={[styles.kpiLabel, { color: '#16a34a', flex: 1 }]}>VISITAS PEATONALES</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#16a34a' }]}>
                <WalkIcon />
              </View>
            </View>
            <Text style={styles.kpiValue}>{pageData.totalPeatonales}</Text>
            <Text style={[styles.kpiSub, { color: '#16a34a' }]}>accesos a pie este mes</Text>
          </View>
          <View style={[styles.kpiVehicle, { flex: 1 }]}>
            <View style={styles.kpiInner}>
              <Text style={[styles.kpiLabel, { color: colors.primary, flex: 1 }]}>VISITAS VEHICULARES</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: colors.primary }]}>
                <CarIcon />
              </View>
            </View>
            <Text style={styles.kpiValue}>{pageData.totalVehiculares}</Text>
            <Text style={[styles.kpiSub, { color: colors.primary }]}>accesos vehiculares este mes</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, cédula, propiedad o placa..."
            placeholderTextColor={colors.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        {/* Type filter — pill tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.sm }}>
          {[
            { value: 'todos',     label: 'Todos' },
            { value: 'peatonal',  label: 'Peatonal' },
            { value: 'vehicular', label: 'Vehicular' },
          ].map(opt => {
            const active = typeFilter === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setTypeFilter(opt.value)}
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 16, paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: active ? '700' : '500',
                  color: active ? '#fff' : colors.textMuted,
                }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Horizontal-scroll table */}
        <View style={styles.tableWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              {/* Header */}
              <View style={styles.tableHead}>
                {['Visitante','Cedula','Propiedad','Tipo','Placa','Fecha','Entrada','Salida','Motivo','Documentos',
                  ...(canDelete ? ['Acciones'] : [])].map((h, i) => (
                  <Text key={i} style={[styles.th, COL_W[i] && { width: COL_W[i] }]} numberOfLines={1}>{h}</Text>
                ))}
              </View>

              {/* Body */}
              {loading ? (
                <View style={styles.tableEmpty}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : pageData.data.length === 0 ? (
                <View style={styles.tableEmpty}>
                  <Text style={styles.tableEmptyText}>No se encontraron registros.</Text>
                </View>
              ) : pageData.data.map((item, idx) => {
                const availDocs = DOC_TYPES.filter(d => item[d.flag] && (!d.vehicularOnly || item.tipo === 'vehicular'));
                const isInside  = !item.salida || item.salida === '-' || item.salida === '';
                return (
                  <TouchableOpacity key={String(item.id)} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]} onPress={() => setSelectedVisita(item)} activeOpacity={1}>
                    <Text style={[styles.td, { width: COL_W[0] }]} numberOfLines={2}>{item.visitante}</Text>
                    <Text style={[styles.td, { width: COL_W[1] }]} numberOfLines={1}>{item.cedula}</Text>
                    <Text style={[styles.td, { width: COL_W[2] }]} numberOfLines={2}>{item.propiedad}</Text>
                    <View style={[styles.tdCell, { width: COL_W[3] }]}>
                      <View style={[styles.chip, item.tipo === 'vehicular' ? styles.chipVeh : styles.chipWalk]}>
                        <Text style={[styles.chipTxt, item.tipo === 'vehicular' ? styles.chipTxtVeh : styles.chipTxtWalk]}>
                          {item.tipo}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.td, { width: COL_W[4] }]} numberOfLines={1}>{item.placa}</Text>
                    <Text style={[styles.td, { width: COL_W[5] }]} numberOfLines={1}>{item.fecha}</Text>
                    <Text style={[styles.td, { width: COL_W[6] }]} numberOfLines={1}>{item.entrada}</Text>
                    <View style={[styles.tdCell, { width: COL_W[7] }]}>
                      {isInside
                        ? <View style={styles.dentroChip}><Text style={styles.dentroTxt}>Dentro</Text></View>
                        : <Text style={styles.td} numberOfLines={1}>{item.salida}</Text>}
                    </View>
                    <Text style={[styles.td, { width: COL_W[8] }]} numberOfLines={2}>{item.motivo}</Text>
                    <View style={[styles.tdCell, { width: COL_W[9] }]}>
                      {availDocs.length === 0
                        ? <Text style={styles.tdMuted}>—</Text>
                        : (
                          <TouchableOpacity style={styles.docsBtn} onPress={() => setDocsItem(item)} activeOpacity={0.7}>
                            <Text style={styles.docsBtnTxt}>Ver ({availDocs.length})</Text>
                          </TouchableOpacity>
                        )}
                    </View>
                    {canDelete && (
                      <View style={[styles.tdCell, { width: COL_W[10] }]}>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeletingId(item.id)} activeOpacity={0.7}>
                          <TrashIcon />
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Pagination */}
        {pageData.totalPages > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, page === 1 && styles.pageBtnDis]}
              onPress={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              activeOpacity={0.7}
            >
              <Text style={[styles.pageBtnTxt, page === 1 && styles.pageBtnTxtDis]}>‹ Anterior</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>Pág. {page} / {pageData.totalPages}</Text>
            <TouchableOpacity
              style={[styles.pageBtn, page >= pageData.totalPages && styles.pageBtnDis]}
              onPress={() => setPage(p => Math.min(pageData.totalPages, p + 1))}
              disabled={page >= pageData.totalPages}
              activeOpacity={0.7}
            >
              <Text style={[styles.pageBtnTxt, page >= pageData.totalPages && styles.pageBtnTxtDis]}>Siguiente ›</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* ── Delete modal ───────────────────────────────────────────────────── */}
      <Modal visible={!!deletingId} transparent animationType="none">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDeletingId(null)}>
          <TouchableOpacity style={styles.modal} activeOpacity={1} onPress={() => {}}>
            <View style={styles.dangerCircle}>
              <Text style={styles.dangerExcl}>!</Text>
            </View>
            <Text style={styles.modalTitle}>¿Eliminar este registro?</Text>
            <Text style={styles.modalSub}>Esta acción no se puede deshacer — usalo solo si fue un duplicado o un error de registro.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setDeletingId(null)} activeOpacity={0.8} disabled={deleteLoading}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnDanger, deleteLoading && { opacity: 0.6 }]} onPress={confirmDelete} activeOpacity={0.8} disabled={deleteLoading}>
                <Text style={styles.btnDangerTxt}>{deleteLoading ? 'Eliminando…' : 'Eliminar'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Docs modal ─────────────────────────────────────────────────────── */}
      <Modal visible={!!docsItem} transparent animationType="none">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDocsItem(null)}>
          <TouchableOpacity style={styles.modal} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.modalTitle}>Documentos de {docsItem?.visitante}</Text>
            <Text style={styles.docsSubtitle}>{docsItem?.fecha} · {docsItem?.propiedad}</Text>
            {docsItem && DOC_TYPES
              .filter(d => docsItem[d.flag] && (!d.vehicularOnly || docsItem.tipo === 'vehicular'))
              .map((d, i, arr) => (
                <View key={d.type} style={[styles.docRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.docRowLabel}>{d.label}</Text>
                  <View style={styles.docRowBtns}>
                    <TouchableOpacity
                      style={styles.docBtnSec}
                      disabled={!!docsBusy}
                      onPress={() => handleViewDoc(docsItem.visitaId || docsItem.id, d.type, d.label)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.docBtnSecTxt}>{docsBusy === `${d.type}-view` ? '…' : 'Ver'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.docBtnPri}
                      disabled={!!docsBusy}
                      onPress={() => handleDownloadDoc(docsItem.visitaId || docsItem.id, d.type, d.label)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.docBtnPriTxt}>{docsBusy === `${d.type}-download` ? '…' : 'Descargar'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            <TouchableOpacity style={styles.docsCloseBtn} onPress={() => setDocsItem(null)} activeOpacity={0.8}>
              <Text style={styles.btnCancelTxt}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Visita detail bottom sheet ─────────────────────────────────── */}
      <Modal visible={!!selectedVisita} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSelectedVisita(null)}>
        <TouchableOpacity style={styles.bottomOverlay} activeOpacity={1} onPress={() => setSelectedVisita(null)}>
          <TouchableOpacity style={[styles.visitaSheet, { paddingBottom: spacing.lg + insets.bottom }]} activeOpacity={1} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.visitaSheetTitle}>Detalles de la visita</Text>

            {/* Nombre + cédula + chip de tipo */}
            <View style={styles.visitaSheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.visitaSheetName} numberOfLines={2}>{selectedVisita?.visitante}</Text>
                <Text style={styles.visitaSheetSub}>CI: {selectedVisita?.cedula || '—'}</Text>
              </View>
              <View style={[styles.chip, selectedVisita?.tipo === 'vehicular' ? styles.chipVeh : styles.chipWalk, { marginLeft: 8 }]}>
                <Text style={[styles.chipTxt, selectedVisita?.tipo === 'vehicular' ? styles.chipTxtVeh : styles.chipTxtWalk]}>
                  {selectedVisita?.tipo}
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.visitaInfoBlock}>
                <VisitaRow label="Propiedad" value={selectedVisita?.propiedad} />
                <VisitaRow label="Fecha" value={selectedVisita?.fecha} />
                <VisitaRow label="Entrada" value={selectedVisita?.entrada} />
                <VisitaRow
                  label="Salida"
                  value={(!selectedVisita?.salida || selectedVisita.salida === '-' || selectedVisita.salida === '')
                    ? 'Dentro del condominio'
                    : selectedVisita.salida}
                />
                {selectedVisita?.tipo === 'vehicular' && (
                  <VisitaRow label="Placa" value={selectedVisita?.placa} />
                )}
                <VisitaRow label="Motivo" value={selectedVisita?.motivo} last />
              </View>

              {(() => {
                const avail = DOC_TYPES.filter(d => selectedVisita?.[d.flag] && (!d.vehicularOnly || selectedVisita?.tipo === 'vehicular'));
                if (!avail.length) return null;
                return (
                  <TouchableOpacity
                    style={styles.visitaDocsBtn}
                    onPress={() => { setSelectedVisita(null); setTimeout(() => setDocsItem(selectedVisita), 350); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.visitaDocsBtnTxt}>Ver documentos ({avail.length})</Text>
                  </TouchableOpacity>
                );
              })()}

              {canDelete && (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <TouchableOpacity
                    style={[styles.visitaDeleteBtn, { flex: 1, marginBottom: 0 }]}
                    onPress={() => { setSelectedVisita(null); setTimeout(() => setDeletingId(selectedVisita?.id), 350); }}
                    activeOpacity={0.8}
                  >
                    <TrashIcon />
                    <Text style={styles.visitaDeleteTxt}>Eliminar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.visitaEditBtn, { flex: 1 }]}
                    onPress={() => { const v = selectedVisita; setSelectedVisita(null); setTimeout(() => openEdit(v), 350); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.visitaEditTxt}>Editar datos</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.visitaCloseBtn} onPress={() => setSelectedVisita(null)} activeOpacity={0.8}>
              <Text style={styles.visitaCloseTxt}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit modal ────────────────────────────────────────────────── */}
      <Modal visible={!!editItem} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditItem(null)}>
        <TouchableOpacity style={styles.bottomOverlay} activeOpacity={1} onPress={() => setEditItem(null)}>
          <TouchableOpacity style={[styles.visitaSheet, { maxHeight: '85%', paddingBottom: spacing.lg + insets.bottom }]} activeOpacity={1} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.visitaSheetTitle}>Editar visita</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text style={styles.editLabel}>Nombre del visitante *</Text>
              <TextInput style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={editForm.visitante} onChangeText={v => setEditForm(f => ({ ...f, visitante: v }))} placeholderTextColor={colors.textMuted} placeholder="Nombre completo" />

              <Text style={styles.editLabel}>Cédula / Documento</Text>
              <TextInput style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={editForm.cedula} onChangeText={v => setEditForm(f => ({ ...f, cedula: v }))} placeholderTextColor={colors.textMuted} placeholder="Número de cédula" keyboardType="numeric" />

              <Text style={styles.editLabel}>Propiedad</Text>
              <TextInput style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={editForm.propiedad} onChangeText={v => setEditForm(f => ({ ...f, propiedad: v }))} placeholderTextColor={colors.textMuted} placeholder="Ej: Apt 101" />

              <Text style={styles.editLabel}>Tipo</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                {['peatonal', 'vehicular'].map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setEditForm(f => ({ ...f, tipo: t }))}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center',
                      backgroundColor: editForm.tipo === t ? colors.primary : colors.inputBg,
                      borderWidth: 1, borderColor: editForm.tipo === t ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: font.sm, fontWeight: '600', color: editForm.tipo === t ? '#fff' : colors.textMuted }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {editForm.tipo === 'vehicular' && (
                <>
                  <Text style={styles.editLabel}>Placa</Text>
                  <TextInput style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={editForm.placa} onChangeText={v => setEditForm(f => ({ ...f, placa: v }))} placeholderTextColor={colors.textMuted} placeholder="ABC-1234" autoCapitalize="characters" />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editLabel}>Hora entrada</Text>
                  <TextInput style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={editForm.entrada} onChangeText={v => setEditForm(f => ({ ...f, entrada: v }))} placeholderTextColor={colors.textMuted} placeholder="HH:MM" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editLabel}>Hora salida</Text>
                  <TextInput style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={editForm.salida} onChangeText={v => setEditForm(f => ({ ...f, salida: v }))} placeholderTextColor={colors.textMuted} placeholder="HH:MM" />
                </View>
              </View>

              <Text style={styles.editLabel}>Fecha</Text>
              <TextInput style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} value={editForm.fecha} onChangeText={v => setEditForm(f => ({ ...f, fecha: v }))} placeholderTextColor={colors.textMuted} placeholder="DD/MM/AAAA" />

              <Text style={styles.editLabel}>Motivo (opcional)</Text>
              <TextInput style={[styles.editInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border, minHeight: 64, textAlignVertical: 'top' }]} value={editForm.motivo} onChangeText={v => setEditForm(f => ({ ...f, motivo: v }))} placeholderTextColor={colors.textMuted} placeholder="Motivo de la visita" multiline />

              {editError ? <Text style={{ fontSize: 12, color: colors.danger, marginBottom: spacing.sm }}>{editError}</Text> : null}

            </ScrollView>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setEditItem(null)} disabled={editLoading} activeOpacity={0.8}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSave, editLoading && { opacity: 0.6 }]} onPress={confirmEdit} disabled={editLoading} activeOpacity={0.8}>
                <Text style={styles.btnSaveTxt}>{editLoading ? 'Guardando…' : 'Guardar cambios'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Image preview modal ────────────────────────────────────────── */}
      <Modal visible={!!previewModal} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPreviewModal(null)}>
          <TouchableOpacity style={styles.previewCard} activeOpacity={1} onPress={() => {}}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle} numberOfLines={1}>{previewModal?.label}</Text>
              <TouchableOpacity onPress={() => setPreviewModal(null)} style={styles.previewCloseBtn} activeOpacity={0.7}>
                <Text style={styles.previewCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.previewImageWrap}>
              {previewModal && (
                <Image
                  source={{ uri: previewModal.url }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                  onLoadStart={() => setPreviewLoading(true)}
                  onLoadEnd={() => setPreviewLoading(false)}
                />
              )}
              {previewLoading && (
                <ActivityIndicator size="large" color={colors.primary} />
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// Column widths (matches headers array order)
const COL_W = [120, 90, 110, 90, 80, 88, 84, 80, 100, 104, 84];

function makeStyles(colors, isDark = false) {
  return StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 60 },

  pageTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: 4 },
  pageSub:   { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.lg },

  // Export
  exportCard:     { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  exportLabel:    { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: spacing.sm },
  exportBtns:     { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  exportBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1 },
  exportBtnExcel: { borderColor: isDark ? 'rgba(34,197,94,0.45)' : '#16a34a', backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4' },
  exportBtnPdf:   { borderColor: isDark ? 'rgba(239,68,68,0.45)'  : '#dc2626', backgroundColor: isDark ? 'rgba(239,68,68,0.1)'  : '#fef2f2' },
  exportBtnText:  { fontSize: font.sm, fontWeight: '600' },

  // Search
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontSize: font.sm, color: colors.text, paddingVertical: 11 },

  // Picker
  pickerBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12 },
  pickerBtnOpen:      { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: colors.primary, borderBottomColor: 'transparent' },
  pickerBtnText:      { fontSize: font.sm, color: colors.text, flex: 1 },
  inlineDrop:         { backgroundColor: colors.surface, borderWidth: 1, borderTopWidth: 0, borderColor: colors.primary, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, overflow: 'hidden' },
  inlineDropItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 11, gap: 8 },
  inlineDropItemActive: { backgroundColor: colors.primarySoft },
  inlineDropText:     { fontSize: font.sm, color: colors.text, flex: 1 },
  inlineDropTextActive: { color: colors.primary, fontWeight: '600' },

  // Checkbox (month picker)
  checkbox:         { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked:  { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxPartial:  { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  checkmark:        { color: '#fff', fontSize: 9, fontWeight: '700' },
  checkmarkPartial: { color: colors.primary, fontSize: 11, fontWeight: '700', lineHeight: 14 },

  // Year grouping
  yearHeader:    { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  yearCheckRow:  { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 11, gap: 8 },
  yearLabel:     { fontSize: font.sm, fontWeight: '700', color: colors.text, flex: 1 },
  yearCount:     { fontSize: 11, color: colors.textMuted },
  yearExpandBtn: { paddingHorizontal: spacing.md, paddingVertical: 11 },
  monthIndent:       { paddingLeft: 36 },
  monthRecordCount:  { fontSize: 11, color: colors.textMuted },

  // KPI — cristalizados en dark mode
  kpiTotal:   {
    backgroundColor: isDark ? 'rgba(139,92,246,0.1)'  : '#f3f0ff',
    borderColor:     isDark ? 'rgba(139,92,246,0.3)'  : '#ddd6fe',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1,
  },
  kpiWalk:    {
    backgroundColor: isDark ? 'rgba(16,185,129,0.1)'  : '#f0fdf4',
    borderColor:     isDark ? 'rgba(16,185,129,0.3)'  : '#bbf7d0',
    borderRadius: radius.md, padding: spacing.md, borderWidth: 1, marginRight: spacing.xs,
  },
  kpiVehicle: {
    backgroundColor: isDark ? 'rgba(139,92,246,0.1)'  : '#f3f0ff',
    borderColor:     isDark ? 'rgba(139,92,246,0.3)'  : '#ddd6fe',
    borderRadius: radius.md, padding: spacing.md, borderWidth: 1, marginLeft: spacing.xs,
  },
  kpiPair:    { flexDirection: 'row', marginBottom: spacing.md },
  kpiInner:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  kpiLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  kpiIconWrap:{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  kpiValue:   { fontSize: font.xxl, fontWeight: '800', color: colors.text, lineHeight: 36 },
  kpiSub:     { fontSize: 11, marginTop: 2 },

  // Table — cristalizada en dark mode
  tableWrap:      { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
  tableHead:      { flexDirection: 'row', backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : '#f9fafb', borderBottomWidth: 1, borderBottomColor: colors.border },
  th:             { paddingHorizontal: 10, paddingVertical: 10, fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  tableRow:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#c8cdd8', alignItems: 'center', minHeight: 44, backgroundColor: isDark ? 'transparent' : '#ffffff' },
  tableRowAlt:    { backgroundColor: isDark ? 'rgba(139,92,246,0.06)' : '#f0f4ff' },
  td:             { paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, color: colors.text },
  tdCell:         { paddingHorizontal: 10, paddingVertical: 4, justifyContent: 'center' },
  tdMuted:        { fontSize: 11, color: colors.textMuted },
  tableEmpty:     { padding: spacing.xl, alignItems: 'center' },
  tableEmptyText: { fontSize: font.sm, color: colors.textMuted },

  // Type chip — cristalizados en dark mode
  chip:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', borderWidth: isDark ? 1 : 0 },
  chipWalk:   { backgroundColor: isDark ? 'rgba(16,185,129,0.15)'  : '#dcfce7', borderColor: isDark ? 'rgba(16,185,129,0.4)' : 'transparent' },
  chipVeh:    { backgroundColor: isDark ? 'rgba(59,130,246,0.15)'  : '#dbeafe', borderColor: isDark ? 'rgba(59,130,246,0.4)' : 'transparent' },
  chipTxt:    { fontSize: 10, fontWeight: '700' },
  chipTxtWalk:{ color: isDark ? '#6ee7b7' : '#16a34a' },
  chipTxtVeh: { color: isDark ? '#93c5fd' : '#1d4ed8' },
  dentroChip: { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#dcfce7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: isDark ? 1 : 0, borderColor: isDark ? 'rgba(16,185,129,0.4)' : 'transparent' },
  dentroTxt:  { fontSize: 10, fontWeight: '700', color: isDark ? '#6ee7b7' : '#16a34a' },

  // Docs button (in table)
  docsBtn:    { backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : '#ede9fe', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: isDark ? 1 : 0, borderColor: isDark ? 'rgba(139,92,246,0.35)' : 'transparent' },
  docsBtnTxt: { fontSize: 11, fontWeight: '700', color: colors.primary },
  deleteBtn:  { padding: 6 },

  // Pagination
  pagination:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageBtn:         { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 8 },
  pageBtnDis:      { opacity: 0.4 },
  pageBtnTxt:      { fontSize: font.sm, fontWeight: '600', color: colors.primary },
  pageBtnTxtDis:   { color: colors.textMuted },
  pageInfo:        { fontSize: font.sm, color: colors.textMuted },

  // Modal overlay
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modal:   { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 360 },

  // Delete modal
  dangerCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.md },
  dangerExcl:   { fontSize: 24, fontWeight: '800', color: colors.dangerText },
  modalTitle:   { fontSize: font.lg, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  modalSub:     { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  btnCancel:    { flex: 1, backgroundColor: '#f3f4f6', borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  btnCancelTxt: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  btnDanger:    { flex: 1, backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  btnDangerTxt: { fontSize: font.sm, fontWeight: '600', color: '#fff' },

  // Docs modal
  docsSubtitle:  { fontSize: font.xs, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md, marginTop: 2 },
  docsCloseBtn:  { backgroundColor: '#f3f4f6', borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', marginTop: spacing.md },

  // Visit detail bottom sheet
  bottomOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  visitaSheet:      { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingTop: spacing.sm, maxHeight: '60%' },
  sheetHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  visitaSheetTitle: { fontSize: font.base, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  visitaSheetHeader:{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  visitaSheetName:  { fontSize: font.lg, fontWeight: '700', color: colors.text },
  visitaSheetSub:   { fontSize: font.xs, color: colors.textMuted, marginTop: 3 },
  visitaInfoBlock:  { backgroundColor: colors.bg, borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  visitaRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  visitaRowLabel:   { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  visitaRowValue:   { fontSize: font.sm, color: colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  visitaDocsBtn:    { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm },
  visitaDocsBtnTxt: { fontSize: font.sm, fontWeight: '700', color: colors.primary },
  visitaDeleteBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: isDark ? '#3b0d0d' : '#fff5f5', borderRadius: radius.md, paddingVertical: 12, borderWidth: 1, borderColor: isDark ? '#7f1d1d' : '#fee2e2' },
  visitaDeleteTxt:  { fontSize: font.sm, fontWeight: '600', color: colors.dangerText },
  visitaEditBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: 12, borderWidth: 1, borderColor: isDark ? 'rgba(139,92,246,0.35)' : '#ddd6fe' },
  visitaEditTxt:    { fontSize: font.sm, fontWeight: '600', color: colors.primary },
  visitaCloseBtn:   { backgroundColor: isDark ? colors.surface : '#f3f4f6', borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', marginTop: spacing.xs },
  visitaCloseTxt:   { fontSize: font.sm, fontWeight: '600', color: colors.text },

  // Edit form
  editLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 4, marginTop: spacing.sm },
  editInput: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 10, fontSize: font.sm, marginBottom: 4 },
  btnSave:    { flex: 1, backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  btnSaveTxt: { fontSize: font.sm, fontWeight: '700', color: '#fff' },

  // Image preview modal
  previewCard:     { backgroundColor: colors.surface, borderRadius: radius.lg, width: '100%', maxWidth: 360, overflow: 'hidden' },
  previewHeader:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewTitle:    { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.text },
  previewCloseBtn: { padding: 4 },
  previewCloseTxt: { fontSize: font.lg, color: colors.textMuted, fontWeight: '700' },
  previewImageWrap:{ height: 320, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' },
  docRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  docRowLabel:  { fontSize: font.sm, color: colors.text, flex: 1 },
  docRowBtns:   { flexDirection: 'row', gap: spacing.xs },
  docBtnSec:    { backgroundColor: '#f3f4f6', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  docBtnSecTxt: { fontSize: font.xs, fontWeight: '600', color: colors.text },
  docBtnPri:    { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  docBtnPriTxt: { fontSize: font.xs, fontWeight: '600', color: '#fff' },
});
}