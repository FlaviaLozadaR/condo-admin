import { useEffect, useRef, useState } from "react";
import * as api from "../api.js";
import Pagination from "../components/Pagination.jsx";
import { getPropertyTenantsText, propertyHasTenant } from "../utils/tenants.js";
import { parseFecha } from "./dashboardUtils.js";

const PAGE_SIZE = 20;
const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function PagosScreen({
  user,
  isSuperAdministrator,
  condominiosData,
  setCondominiosData,
  propiedadesData,
  setPropiedadesData,
  pagosData,
  setPagosData,
  onToast,
  exportToPDF,
}) {
  // Filtros y tabla
  const [paymentCondoDropdownOpen, setPaymentCondoDropdownOpen] = useState(false);
  const [paymentTab, setPaymentTab] = useState("todos");
  const [paymentTipoFilter, setPaymentTipoFilter] = useState("todos");
  const [paymentCondoFilter, setPaymentCondoFilter] = useState("todos");
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [exportMonthsFilter, setExportMonthsFilter] = useState(new Set());
  const [exportMonthsDropdownOpen, setExportMonthsDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState({
    data: [], total: 0,
    totalPendientes: 0, totalAprobados: 0, totalRechazados: 0,
    approvedPaymentsTotal: 0, totalPages: 1,
  });
  const [loading, setLoading] = useState(false);

  // Revisión inline de pagos
  const [reviewingPagoId, setReviewingPagoId] = useState(null);
  const [reviewCumplio, setReviewCumplio] = useState(null); // 'si' | 'no'
  const [reviewMontoReal, setReviewMontoReal] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState(null); // { message, onAccept }

  // Panel QR de pago
  const [qrUploadLoading, setQrUploadLoading] = useState(false);
  const [qrUploadMsg, setQrUploadMsg] = useState('');
  const [qrSelectedCondoId, setQrSelectedCondoId] = useState('');
  const [qrCondoDropdownOpen, setQrCondoDropdownOpen] = useState(false);
  const [qrZoomOpen, setQrZoomOpen] = useState(false);
  const [comprobanteZoomUrl, setComprobanteZoomUrl] = useState(null);
  const [qrRetriedFor, setQrRetriedFor] = useState(null);

  // Panel gestión de expensas
  const [expensasInputVal, setExpensasInputVal] = useState('');
  const [expensasLoading, setExpensasLoading] = useState(false);
  const [expensasMsg, setExpensasMsg] = useState('');
  const [expensasSelectedIds, setExpensasSelectedIds] = useState(new Set());
  const [cargoExtraSearch, setCargoExtraSearch] = useState('');
  const [expensasCollapsed, setExpensasCollapsed] = useState(true);
  const [expensasPage, setExpensasPage] = useState(1);
  const expensasMgmtRef = useRef(null);
  const EXPENSAS_PAGE_SIZE = 15;
  const [cargoExtraModalProp, setCargoExtraModalProp] = useState(null);
  const [newCargoMonto, setNewCargoMonto] = useState('');
  const [newCargoMotivo, setNewCargoMotivo] = useState('');
  const [editingCargoItemId, setEditingCargoItemId] = useState(null);
  const [editCargoMonto, setEditCargoMonto] = useState('');
  const [editCargoMotivo, setEditCargoMotivo] = useState('');
  const [cargoExtraLoading, setCargoExtraLoading] = useState(false);
  const [editingExpensaId, setEditingExpensaId] = useState(null);
  const [expensaEditVal, setExpensaEditVal] = useState('');
  const [expensaEditLoading, setExpensaEditLoading] = useState(false);

  const selectedPaymentCondoName =
    paymentCondoFilter === "todos"
      ? ""
      : (condominiosData.find((condo) => String(condo.id) === paymentCondoFilter)?.name || "");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(paymentSearchTerm), 400);
    return () => clearTimeout(t);
  }, [paymentSearchTerm]);

  useEffect(() => {
    setExpensasPage(1);
  }, [cargoExtraSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, paymentTab, paymentTipoFilter, selectedPaymentCondoName]);

  const fetchPage = (showLoading = true) => {
    if (showLoading) setLoading(true);
    return api.getPagosPaged({
      page,
      limit: PAGE_SIZE,
      estado: paymentTab,
      tipo: paymentTipoFilter === 'todos' ? undefined : paymentTipoFilter,
      q: debouncedSearch,
      condo: selectedPaymentCondoName,
    })
      .then(setPageData)
      .catch((err) => onToast?.(err.message, "error"))
      .finally(() => { if (showLoading) setLoading(false); });
  };

  useEffect(() => {
    fetchPage();
  }, [page, paymentTab, paymentTipoFilter, debouncedSearch, selectedPaymentCondoName]);

  const pendingPaymentsCount  = pageData.totalPendientes;
  const approvedPaymentsTotal = pageData.approvedPaymentsTotal;
  const totalPaymentsCount    = pageData.totalPendientes + pageData.totalAprobados + pageData.totalRechazados;

  // Meses disponibles para exportar — derivados de las fechas reales de los pagos,
  // desde el primer pago registrado hasta el más reciente.
  const exportMonthOptions = (() => {
    const map = new Map();
    pagosData.forEach((p) => {
      const d = parseFecha(p.fecha);
      if (!d || isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { key, year: d.getFullYear(), month: d.getMonth(), label: `${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}` });
    });
    return Array.from(map.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  })();

  const toggleExportMonth = (key) => {
    setExportMonthsFilter((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const toggleAllExportMonths = () => {
    setExportMonthsFilter((prev) =>
      prev.size === exportMonthOptions.length ? new Set() : new Set(exportMonthOptions.map((o) => o.key))
    );
  };

  const condoByPropLabel = new Map(propiedadesData.map((p) => [`${p.street} - ${p.code}`, p.condo]));
  const resolveCondoDePago = (p) =>
    condoByPropLabel.get(p.propiedad) || propiedadesData.find((pr) => pr.owner === p.propietario)?.condo || "";

  const fmtRegistrado = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const handleExportPagos = async (format) => {
    const query = paymentSearchTerm.toLowerCase().trim();
    const toExport = pagosData.filter((item) => {
      const byCondo = !selectedPaymentCondoName || (item.condo || resolveCondoDePago(item)) === selectedPaymentCondoName;
      const byTab = paymentTab === "todos" || item.estado === paymentTab;
      const byQuery =
        !query ||
        item.propiedad.toLowerCase().includes(query) ||
        item.propietario.toLowerCase().includes(query) ||
        item.fecha.toLowerCase().includes(query) ||
        item.tipo.toLowerCase().includes(query);
      const byMonth = exportMonthsFilter.size === 0 || (() => {
        const d = parseFecha(item.fecha);
        if (!d || isNaN(d)) return false;
        return exportMonthsFilter.has(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      })();
      return byCondo && byTab && byQuery && byMonth;
    }).sort((a, b) => (parseFecha(a.fecha) || 0) - (parseFecha(b.fecha) || 0));

    if (toExport.length === 0) { onToast?.("No hay pagos para exportar con los filtros seleccionados.", "warning"); return; }

    const date  = new Date().toISOString().slice(0, 10);
    const label = paymentTab === "todos" ? "todos" : paymentTab;
    const periodoLabel = exportMonthsFilter.size === 0
      ? "Todos los periodos"
      : `Periodo: ${exportMonthOptions.filter((o) => exportMonthsFilter.has(o.key)).map((o) => o.label).join(", ")}`;

    const totalMonto     = toExport.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    const aprobados      = toExport.filter((p) => p.estado === "aprobado");
    const pendientes     = toExport.filter((p) => p.estado === "pendiente");
    const rechazados     = toExport.filter((p) => p.estado === "rechazado");
    const totalAprobado  = aprobados.reduce((s, p) => s + (Number(p.monto) || 0), 0);

    if (format === "excel") {
      // xlsx se carga bajo demanda: pesa ~400KB y solo se necesita al exportar
      const XLSX = await import("xlsx");

      const ws = XLSX.utils.json_to_sheet(toExport.map((p) => ({
        Condominio:      resolveCondoDePago(p) || "—",
        Propiedad:       p.propiedad,
        Unidad:          p.unit || "—",
        Propietario:     p.propietario,
        Tipo:            p.tipo,
        "Monto (Bs.)":   Number(p.monto) || 0,
        Fecha:           p.fecha,
        Vencimiento:     p.dueDate || "—",
        Estado:          p.estado,
        Referencia:      p.referencia || "—",
        Comprobante:     p.comprobante ? "Sí" : "No",
        "Registrado el": fmtRegistrado(p.insertedAt),
      })));
      ws["!cols"] = [
        { wch: 22 }, { wch: 26 }, { wch: 10 }, { wch: 22 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 18 },
      ];

      // Resumen por mes — para que de un vistazo se vea lo cobrado de cada periodo
      const resumenPorMes = new Map();
      toExport.forEach((p) => {
        const d   = parseFecha(p.fecha);
        const key = d && !isNaN(d) ? `${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}` : "Sin fecha";
        if (!resumenPorMes.has(key)) {
          resumenPorMes.set(key, { mes: key, cantidad: 0, aprobados: 0, pendientes: 0, rechazados: 0, montoAprobado: 0, montoTotal: 0 });
        }
        const r = resumenPorMes.get(key);
        r.cantidad++;
        r.montoTotal += Number(p.monto) || 0;
        if (p.estado === "aprobado") { r.aprobados++; r.montoAprobado += Number(p.monto) || 0; }
        else if (p.estado === "pendiente") r.pendientes++;
        else if (p.estado === "rechazado") r.rechazados++;
      });
      const wsResumen = XLSX.utils.json_to_sheet([
        ...Array.from(resumenPorMes.values()).map((r) => ({
          Mes: r.mes,
          "Cantidad de pagos": r.cantidad,
          Aprobados: r.aprobados,
          Pendientes: r.pendientes,
          Rechazados: r.rechazados,
          "Monto cobrado (Bs.)": r.montoAprobado,
          "Monto total (Bs.)": r.montoTotal,
        })),
        {
          Mes: "TOTAL",
          "Cantidad de pagos": toExport.length,
          Aprobados: aprobados.length,
          Pendientes: pendientes.length,
          Rechazados: rechazados.length,
          "Monto cobrado (Bs.)": totalAprobado,
          "Monto total (Bs.)": totalMonto,
        },
      ]);
      wsResumen["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pagos");
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
      XLSX.writeFile(wb, `pagos_${label}_${date}.xlsx`);
      onToast?.(`${toExport.length} pagos exportados a Excel.`, "success");
    } else {
      exportToPDF({
        title:    `Reporte de Pagos — ${label.charAt(0).toUpperCase() + label.slice(1)}`,
        subtitle: `Generado el ${new Date().toLocaleDateString("es-AR")} · ${toExport.length} registros · ${periodoLabel}`,
        headers:  ["Condominio", "Propiedad", "Unidad", "Propietario", "Tipo", "Monto", "Fecha", "Vencimiento", "Estado", "Referencia", "Comprobante", "Registrado el"],
        rows:     toExport.map((p) => [
          resolveCondoDePago(p) || "—",
          p.propiedad,
          p.unit || "—",
          p.propietario,
          p.tipo,
          `Bs. ${Number(p.monto) || 0}`,
          p.fecha,
          p.dueDate || "—",
          p.estado,
          p.referencia || "—",
          p.comprobante ? "Sí" : "No",
          fmtRegistrado(p.insertedAt),
        ]),
        totals: ["", "", "", "", "", `Bs. ${totalMonto.toLocaleString("es-AR")}`, "", "", "", "", "", ""],
      });
    }
  };

  const handleUploadPaymentQr = async (condoId, file) => {
    if (!file || !condoId) return;
    setQrUploadLoading(true);
    setQrUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('qr', file);
      const updated = await api.uploadCondoPaymentQr(condoId, fd);
      setCondominiosData(prev => prev.map(c => String(c.id) === String(condoId) ? { ...c, paymentQrUrl: updated.paymentQrUrl } : c));
      setQrUploadMsg('success');
    } catch (e) {
      setQrUploadMsg('error:' + e.message);
    } finally {
      setQrUploadLoading(false);
    }
  };

  const handleDeletePaymentQr = async (condoId) => {
    if (!condoId) return;
    setQrUploadLoading(true);
    setQrUploadMsg('');
    try {
      await api.deleteCondoPaymentQr(condoId);
      setCondominiosData(prev => prev.map(c => String(c.id) === String(condoId) ? { ...c, paymentQrUrl: '' } : c));
      setQrUploadMsg('deleted');
    } catch (e) {
      setQrUploadMsg('error:' + e.message);
    } finally {
      setQrUploadLoading(false);
    }
  };

  const handleDownloadQr = async (url, condoName) => {
    try {
      const res  = await fetch(url);
      const blob = await res.blob();
      const ext  = (blob.type.split('/')[1] || 'png').split('+')[0];
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `qr-pago-${(condoName || 'condominio').toLowerCase().replace(/\s+/g, '-')}.${ext}`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      onToast?.('No se pudo descargar el QR.', 'error');
    }
  };

  // El link firmado del QR puede vencer si la sesión queda abierta mucho
  // tiempo — si la imagen falla, se pide un link fresco una sola vez por condominio.
  const handleQrImgError = async (condoId) => {
    if (qrRetriedFor === condoId) return;
    setQrRetriedFor(condoId);
    try {
      const fresh = await api.getCondominios();
      setCondominiosData(prev => prev.map(c => {
        const match = fresh.find(f => String(f.id) === String(c.id));
        return match ? { ...c, paymentQrUrl: match.paymentQrUrl } : c;
      }));
    } catch {}
  };

  const handleSaveExpensas = async (condoId) => {
    const monto = parseFloat(expensasInputVal);
    if (isNaN(monto) || monto < 0 || expensasSelectedIds.size === 0) return;
    setExpensasLoading(true);
    setExpensasMsg('');
    try {
      const { updated } = await api.asignarExpensas(condoId, monto, [...expensasSelectedIds]);
      setPropiedadesData(prev => prev.map(p => {
        const match = updated?.find(u => String(u.id) === String(p.id));
        return match ? { ...p, expensaMensual: match.expensaMensual } : p;
      }));
      setExpensasMsg('ok');
    } catch (e) {
      setExpensasMsg('error:' + e.message);
    } finally {
      setExpensasLoading(false);
    }
  };

  const handleSaveExpensaActual = async (propId, condoId) => {
    const monto = parseFloat(expensaEditVal);
    if (isNaN(monto) || monto < 0) return;
    setExpensaEditLoading(true);
    try {
      const { updated } = await api.asignarExpensas(condoId, monto, [propId]);
      const nuevoTotal = updated?.[0]?.expensaMensual;
      setPropiedadesData(prev => prev.map(p => String(p.id) === String(propId) ? { ...p, expensaMensual: nuevoTotal ?? p.expensaMensual } : p));
      setEditingExpensaId(null);
    } catch (e) {
      onToast?.(e.message || 'No se pudo actualizar la expensa.', 'error');
    } finally {
      setExpensaEditLoading(false);
    }
  };

  const recomputeCargoTotals = (items) => ({
    cargoExtra: items.reduce((s, c) => s + (Number(c.monto) || 0), 0),
    notaCargo:  items.map(c => c.motivo).filter(Boolean).join(' · '),
  });

  const patchPropCargoList = (propId, newList) => {
    const { cargoExtra, notaCargo } = recomputeCargoTotals(newList);
    setPropiedadesData(prev => prev.map(p => String(p.id) === String(propId)
      ? { ...p, cargoExtra, notaCargo, cargosExtraList: newList }
      : p
    ));
    setCargoExtraModalProp(prev => prev && String(prev.id) === String(propId)
      ? { ...prev, cargoExtra, notaCargo, cargosExtraList: newList }
      : prev
    );
  };

  const handleAddCargoExtra = async (propId) => {
    const monto = parseFloat(newCargoMonto);
    if (isNaN(monto) || monto <= 0) return;
    setCargoExtraLoading(true);
    try {
      const nuevo = await api.addCargoExtra(propId, monto, newCargoMotivo.trim());
      const prop = propiedadesData.find(p => String(p.id) === String(propId));
      patchPropCargoList(propId, [...(prop?.cargosExtraList || []), nuevo]);
      setNewCargoMonto('');
      setNewCargoMotivo('');
    } catch (e) {
      onToast?.(e.message || 'No se pudo agregar el cargo extra.', 'error');
    } finally {
      setCargoExtraLoading(false);
    }
  };

  const handleEditCargoExtra = async (propId, cargoId) => {
    const monto = parseFloat(editCargoMonto);
    if (isNaN(monto) || monto < 0) return;
    setCargoExtraLoading(true);
    try {
      const updated = await api.editCargoExtra(propId, cargoId, monto, editCargoMotivo.trim());
      const prop = propiedadesData.find(p => String(p.id) === String(propId));
      const newList = (prop?.cargosExtraList || []).map(c => String(c.id) === String(cargoId) ? updated : c);
      patchPropCargoList(propId, newList);
      setEditingCargoItemId(null);
    } catch (e) {
      onToast?.(e.message || 'No se pudo editar el cargo extra.', 'error');
    } finally {
      setCargoExtraLoading(false);
    }
  };

  const handleDeleteCargoExtra = async (propId, cargoId) => {
    setCargoExtraLoading(true);
    try {
      await api.removeCargoExtra(propId, cargoId);
      const prop = propiedadesData.find(p => String(p.id) === String(propId));
      patchPropCargoList(propId, (prop?.cargosExtraList || []).filter(c => String(c.id) !== String(cargoId)));
    } catch (e) {
      onToast?.(e.message || 'No se pudo borrar el cargo extra.', 'error');
    } finally {
      setCargoExtraLoading(false);
    }
  };

  // Si al aprobar el pago se descontó algún cargo extra de la propiedad
  // (porque ese pago lo cubría), refleja la propiedad ya actualizada al instante.
  const applyPropiedadPatch = (result) => {
    if (result?.propiedadActualizada) {
      const p = result.propiedadActualizada;
      setPropiedadesData(prev => prev.map(item => String(item.id) === String(p.id) ? p : item));
    }
  };

  const updatePaymentStatus = async (id, status) => {
    try {
      const result = await api.updatePagoStatus(String(id), status);
      applyPropiedadPatch(result);
      setPagosData(prev => prev.map(item => String(item.id) === String(id) ? { ...item, estado: status } : item));
      setPageData(prev => ({ ...prev, data: prev.data.map(item => String(item.id) === String(id) ? { ...item, estado: status } : item) }));
      fetchPage(false);
    } catch (err) {
      console.error("Error actualizando pago:", err.message);
    }
  };

  const getExpensaTotal = (pago) => {
    // Una Reserva siempre tiene un monto fijo (el precio del área) — comparar
    // contra el cargoExtra acumulado de la propiedad (que puede incluir otros
    // cargos) daría un "total a pagar" incorrecto.
    if (pago.tipo === 'Reserva') return Number(pago.monto) || 0;
    const prop = propiedadesData.find(p => p.owner === pago.propietario || propertyHasTenant(p, pago.propietario));
    return (Number(prop?.expensaMensual) || 0) + (Number(prop?.cargoExtra) || 0) || Number(pago.monto) || 0;
  };

  const handleRevisarPago = async (pago, cumplio) => {
    if (!cumplio) return;
    setReviewLoading(true);
    try {
      const expensaTotal = getExpensaTotal(pago);

      if (cumplio === 'si') {
        const result = await api.updatePagoStatus(String(pago.id), 'aprobado');
        applyPropiedadPatch(result);
        setPagosData(prev => prev.map(item => String(item.id) === String(pago.id) ? { ...item, estado: 'aprobado' } : item));
        setPageData(prev => ({ ...prev, data: prev.data.map(item => String(item.id) === String(pago.id) ? { ...item, estado: 'aprobado' } : item) }));
      } else {
        const montoReal     = Math.max(0, parseFloat(reviewMontoReal) || 0);
        const saldoRestante = Math.max(0, expensaTotal - montoReal);
        const result = await api.updatePagoStatus(String(pago.id), 'aprobado', montoReal, saldoRestante,
          `Pago parcial: pagó Bs. ${montoReal}, saldo pendiente Bs. ${saldoRestante}`);
        applyPropiedadPatch(result);
        setPagosData(prev => prev.map(item => String(item.id) === String(pago.id) ? { ...item, estado: 'aprobado', monto: montoReal } : item));
        setPageData(prev => ({ ...prev, data: prev.data.map(item => String(item.id) === String(pago.id) ? { ...item, estado: 'aprobado', monto: montoReal } : item) }));
      }
      setReviewingPagoId(null);
      setReviewCumplio(null);
      setReviewMontoReal('');
      fetchPage(false);
    } catch (err) {
      console.error('Error revisando pago:', err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const closeReviewModal = () => {
    setReviewingPagoId(null);
    setReviewCumplio(null);
    setReviewMontoReal('');
  };

  const askConfirm = (message, onAccept) => setConfirmPrompt({ message, onAccept });

  const handleClickSiCumplio = (pago) => {
    const total = getExpensaTotal(pago);
    askConfirm(
      `¿Confirmás que ${pago.propietario} cumplió con el pago completo de Bs. ${total.toLocaleString()}?`,
      () => handleRevisarPago(pago, 'si')
    );
  };

  const handleClickNoCumplio = (pago) => {
    askConfirm(
      `¿Confirmás que ${pago.propietario} NO cumplió con el pago completo? Vas a poder indicar cuánto pagó realmente.`,
      () => { setReviewCumplio('no'); setReviewMontoReal(''); }
    );
  };

  const handleConfirmNoCumplio = (pago) => {
    const montoReal = Math.max(0, parseFloat(reviewMontoReal) || 0);
    const saldo      = Math.max(0, getExpensaTotal(pago) - montoReal);
    const msg = saldo > 0
      ? `¿Confirmás que ${pago.propietario} pagó Bs. ${montoReal.toLocaleString()}? Quedará un saldo pendiente de Bs. ${saldo.toLocaleString()}.`
      : `¿Confirmás que ${pago.propietario} pagó Bs. ${montoReal.toLocaleString()}?`;
    askConfirm(msg, () => handleRevisarPago(pago, 'no'));
  };

  return (
    <>
      <header className="dashboard-header dashboard-header-with-actions">
        <div>
          <h1>Gestion de Pagos</h1>
          <p>Administra los pagos de expensas y reservas</p>
        </div>
        <div className="export-actions-wrap">
          <div className="management-condo-field export-months-field">
            <label>Período a exportar</label>
            <div className="condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setExportMonthsDropdownOpen(false); }} tabIndex={-1}>
              <button
                type="button"
                className="condo-dropdown-trigger"
                onClick={() => setExportMonthsDropdownOpen((o) => !o)}
                aria-expanded={exportMonthsDropdownOpen}
              >
                <span className="condo-dropdown-value">
                  {exportMonthsFilter.size === 0
                    ? "Todos los meses"
                    : `${exportMonthsFilter.size} mes${exportMonthsFilter.size !== 1 ? "es" : ""} seleccionado${exportMonthsFilter.size !== 1 ? "s" : ""}`}
                </span>
                <svg className={`condo-dropdown-chevron${exportMonthsDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {exportMonthsDropdownOpen && (
                <ul className="condo-dropdown-list export-months-list" role="listbox">
                  <li
                    className="condo-dropdown-item export-months-item export-months-item-all"
                    onMouseDown={(e) => { e.preventDefault(); toggleAllExportMonths(); }}
                  >
                    <input type="checkbox" readOnly checked={exportMonthOptions.length > 0 && exportMonthsFilter.size === exportMonthOptions.length} />
                    <span>{exportMonthsFilter.size === exportMonthOptions.length ? "Quitar todos" : "Seleccionar todos"}</span>
                  </li>
                  {exportMonthOptions.length === 0 ? (
                    <li className="export-months-empty">Sin pagos registrados todavía.</li>
                  ) : exportMonthOptions.map((opt) => (
                    <li
                      key={opt.key}
                      role="option"
                      aria-selected={exportMonthsFilter.has(opt.key)}
                      className="condo-dropdown-item export-months-item"
                      onMouseDown={(e) => { e.preventDefault(); toggleExportMonth(opt.key); }}
                    >
                      <input type="checkbox" readOnly checked={exportMonthsFilter.has(opt.key)} />
                      <span>{opt.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="export-btn-group">
            <button type="button" className="export-btn export-btn-excel" onClick={() => handleExportPagos("excel")} title="Exportar a Excel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              Excel
            </button>
            <button type="button" className="export-btn export-btn-pdf" onClick={() => handleExportPagos("pdf")} title="Exportar a PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="11" y2="17"/>
              </svg>
              PDF
            </button>
          </div>
        </div>
      </header>

      {/* ── Panel QR de pago ── */}
      {(() => {
        const adminCondoId = isSuperAdministrator
          ? (qrSelectedCondoId || (condominiosData[0] ? String(condominiosData[0].id) : ''))
          : String(condominiosData.find(c => c.name === user.condo)?.id || '');
        const activeCondo  = condominiosData.find(c => String(c.id) === adminCondoId);
        const currentQr    = activeCondo?.paymentQrUrl || '';
        return (
          <>
          <section className="payment-qr-panel">
            <div className="payment-qr-panel-header">
              <div className="payment-qr-panel-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,flexShrink:0}}>
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  <path d="M14 14h1v1h-1zM17 14h1v1h-1zM14 17h1v1h-1zM17 17h3v3h-3z"/>
                </svg>
                <span>QR de Pago del Condominio</span>
              </div>
              {isSuperAdministrator && (
                <div className="condo-dropdown" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setQrCondoDropdownOpen(false); }} tabIndex={-1}>
                  <button
                    type="button"
                    className="condo-dropdown-trigger"
                    onClick={() => setQrCondoDropdownOpen(o => !o)}
                    aria-expanded={qrCondoDropdownOpen}
                  >
                    <span className="condo-dropdown-value">
                      {(() => { const c = condominiosData.find(c => String(c.id) === (qrSelectedCondoId || adminCondoId)); return c ? `${c.type}: ${c.name}` : 'Seleccioná un condominio'; })()}
                    </span>
                    <svg className={`condo-dropdown-chevron${qrCondoDropdownOpen ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {qrCondoDropdownOpen && (
                    <ul className="condo-dropdown-list" role="listbox">
                      {condominiosData.map(c => (
                        <li
                          key={c.id}
                          role="option"
                          aria-selected={(qrSelectedCondoId || adminCondoId) === String(c.id)}
                          className={`condo-dropdown-item${(qrSelectedCondoId || adminCondoId) === String(c.id) ? ' selected' : ''}`}
                          onMouseDown={() => { setQrSelectedCondoId(String(c.id)); setQrUploadMsg(''); setQrCondoDropdownOpen(false); }}
                        >
                          {c.type}: {c.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {!isSuperAdministrator && activeCondo && (
                <span className="payment-qr-condo-badge">{activeCondo.type}: {activeCondo.name}</span>
              )}
            </div>

            <div className="payment-qr-panel-body">
              <div className="payment-qr-preview-wrap">
                {currentQr ? (
                  <>
                    <img
                      src={currentQr}
                      alt="QR de pago"
                      className="payment-qr-img"
                      onClick={() => setQrZoomOpen(true)}
                      onError={() => handleQrImgError(adminCondoId)}
                      role="button"
                      tabIndex={0}
                      title="Ver QR ampliado"
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQrZoomOpen(true); } }}
                    />
                    <button
                      type="button"
                      className="payment-qr-download-btn"
                      onClick={() => handleDownloadQr(currentQr, activeCondo?.name)}
                      title="Descargar QR"
                      aria-label="Descargar QR"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  </>
                ) : (
                  <div className="payment-qr-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                      <line x1="14" y1="14" x2="20" y2="20"/><line x1="20" y1="14" x2="14" y2="20"/>
                    </svg>
                    <p>Sin QR configurado</p>
                  </div>
                )}
              </div>

              <div className="payment-qr-actions">
                <p className="payment-qr-hint">
                  {isSuperAdministrator
                    ? 'Subí la imagen del QR de pago de cualquier condominio, o reemplazá/eliminá el que ya tenga configurado.'
                    : 'Subí la imagen del QR de tu billetera o cuenta bancaria. Los residentes del condominio lo verán al hacer un pago.'}
                </p>

                <label className="btn btn-primary payment-qr-upload-btn" style={{cursor: qrUploadLoading ? 'not-allowed' : 'pointer', opacity: qrUploadLoading ? 0.7 : 1}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {qrUploadLoading ? 'Subiendo…' : currentQr ? 'Reemplazar QR' : 'Subir QR'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{display:'none'}}
                    disabled={qrUploadLoading || !adminCondoId}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadPaymentQr(adminCondoId, file);
                      e.target.value = '';
                    }}
                  />
                </label>

                {currentQr && (
                  <button
                    type="button"
                    className="btn btn-secondary payment-qr-delete-btn"
                    disabled={qrUploadLoading}
                    onClick={() => askConfirm('¿Eliminar el QR de pago?', () => handleDeletePaymentQr(adminCondoId))}
                  >
                    Eliminar QR
                  </button>
                )}

                {qrUploadMsg === 'success' && <p className="payment-qr-msg payment-qr-msg-ok">QR actualizado correctamente.</p>}
                {qrUploadMsg === 'deleted' && <p className="payment-qr-msg payment-qr-msg-ok">QR eliminado.</p>}
                {qrUploadMsg.startsWith('error:') && <p className="payment-qr-msg payment-qr-msg-err">{qrUploadMsg.replace('error:', '')}</p>}
              </div>
            </div>
          </section>

          {qrZoomOpen && currentQr && (
            <div className="qr-zoom-overlay" onClick={() => setQrZoomOpen(false)}>
              <div className="qr-zoom-content" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="qr-zoom-close" onClick={() => setQrZoomOpen(false)} aria-label="Cerrar">✕</button>
                <img src={currentQr} alt="QR de pago ampliado" className="qr-zoom-img" />
              </div>
            </div>
          )}
          </>
        );
      })()}

      {/* ── Panel Gestión de Expensas ── */}
      {(() => {
        const adminCondoId = isSuperAdministrator
          ? (qrSelectedCondoId || (condominiosData[0] ? String(condominiosData[0].id) : ''))
          : String(condominiosData.find(c => c.name === user.condo)?.id || '');
        const activeCondo = condominiosData.find(c => String(c.id) === adminCondoId);

        const condoPropiedades = propiedadesData.filter(p =>
          isSuperAdministrator ? p.condo === activeCondo?.name : p.condo === user.condo
        );
        const filteredProps = cargoExtraSearch.trim()
          ? condoPropiedades.filter(p =>
              p.code?.toLowerCase().includes(cargoExtraSearch.toLowerCase()) ||
              p.owner?.toLowerCase().includes(cargoExtraSearch.toLowerCase()) ||
              getPropertyTenantsText(p).toLowerCase().includes(cargoExtraSearch.toLowerCase())
            )
          : condoPropiedades;

        const expensasTotalPages = Math.max(1, Math.ceil(filteredProps.length / EXPENSAS_PAGE_SIZE));
        const pagedProps = filteredProps.slice((expensasPage - 1) * EXPENSAS_PAGE_SIZE, expensasPage * EXPENSAS_PAGE_SIZE);
        const goToExpensasPage = (p) => {
          setExpensasPage(p);
          expensasMgmtRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        const allFilteredSelected = filteredProps.length > 0 && filteredProps.every(p => expensasSelectedIds.has(p.id));

        const toggleAll = () => {
          if (allFilteredSelected) {
            setExpensasSelectedIds(prev => { const s = new Set(prev); filteredProps.forEach(p => s.delete(p.id)); return s; });
          } else {
            setExpensasSelectedIds(prev => { const s = new Set(prev); filteredProps.forEach(p => s.add(p.id)); return s; });
          }
        };

        const toggleOne = (id) => {
          setExpensasSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
        };

        return (
          <section className="expensas-mgmt-panel" ref={expensasMgmtRef}>
            <button type="button" className="expensas-mgmt-header expensas-mgmt-header-toggle" onClick={() => setExpensasCollapsed(c => !c)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,flexShrink:0}}>
                <path d="M12 3V21M16.5 7.5C16.5 6.1 15 5 12.8 5H11.2C9 5 7.5 6.1 7.5 7.5C7.5 8.9 9 10 11.2 10H12.8C15 10 16.5 11.1 16.5 12.5C16.5 13.9 15 15 12.8 15H11.2C9 15 7.5 13.9 7.5 12.5" />
              </svg>
              <span>Gestión de Expensas</span>
              {activeCondo && <span className="payment-qr-condo-badge">{activeCondo.type}: {activeCondo.name}</span>}
              <svg className={`expensas-mgmt-chevron${expensasCollapsed ? '' : ' expensas-mgmt-chevron-open'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>

            {!expensasCollapsed && (
            <>
            {/* Monto + asignación */}
            <div className="expensas-asignar-row">
              <div className="expensas-monto-field">
                <p className="expensas-base-label">Monto a sumar</p>
                <div className="expensas-base-edit">
                  <span style={{fontWeight:600,color:'#374151'}}>Bs.</span>
                  <input
                    type="number"
                    min="0"
                    className="expensas-base-input"
                    placeholder="0"
                    value={expensasInputVal}
                    onChange={e => { setExpensasInputVal(e.target.value); setExpensasMsg(''); }}
                  />
                </div>
                <p style={{margin:'0.3rem 0 0',fontSize:'0.72rem',color:'#6b7280'}}>Se suma a lo que la propiedad ya tenía asignado.</p>
              </div>
              <div style={{flex:1,minWidth:160}}>
                <p className="expensas-base-label">Seleccionados</p>
                <p style={{margin:0,fontWeight:700,fontSize:'1rem',color:'#4f46e5'}}>{expensasSelectedIds.size} de {condoPropiedades.length} propiedades</p>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.4rem',alignItems:'flex-start'}}>
                <button
                  className="btn btn-primary"
                  disabled={expensasLoading || !expensasInputVal || expensasSelectedIds.size === 0}
                  onClick={() => handleSaveExpensas(adminCondoId)}
                  style={{whiteSpace:'nowrap'}}
                >
                  {expensasLoading ? 'Asignando…' : `Asignar a ${expensasSelectedIds.size} propiedad${expensasSelectedIds.size !== 1 ? 'es' : ''}`}
                </button>
                {expensasMsg === 'ok' && <p style={{color:'#16a34a',fontSize:'0.8rem',margin:0}}>Asignado correctamente.</p>}
                {expensasMsg.startsWith('error:') && <p style={{color:'#dc2626',fontSize:'0.8rem',margin:0}}>{expensasMsg.replace('error:','')}</p>}
              </div>
            </div>

            {/* Búsqueda y lista */}
            <div className="expensas-props-section">
              <div style={{display:'flex',gap:'0.6rem',alignItems:'center',marginBottom:'0.75rem',flexWrap:'wrap'}}>
                <div className="expensas-search-row" style={{flex:1}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16,color:'#9ca3af',flexShrink:0}}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    className="expensas-search-input"
                    placeholder="Buscar por unidad, propietario o inquilino…"
                    value={cargoExtraSearch}
                    onChange={e => setCargoExtraSearch(e.target.value)}
                  />
                </div>
              </div>

              {condoPropiedades.length === 0 ? (
                <p style={{color:'#9ca3af',fontSize:'0.85rem',textAlign:'center',padding:'1rem 0'}}>No hay propiedades registradas en este condominio.</p>
              ) : (
                <>
                  {/* Tabla — pantallas anchas (desktop/tablet) */}
                  <div className="expensas-props-table-wrap">
                    <table className="expensas-props-table">
                      <thead>
                        <tr>
                          <th style={{width:36}}>
                            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} title="Seleccionar todos" />
                          </th>
                          <th>Unidad</th>
                          <th>Propietario</th>
                          <th>Inquilino</th>
                          <th>Expensa actual</th>
                          <th>Cargo extra</th>
                          <th>Total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedProps.map(p => {
                          const expensaActual = Number(p.expensaMensual) || 0;
                          const cargoExtra    = Number(p.cargoExtra)     || 0;
                          const total         = expensaActual + cargoExtra;
                          const isChecked     = expensasSelectedIds.has(p.id);
                          return (
                            <tr key={p.id} className={isChecked ? 'expensas-row-selected' : ''}>
                              <td>
                                <input type="checkbox" checked={isChecked} onChange={() => toggleOne(p.id)} />
                              </td>
                              <td><strong>{p.code}</strong>{p.block ? <span style={{color:'#9ca3af',fontSize:'0.78rem'}}> · {p.block}</span> : ''}</td>
                              <td>{p.owner || '—'}</td>
                              <td style={{color:'#6b7280'}}>{getPropertyTenantsText(p) !== '-' ? getPropertyTenantsText(p) : '—'}</td>
                              <td>
                                {editingExpensaId === p.id ? (
                                  <div style={{display:'flex',gap:'0.3rem',alignItems:'center'}}>
                                    <input type="number" min="0" className="expensas-base-input" style={{width:80}} placeholder="+ Bs." value={expensaEditVal} onChange={e => setExpensaEditVal(e.target.value)} autoFocus />
                                    <button className="btn btn-primary" style={{padding:'0.2rem 0.6rem',fontSize:'0.78rem'}} disabled={expensaEditLoading} onClick={() => handleSaveExpensaActual(p.id, adminCondoId)}>
                                      {expensaEditLoading ? '…' : 'OK'}
                                    </button>
                                    <button className="btn btn-secondary" style={{padding:'0.2rem 0.6rem',fontSize:'0.78rem'}} onClick={() => setEditingExpensaId(null)}>✕</button>
                                  </div>
                                ) : (
                                  <span
                                    className={`expensas-editable-value${expensaActual > 0 ? ' expensas-value-set' : ''}`}
                                    title="Click para sumar un monto a la expensa de esta propiedad"
                                    onClick={() => { setEditingExpensaId(p.id); setExpensaEditVal(''); }}
                                  >
                                    {expensaActual > 0 ? `Bs. ${expensaActual.toLocaleString()}` : '—'}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span
                                  className="expensas-editable-value"
                                  title="Click para ver y gestionar los cargos extra de esta propiedad"
                                  onClick={() => setCargoExtraModalProp(p)}
                                  style={{color: cargoExtra > 0 ? '#dc2626' : '#9ca3af', fontWeight: cargoExtra > 0 ? 700 : 400}}
                                >
                                  {cargoExtra > 0 ? `Bs. ${cargoExtra.toLocaleString()}` : '—'}
                                  {p.notaCargo && <span style={{display:'block',fontSize:'0.72rem',color:'#9ca3af'}}>{p.notaCargo}</span>}
                                </span>
                              </td>
                              <td><strong>{total > 0 ? `Bs. ${total.toLocaleString()}` : '—'}</strong></td>
                              <td>
                                <button className="expensas-edit-btn" onClick={() => setCargoExtraModalProp(p)}>
                                  + Cargo extra
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Tarjetas — mobile: nada que deslizar, todo en columna */}
                  <div className="expensas-props-cards">
                    {pagedProps.map(p => {
                      const expensaActual = Number(p.expensaMensual) || 0;
                      const cargoExtra    = Number(p.cargoExtra)     || 0;
                      const total         = expensaActual + cargoExtra;
                      const isChecked     = expensasSelectedIds.has(p.id);
                      return (
                        <div key={p.id} className={`expensas-prop-card${isChecked ? ' expensas-row-selected' : ''}`}>
                          <div className="expensas-prop-card-head">
                            <input type="checkbox" checked={isChecked} onChange={() => toggleOne(p.id)} />
                            <div>
                              <strong>{p.code}</strong>{p.block ? <span style={{color:'#9ca3af',fontSize:'0.78rem'}}> · {p.block}</span> : ''}
                              <span className="expensas-prop-card-owner">{p.owner || '—'}</span>
                            </div>
                          </div>

                          <div className="expensas-prop-card-row">
                            <span className="expensas-prop-card-label">Inquilino</span>
                            <span style={{color:'#6b7280'}}>{getPropertyTenantsText(p) !== '-' ? getPropertyTenantsText(p) : '—'}</span>
                          </div>

                          <div className="expensas-prop-card-row">
                            <span className="expensas-prop-card-label">Expensa actual</span>
                            {editingExpensaId === p.id ? (
                              <div style={{display:'flex',gap:'0.3rem',alignItems:'center'}}>
                                <input type="number" min="0" className="expensas-base-input" style={{width:80}} placeholder="+ Bs." value={expensaEditVal} onChange={e => setExpensaEditVal(e.target.value)} autoFocus />
                                <button className="btn btn-primary" style={{padding:'0.2rem 0.6rem',fontSize:'0.78rem'}} disabled={expensaEditLoading} onClick={() => handleSaveExpensaActual(p.id, adminCondoId)}>
                                  {expensaEditLoading ? '…' : 'OK'}
                                </button>
                                <button className="btn btn-secondary" style={{padding:'0.2rem 0.6rem',fontSize:'0.78rem'}} onClick={() => setEditingExpensaId(null)}>✕</button>
                              </div>
                            ) : (
                              <span
                                className={`expensas-editable-value${expensaActual > 0 ? ' expensas-value-set' : ''}`}
                                onClick={() => { setEditingExpensaId(p.id); setExpensaEditVal(''); }}
                              >
                                {expensaActual > 0 ? `Bs. ${expensaActual.toLocaleString()}` : '—'}
                              </span>
                            )}
                          </div>

                          <div className="expensas-prop-card-row">
                            <span className="expensas-prop-card-label">Cargo extra</span>
                            <span
                              className="expensas-editable-value"
                              onClick={() => setCargoExtraModalProp(p)}
                              style={{color: cargoExtra > 0 ? '#dc2626' : '#9ca3af', fontWeight: cargoExtra > 0 ? 700 : 400, textAlign:'right'}}
                            >
                              {cargoExtra > 0 ? `Bs. ${cargoExtra.toLocaleString()}` : '—'}
                              {p.notaCargo && <span style={{display:'block',fontSize:'0.72rem',color:'#9ca3af',fontWeight:400}}>{p.notaCargo}</span>}
                            </span>
                          </div>

                          <div className="expensas-prop-card-row expensas-prop-card-total">
                            <span className="expensas-prop-card-label">Total</span>
                            <strong>{total > 0 ? `Bs. ${total.toLocaleString()}` : '—'}</strong>
                          </div>

                          <button className="expensas-edit-btn expensas-prop-card-btn" onClick={() => setCargoExtraModalProp(p)}>
                            + Cargo extra
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <Pagination page={expensasPage} totalPages={expensasTotalPages} onPageChange={goToExpensasPage} />
                </>
              )}
            </div>
            </>
            )}
          </section>
        );
      })()}

      <section className="pagos-kpi-grid">
        <article className="pagos-kpi pagos-kpi-pending">
          <div className="pagos-kpi-head">
            <p>Pagos Pendientes</p>
            <span className="pagos-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 8V12L15 14M3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <strong>{pendingPaymentsCount}</strong>
          <small>esperando aprobacion</small>
        </article>

        <article className="pagos-kpi pagos-kpi-approved">
          <div className="pagos-kpi-head">
            <p>Total Aprobado</p>
            <span className="pagos-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3V21M16.5 7.5C16.5 6.1 15 5 12.8 5H11.2C9 5 7.5 6.1 7.5 7.5C7.5 8.9 9 10 11.2 10H12.8C15 10 16.5 11.1 16.5 12.5C16.5 13.9 15 15 12.8 15H11.2C9 15 7.5 13.9 7.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <strong>${approvedPaymentsTotal}</strong>
          <small>monto confirmado</small>
        </article>

        <article className="pagos-kpi pagos-kpi-total">
          <div className="pagos-kpi-head">
            <p>Total Pagos</p>
            <span className="pagos-kpi-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 13L10 16L17 9M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <strong>{totalPaymentsCount}</strong>
          <small>registros totales</small>
        </article>
      </section>

      <section className="pagos-tabs-wrap">
        <div className="pagos-search-wrap">
          <svg className="pagos-search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 16C13.3 16 16 13.3 16 10C16 6.7 13.3 4 10 4C6.7 4 4 6.7 4 10C4 13.3 6.7 16 10 16ZM18 18L14.3 14.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="text"
            className="pagos-search-input"
            placeholder="Buscar por propiedad, propietario, tipo o fecha..."
            value={paymentSearchTerm}
            onChange={(e) => setPaymentSearchTerm(e.target.value)}
          />
        </div>

        <div className="pagos-tabs">
          <button type="button" className={`pagos-tab${paymentTab === "todos" ? " pagos-tab-active" : ""}`} onClick={() => setPaymentTab("todos")}>Todos</button>
          <button type="button" className={`pagos-tab${paymentTab === "pendiente" ? " pagos-tab-active" : ""}`} onClick={() => setPaymentTab("pendiente")}>Pendientes</button>
          <button type="button" className={`pagos-tab${paymentTab === "aprobado" ? " pagos-tab-active" : ""}`} onClick={() => setPaymentTab("aprobado")}>Aprobados</button>
          <button type="button" className={`pagos-tab${paymentTab === "rechazado" ? " pagos-tab-active" : ""}`} onClick={() => setPaymentTab("rechazado")}>Rechazados</button>
        </div>

        <div className="pagos-tabs pagos-tabs-tipo">
          <button type="button" className={`pagos-tab${paymentTipoFilter === "todos" ? " pagos-tab-active" : ""}`} onClick={() => setPaymentTipoFilter("todos")}>Todos los tipos</button>
          <button type="button" className={`pagos-tab${paymentTipoFilter === "Expensa" ? " pagos-tab-active" : ""}`} onClick={() => setPaymentTipoFilter("Expensa")}>💰 Expensas</button>
          <button type="button" className={`pagos-tab${paymentTipoFilter === "Reserva" ? " pagos-tab-active" : ""}`} onClick={() => setPaymentTipoFilter("Reserva")}>📅 Reservas</button>
        </div>

        <div className="pagos-condo-filter-wrap">
          <div className="condo-dropdown pagos-condo-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaymentCondoDropdownOpen(false); }} tabIndex={-1}>
            <button
              type="button"
              className="condo-dropdown-trigger pagos-condo-trigger"
              onClick={() => setPaymentCondoDropdownOpen((open) => !open)}
              aria-expanded={paymentCondoDropdownOpen}
            >
              <span className="condo-dropdown-value">
                {paymentCondoFilter === "todos"
                  ? "Todos los condominios y edificios"
                  : (condominiosData.find((item) => String(item.id) === paymentCondoFilter)?.name || "Todos los condominios y edificios")}
              </span>
              <svg className={`condo-dropdown-chevron${paymentCondoDropdownOpen ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {paymentCondoDropdownOpen && (
              <ul className="condo-dropdown-list pagos-condo-list" role="listbox">
                <li
                  role="option"
                  aria-selected={paymentCondoFilter === "todos"}
                  className={`condo-dropdown-item${paymentCondoFilter === "todos" ? " selected" : ""}`}
                  onMouseDown={() => { setPaymentCondoFilter("todos"); setPaymentCondoDropdownOpen(false); }}
                >
                  Todos los condominios y edificios
                </li>
                {condominiosData.map((item) => (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={paymentCondoFilter === String(item.id)}
                    className={`condo-dropdown-item${paymentCondoFilter === String(item.id) ? " selected" : ""}`}
                    onMouseDown={() => { setPaymentCondoFilter(String(item.id)); setPaymentCondoDropdownOpen(false); }}
                  >
                    {item.type}: {item.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="pagos-table-wrap">
        <table className="pagos-table">
          <thead>
            <tr>
              <th>Propiedad</th>
              <th>Propietario</th>
              <th>Tipo</th>
              <th>Monto</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Cargando...</td></tr>
            ) : pageData.data.length === 0 ? (
              <tr><td colSpan={7}>No se encontraron pagos.</td></tr>
            ) : pageData.data.map((item) => (
              <tr key={item.id} className="pagos-row-clickable"
                onClick={() => { setReviewingPagoId(item.id); setReviewCumplio(null); setReviewMontoReal(''); }}>
                <td>{item.propiedad}</td>
                <td>{item.propietario}</td>
                <td>
                  <span className={`pagos-type-chip ${item.tipo.toLowerCase() === "reserva" ? "pagos-type-reserva" : "pagos-type-expensa"}`}>
                    {item.tipo}
                  </span>
                </td>
                <td>Bs. {item.monto}</td>
                <td>{item.fecha}</td>
                <td>
                  <span className={`pagos-status-chip pagos-status-${item.estado}`}>
                    {item.estado}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="pagos-actions">
                    {item.comprobante && (
                      <a
                        href={item.comprobante?.startsWith('http') ? item.comprobante : api.getUploadUrl(`comprobantes/${item.comprobante}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pagos-action-btn pagos-action-view"
                        title="Ver comprobante"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8"/>
                        </svg>
                      </a>
                    )}
                    {item.estado === "pendiente" && (
                      <button type="button" className="pagos-action-btn pagos-action-approve" title="Revisar pago"
                        onClick={() => { setReviewingPagoId(item.id); setReviewCumplio(null); setReviewMontoReal(''); }}
                        style={{fontSize:'0.72rem',width:'auto',padding:'0 0.5rem',gap:'0.25rem',display:'flex',alignItems:'center'}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}>
                          <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        Revisar
                      </button>
                    )}
                    {item.estado === "pendiente" && (
                      <button type="button" className="pagos-action-btn pagos-action-reject" title="Rechazar"
                        onClick={() => updatePaymentStatus(item.id, "rechazado")}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6L18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    )}
                    {item.estado !== "pendiente" && !item.comprobante && (
                      <span className="pagos-actions-empty">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Pagination page={page} totalPages={pageData.totalPages} onPageChange={setPage} />

      {(() => {
        const reviewingItem = pageData.data.find(i => String(i.id) === String(reviewingPagoId));
        if (!reviewingItem) return null;
        const total = getExpensaTotal(reviewingItem);
        const saldo = reviewMontoReal ? Math.max(0, total - parseFloat(reviewMontoReal)) : 0;
        return (
          <div className="modal-overlay" onClick={closeReviewModal}>
            <div className="modal-content modal-edit-user" onClick={e => e.stopPropagation()}>
              <h2>Revisar pago</h2>
              <div className="modal-body-simple">
                <div className="propiedad-line-item"><span>Propiedad</span><strong>{reviewingItem.propiedad}</strong></div>
                <div className="propiedad-line-item"><span>Propietario</span><strong>{reviewingItem.propietario}</strong></div>
                <div className="propiedad-line-item">
                  <span>Tipo</span>
                  <span className={`pagos-type-chip ${reviewingItem.tipo.toLowerCase() === "reserva" ? "pagos-type-reserva" : "pagos-type-expensa"}`}>
                    {reviewingItem.tipo}
                  </span>
                </div>
                <div className="propiedad-line-item"><span>Monto</span><strong>Bs. {reviewingItem.monto}</strong></div>
                <div className="propiedad-line-item"><span>Fecha</span><strong>{reviewingItem.fecha}</strong></div>
                {reviewingItem.motivo && (
                  <div className="propiedad-line-item"><span>Motivo</span><strong>{reviewingItem.motivo}</strong></div>
                )}
                <div className="propiedad-line-item">
                  <span>Estado</span>
                  <span className={`pagos-status-chip pagos-status-${reviewingItem.estado}`}>{reviewingItem.estado}</span>
                </div>

                <div className="pago-comprobante-wrap">
                  <span className="pago-comprobante-label">Comprobante</span>
                  {reviewingItem.comprobante ? (
                    (() => {
                      const url = reviewingItem.comprobante?.startsWith('http')
                        ? reviewingItem.comprobante
                        : api.getUploadUrl(`comprobantes/${reviewingItem.comprobante}`);
                      const isPdf = url.toLowerCase().endsWith('.pdf');
                      return isPdf ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary pago-comprobante-pdf-link">
                          Ver comprobante (PDF)
                        </a>
                      ) : (
                        <img src={url} alt="Comprobante de pago" className="pago-comprobante-img"
                          onClick={() => setComprobanteZoomUrl(url)} title="Ver comprobante completo" />
                      );
                    })()
                  ) : (
                    <p className="pago-comprobante-empty">Sin comprobante adjunto.</p>
                  )}
                </div>

                {reviewingItem.estado === 'pendiente' && (
                  <>
                    <hr className="pago-revisar-divider" />

                    <p className="pago-revisar-label">
                      ¿El propietario cumplió con el monto total?
                      <strong style={{marginLeft:'0.5rem',color:'#374151'}}>Bs. {total.toLocaleString()}</strong>
                    </p>
                    <div className="pago-revisar-toggle">
                      <button className={`pago-revisar-btn${reviewCumplio === 'si' ? ' active-si' : ''}`} disabled={reviewLoading}
                        onClick={() => handleClickSiCumplio(reviewingItem)}>✓ Sí, cumplió</button>
                      <button className={`pago-revisar-btn${reviewCumplio === 'no' ? ' active-no' : ''}`} disabled={reviewLoading}
                        onClick={() => handleClickNoCumplio(reviewingItem)}>✗ No cumplió</button>
                    </div>

                    {reviewCumplio === 'no' && (
                      <div className="pago-revisar-monto">
                        <label>¿Cuánto pagó realmente?</label>
                        <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                          <span style={{fontWeight:600,color:'#374151'}}>Bs.</span>
                          <input type="number" min="0" className="expensas-base-input" placeholder="0" value={reviewMontoReal}
                            onChange={e => setReviewMontoReal(e.target.value)} autoFocus />
                        </div>
                        {reviewMontoReal && saldo > 0 && (
                          <p style={{margin:'0.3rem 0 0',fontSize:'0.82rem',color:'#dc2626',fontWeight:600}}>
                            Saldo restante: Bs. {saldo.toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              <footer className="modal-footer-simple">
                {reviewCumplio === 'no' && (
                  <button className="btn btn-primary" disabled={!reviewMontoReal || reviewLoading}
                    onClick={() => handleConfirmNoCumplio(reviewingItem)}>
                    {reviewLoading ? 'Guardando…' : 'Confirmar'}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={closeReviewModal}>
                  {reviewingItem.estado === 'pendiente' ? 'Cancelar' : 'Cerrar'}
                </button>
              </footer>
            </div>
          </div>
        );
      })()}

      {comprobanteZoomUrl && (
        <div className="qr-zoom-overlay" onClick={() => setComprobanteZoomUrl(null)}>
          <div className="qr-zoom-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="qr-zoom-close" onClick={() => setComprobanteZoomUrl(null)} aria-label="Cerrar">✕</button>
            <img src={comprobanteZoomUrl} alt="Comprobante de pago ampliado" className="qr-zoom-img" />
          </div>
        </div>
      )}

      {confirmPrompt && (
        <div className="modal-overlay modal-overlay-centered" onClick={() => setConfirmPrompt(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-modal-icon" aria-hidden="true">?</div>
            <h2>¿Estás seguro?</h2>
            <p>{confirmPrompt.message}</p>
            <div className="confirm-modal-actions">
              <button type="button" className="confirm-modal-cancel" onClick={() => setConfirmPrompt(null)}>Cancelar</button>
              <button type="button" className="confirm-modal-accept" onClick={() => { confirmPrompt.onAccept(); setConfirmPrompt(null); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {cargoExtraModalProp && (
        <div className="modal-overlay modal-overlay-centered" onClick={() => { setCargoExtraModalProp(null); setEditingCargoItemId(null); setNewCargoMonto(''); setNewCargoMotivo(''); }}>
          <div className="confirm-modal cargo-extra-modal" onClick={e => e.stopPropagation()}>
            <h2>Cargos extra — {cargoExtraModalProp.code}{cargoExtraModalProp.block ? ` · ${cargoExtraModalProp.block}` : ''}</h2>
            <div className="cargo-extra-list">
              {(cargoExtraModalProp.cargosExtraList || []).length === 0 ? (
                <p className="cargo-extra-empty">Sin cargos extra todavía.</p>
              ) : cargoExtraModalProp.cargosExtraList.map(c => (
                <div key={c.id} className="cargo-extra-item">
                  {editingCargoItemId === c.id ? (
                    <>
                      <input type="number" min="0" className="expensas-base-input" style={{width:80}} value={editCargoMonto} onChange={e => setEditCargoMonto(e.target.value)} autoFocus />
                      <input type="text" className="expensas-base-input" style={{flex:1}} placeholder="Motivo" value={editCargoMotivo} onChange={e => setEditCargoMotivo(e.target.value)} />
                      <button className="btn btn-primary" style={{padding:'0.25rem 0.55rem',fontSize:'0.75rem'}} disabled={cargoExtraLoading} onClick={() => handleEditCargoExtra(cargoExtraModalProp.id, c.id)}>OK</button>
                      <button className="btn btn-secondary" style={{padding:'0.25rem 0.55rem',fontSize:'0.75rem'}} onClick={() => setEditingCargoItemId(null)}>✕</button>
                    </>
                  ) : (
                    <>
                      <div className="cargo-extra-item-info">
                        <strong>Bs. {Number(c.monto).toLocaleString()}</strong>
                        {c.motivo && <span>{c.motivo}</span>}
                      </div>
                      <button className="expensas-edit-btn" onClick={() => { setEditingCargoItemId(c.id); setEditCargoMonto(String(c.monto)); setEditCargoMotivo(c.motivo || ''); }}>Editar</button>
                      <button type="button" className="anuncio-action-btn anuncio-action-delete" title="Borrar" onClick={() => handleDeleteCargoExtra(cargoExtraModalProp.id, c.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM8 9H16V19H8V9ZM15.5 4L14.5 3H9.5L8.5 4H5V6H19V4H15.5Z"/></svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="cargo-extra-add-row">
              <input type="number" min="0" className="expensas-base-input" style={{width:80}} placeholder="+ Bs." value={newCargoMonto} onChange={e => setNewCargoMonto(e.target.value)} />
              <input type="text" className="expensas-base-input" style={{flex:1}} placeholder="Motivo (opcional)" value={newCargoMotivo} onChange={e => setNewCargoMotivo(e.target.value)} />
              <button className="btn btn-primary" disabled={cargoExtraLoading || !newCargoMonto} onClick={() => handleAddCargoExtra(cargoExtraModalProp.id)}>
                {cargoExtraLoading ? '…' : 'Agregar'}
              </button>
            </div>
            <div className="confirm-modal-actions">
              <button type="button" className="confirm-modal-cancel" onClick={() => { setCargoExtraModalProp(null); setEditingCargoItemId(null); setNewCargoMonto(''); setNewCargoMotivo(''); }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
