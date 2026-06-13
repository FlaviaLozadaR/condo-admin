import { Fragment, useEffect, useState } from "react";
import * as api from "../api.js";
import Pagination from "../components/Pagination.jsx";

const PAGE_SIZE = 20;

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
  const [paymentCondoFilter, setPaymentCondoFilter] = useState("todos");
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  // Panel QR de pago
  const [qrUploadLoading, setQrUploadLoading] = useState(false);
  const [qrUploadMsg, setQrUploadMsg] = useState('');
  const [qrSelectedCondoId, setQrSelectedCondoId] = useState('');
  const [qrCondoDropdownOpen, setQrCondoDropdownOpen] = useState(false);

  // Panel gestión de expensas
  const [expensasInputVal, setExpensasInputVal] = useState('');
  const [expensasLoading, setExpensasLoading] = useState(false);
  const [expensasMsg, setExpensasMsg] = useState('');
  const [expensasSelectedIds, setExpensasSelectedIds] = useState(new Set());
  const [cargoExtraSearch, setCargoExtraSearch] = useState('');
  const [editingCargoExtra, setEditingCargoExtra] = useState(null);
  const [cargoExtraVal, setCargoExtraVal] = useState('');
  const [cargoNotaVal, setCargoNotaVal] = useState('');
  const [cargoExtraLoading, setCargoExtraLoading] = useState(false);

  const selectedPaymentCondoName =
    paymentCondoFilter === "todos"
      ? ""
      : (condominiosData.find((condo) => String(condo.id) === paymentCondoFilter)?.name || "");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(paymentSearchTerm), 400);
    return () => clearTimeout(t);
  }, [paymentSearchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, paymentTab, selectedPaymentCondoName]);

  const fetchPage = (showLoading = true) => {
    if (showLoading) setLoading(true);
    return api.getPagosPaged({
      page,
      limit: PAGE_SIZE,
      estado: paymentTab,
      q: debouncedSearch,
      condo: selectedPaymentCondoName,
    })
      .then(setPageData)
      .catch((err) => onToast?.(err.message, "error"))
      .finally(() => { if (showLoading) setLoading(false); });
  };

  useEffect(() => {
    fetchPage();
  }, [page, paymentTab, debouncedSearch, selectedPaymentCondoName]);

  const pendingPaymentsCount  = pageData.totalPendientes;
  const approvedPaymentsTotal = pageData.approvedPaymentsTotal;
  const totalPaymentsCount    = pageData.totalPendientes + pageData.totalAprobados + pageData.totalRechazados;

  const handleExportPagos = async (format) => {
    const query = paymentSearchTerm.toLowerCase().trim();
    const toExport = pagosData.filter((item) => {
      const byCondo = !selectedPaymentCondoName || item.propiedad.toLowerCase().includes(selectedPaymentCondoName.toLowerCase());
      const byTab = paymentTab === "todos" || item.estado === paymentTab;
      const byQuery =
        !query ||
        item.propiedad.toLowerCase().includes(query) ||
        item.propietario.toLowerCase().includes(query) ||
        item.fecha.toLowerCase().includes(query) ||
        item.tipo.toLowerCase().includes(query);
      return byCondo && byTab && byQuery;
    });
    if (toExport.length === 0) { onToast?.("No hay pagos para exportar.", "warning"); return; }
    const date  = new Date().toISOString().slice(0, 10);
    const label = paymentTab === "todos" ? "todos" : paymentTab;
    const totalMonto = toExport.reduce((s, p) => s + (Number(p.monto) || 0), 0);

    if (format === "excel") {
      // xlsx se carga bajo demanda: pesa ~400KB y solo se necesita al exportar
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(toExport.map(p => ({
        Propiedad:   p.propiedad,
        Propietario: p.propietario,
        Tipo:        p.tipo,
        "Monto (Bs.)": p.monto,
        Fecha:       p.fecha,
        Estado:      p.estado,
      })));
      ws["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pagos");
      XLSX.writeFile(wb, `pagos_${label}_${date}.xlsx`);
      onToast?.(`${toExport.length} pagos exportados a Excel.`, "success");
    } else {
      exportToPDF({
        title:    `Reporte de Pagos — ${label.charAt(0).toUpperCase() + label.slice(1)}`,
        subtitle: `Generado el ${new Date().toLocaleDateString("es-AR")} · ${toExport.length} registros`,
        headers:  ["Propiedad", "Propietario", "Tipo", "Monto", "Fecha", "Estado"],
        rows:     toExport.map(p => [p.propiedad, p.propietario, p.tipo, `Bs. ${p.monto}`, p.fecha, p.estado]),
        totals:   ["", "", "", `Total: Bs. ${totalMonto.toLocaleString("es-AR")}`, "", ""],
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

  const handleSaveExpensas = async (condoId) => {
    const monto = parseFloat(expensasInputVal);
    if (isNaN(monto) || monto < 0 || expensasSelectedIds.size === 0) return;
    setExpensasLoading(true);
    setExpensasMsg('');
    try {
      await api.asignarExpensas(condoId, monto, [...expensasSelectedIds]);
      setPropiedadesData(prev => prev.map(p =>
        expensasSelectedIds.has(p.id) ? { ...p, expensaMensual: monto } : p
      ));
      setExpensasMsg('ok');
    } catch (e) {
      setExpensasMsg('error:' + e.message);
    } finally {
      setExpensasLoading(false);
    }
  };

  const handleSaveCargoExtra = async (propId) => {
    setCargoExtraLoading(true);
    try {
      await api.updateCargoExtra(propId, parseFloat(cargoExtraVal) || 0, cargoNotaVal);
      setPropiedadesData(prev => prev.map(p => String(p.id) === String(propId)
        ? { ...p, cargoExtra: parseFloat(cargoExtraVal) || 0, notaCargo: cargoNotaVal }
        : p
      ));
      setEditingCargoExtra(null);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setCargoExtraLoading(false);
    }
  };

  const updatePaymentStatus = async (id, status) => {
    try {
      await api.updatePagoStatus(String(id), status);
      setPagosData(prev => prev.map(item => String(item.id) === String(id) ? { ...item, estado: status } : item));
      setPageData(prev => ({ ...prev, data: prev.data.map(item => String(item.id) === String(id) ? { ...item, estado: status } : item) }));
      fetchPage(false);
    } catch (err) {
      console.error("Error actualizando pago:", err.message);
    }
  };

  const handleRevisarPago = async (pago) => {
    if (!reviewCumplio) return;
    setReviewLoading(true);
    try {
      const expensaTotal = (() => {
        const prop = propiedadesData.find(p => p.owner === pago.propietario || p.tenant === pago.propietario);
        return (Number(prop?.expensaMensual) || 0) + (Number(prop?.cargoExtra) || 0) || Number(pago.monto) || 0;
      })();

      if (reviewCumplio === 'si') {
        await api.updatePagoStatus(String(pago.id), 'aprobado');
        setPagosData(prev => prev.map(item => String(item.id) === String(pago.id) ? { ...item, estado: 'aprobado' } : item));
        setPageData(prev => ({ ...prev, data: prev.data.map(item => String(item.id) === String(pago.id) ? { ...item, estado: 'aprobado' } : item) }));
      } else {
        const montoReal     = Math.max(0, parseFloat(reviewMontoReal) || 0);
        const saldoRestante = Math.max(0, expensaTotal - montoReal);
        await api.updatePagoStatus(String(pago.id), 'aprobado', montoReal, saldoRestante,
          `Pago parcial: pagó Bs. ${montoReal}, saldo pendiente Bs. ${saldoRestante}`);
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

  return (
    <>
      <header className="dashboard-header dashboard-header-with-actions">
        <div>
          <h1>Gestion de Pagos</h1>
          <p>Administra los pagos de expensas y reservas</p>
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
      </header>

      {/* ── Panel QR de pago ── */}
      {(() => {
        const adminCondoId = isSuperAdministrator
          ? (qrSelectedCondoId || (condominiosData[0] ? String(condominiosData[0].id) : ''))
          : String(condominiosData.find(c => c.name === user.condo)?.id || '');
        const activeCondo  = condominiosData.find(c => String(c.id) === adminCondoId);
        const currentQr    = activeCondo?.paymentQrUrl || '';
        return (
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
                  <img src={currentQr} alt="QR de pago" className="payment-qr-img" />
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
                {isSuperAdministrator ? (
                  <p className="payment-qr-hint">
                    Podés consultar el QR de cada condominio. Solo el administrador designado puede subir o modificar el QR.
                  </p>
                ) : (
                  <>
                    <p className="payment-qr-hint">
                      Subí la imagen del QR de tu billetera o cuenta bancaria. Los residentes del condominio lo verán al hacer un pago.
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
                        onClick={() => { if (window.confirm('¿Eliminar el QR de pago?')) handleDeletePaymentQr(adminCondoId); }}
                      >
                        Eliminar QR
                      </button>
                    )}
                  </>
                )}

                {qrUploadMsg === 'success' && <p className="payment-qr-msg payment-qr-msg-ok">QR actualizado correctamente.</p>}
                {qrUploadMsg === 'deleted' && <p className="payment-qr-msg payment-qr-msg-ok">QR eliminado.</p>}
                {qrUploadMsg.startsWith('error:') && <p className="payment-qr-msg payment-qr-msg-err">{qrUploadMsg.replace('error:', '')}</p>}
              </div>
            </div>
          </section>
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
              p.tenant?.toLowerCase().includes(cargoExtraSearch.toLowerCase())
            )
          : condoPropiedades;

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
          <section className="expensas-mgmt-panel">
            <div className="expensas-mgmt-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,flexShrink:0}}>
                <path d="M12 3V21M16.5 7.5C16.5 6.1 15 5 12.8 5H11.2C9 5 7.5 6.1 7.5 7.5C7.5 8.9 9 10 11.2 10H12.8C15 10 16.5 11.1 16.5 12.5C16.5 13.9 15 15 12.8 15H11.2C9 15 7.5 13.9 7.5 12.5" />
              </svg>
              <span>Gestión de Expensas</span>
              {activeCondo && <span className="payment-qr-condo-badge">{activeCondo.type}: {activeCondo.name}</span>}
            </div>

            {/* Monto + asignación */}
            <div className="expensas-asignar-row">
              <div className="expensas-monto-field">
                <p className="expensas-base-label">Monto a asignar</p>
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
                      {filteredProps.map(p => {
                        const expensaActual = Number(p.expensaMensual) || 0;
                        const cargoExtra    = Number(p.cargoExtra)     || 0;
                        const total         = expensaActual + cargoExtra;
                        const isEditing     = editingCargoExtra === p.id;
                        const isChecked     = expensasSelectedIds.has(p.id);
                        return (
                          <tr key={p.id} className={isChecked ? 'expensas-row-selected' : ''}>
                            <td>
                              <input type="checkbox" checked={isChecked} onChange={() => toggleOne(p.id)} />
                            </td>
                            <td><strong>{p.code}</strong>{p.block ? <span style={{color:'#9ca3af',fontSize:'0.78rem'}}> · {p.block}</span> : ''}</td>
                            <td>{p.owner || '—'}</td>
                            <td style={{color:'#6b7280'}}>{p.tenant && p.tenant !== '-' ? p.tenant : '—'}</td>
                            <td>
                              <span style={{color: expensaActual > 0 ? '#101828' : '#9ca3af', fontWeight: expensaActual > 0 ? 700 : 400}}>
                                {expensaActual > 0 ? `Bs. ${expensaActual.toLocaleString()}` : '—'}
                              </span>
                            </td>
                            <td>
                              {isEditing ? (
                                <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
                                  <input type="number" min="0" className="expensas-base-input" style={{width:80}} value={cargoExtraVal} onChange={e => setCargoExtraVal(e.target.value)} autoFocus />
                                  <input type="text" className="expensas-base-input" placeholder="Motivo (opcional)" style={{width:140,fontSize:'0.78rem'}} value={cargoNotaVal} onChange={e => setCargoNotaVal(e.target.value)} />
                                  <div style={{display:'flex',gap:'0.3rem'}}>
                                    <button className="btn btn-primary" style={{padding:'0.2rem 0.6rem',fontSize:'0.78rem'}} disabled={cargoExtraLoading} onClick={() => handleSaveCargoExtra(p.id)}>
                                      {cargoExtraLoading ? '…' : 'OK'}
                                    </button>
                                    <button className="btn btn-secondary" style={{padding:'0.2rem 0.6rem',fontSize:'0.78rem'}} onClick={() => setEditingCargoExtra(null)}>✕</button>
                                  </div>
                                </div>
                              ) : (
                                <span style={{color: cargoExtra > 0 ? '#dc2626' : '#9ca3af', fontWeight: cargoExtra > 0 ? 700 : 400}}>
                                  {cargoExtra > 0 ? `Bs. ${cargoExtra.toLocaleString()}` : '—'}
                                  {p.notaCargo && <span style={{display:'block',fontSize:'0.72rem',color:'#9ca3af'}}>{p.notaCargo}</span>}
                                </span>
                              )}
                            </td>
                            <td><strong>{total > 0 ? `Bs. ${total.toLocaleString()}` : '—'}</strong></td>
                            <td>
                              {!isEditing && (
                                <button className="expensas-edit-btn" onClick={() => { setEditingCargoExtra(p.id); setCargoExtraVal(String(cargoExtra)); setCargoNotaVal(p.notaCargo || ''); }}>
                                  + Cargo extra
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
              <Fragment key={item.id}><tr>
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
                <td>
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
                    {item.estado === "pendiente" && reviewingPagoId !== item.id && (
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
              {reviewingPagoId === item.id && (
                <tr>
                  <td colSpan={6} style={{padding:0}}>
                    <div className="pago-revisar-panel">
                      <p className="pago-revisar-label">
                        ¿El propietario cumplió con el monto total?
                        <strong style={{marginLeft:'0.5rem',color:'#374151'}}>
                          Bs. {(() => {
                            const prop = propiedadesData.find(p => p.owner === item.propietario || p.tenant === item.propietario);
                            const total = (Number(prop?.expensaMensual) || 0) + (Number(prop?.cargoExtra) || 0);
                            return total > 0 ? total.toLocaleString() : Number(item.monto).toLocaleString();
                          })()}
                        </strong>
                      </p>
                      <div className="pago-revisar-toggle">
                        <button className={`pago-revisar-btn${reviewCumplio === 'si' ? ' active-si' : ''}`} onClick={() => { setReviewCumplio('si'); setReviewMontoReal(''); }}>✓ Sí, cumplió</button>
                        <button className={`pago-revisar-btn${reviewCumplio === 'no' ? ' active-no' : ''}`} onClick={() => setReviewCumplio('no')}>✗ No cumplió</button>
                      </div>
                      {reviewCumplio === 'no' && (
                        <div className="pago-revisar-monto">
                          <label>¿Cuánto pagó realmente?</label>
                          <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                            <span style={{fontWeight:600,color:'#374151'}}>Bs.</span>
                            <input type="number" min="0" className="expensas-base-input" placeholder="0" value={reviewMontoReal}
                              onChange={e => setReviewMontoReal(e.target.value)} autoFocus />
                          </div>
                          {reviewMontoReal && (() => {
                            const prop = propiedadesData.find(p => p.owner === item.propietario || p.tenant === item.propietario);
                            const total = (Number(prop?.expensaMensual) || 0) + (Number(prop?.cargoExtra) || 0) || Number(item.monto) || 0;
                            const saldo = Math.max(0, total - parseFloat(reviewMontoReal));
                            return saldo > 0 ? (
                              <p style={{margin:'0.3rem 0 0',fontSize:'0.82rem',color:'#dc2626',fontWeight:600}}>
                                Saldo restante: Bs. {saldo.toLocaleString()}
                              </p>
                            ) : null;
                          })()}
                        </div>
                      )}
                      <div style={{display:'flex',gap:'0.5rem',marginTop:'0.75rem'}}>
                        <button className="btn btn-primary" style={{fontSize:'0.82rem',padding:'0.3rem 0.9rem'}}
                          disabled={!reviewCumplio || (reviewCumplio === 'no' && !reviewMontoReal) || reviewLoading}
                          onClick={() => handleRevisarPago(item)}>
                          {reviewLoading ? 'Guardando…' : 'Confirmar'}
                        </button>
                        <button className="btn btn-secondary" style={{fontSize:'0.82rem',padding:'0.3rem 0.9rem'}}
                          onClick={() => { setReviewingPagoId(null); setReviewCumplio(null); setReviewMontoReal(''); }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <Pagination page={page} totalPages={pageData.totalPages} onPageChange={setPage} />
    </>
  );
}
