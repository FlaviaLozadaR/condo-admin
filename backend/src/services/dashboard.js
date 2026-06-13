const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DAYS      = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];

// Parse "16/4, 10:30" or ISO dates into a Date object
function parseDate(str) {
  if (!str) return null;
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1]);
    const month = parseInt(slashMatch[2]) - 1;
    return new Date(new Date().getFullYear(), month, day);
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function getLastNMonths(n) {
  const now = new Date();
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ label: MONTHS_ES[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
}

function monthlyPayments(pagos, filterFn, n = 4) {
  const months = getLastNMonths(n);
  return months.map(({ label, year, month }) => {
    const value = pagos
      .filter(p => filterFn(p) && p.estado === 'aprobado')
      .filter(p => {
        const d = parseDate(p.fecha);
        return d && d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, p) => s + Number(p.monto || 0), 0);
    return { label, value };
  });
}

function visitsByDay(historial, filterFn) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  historial.filter(filterFn).forEach(h => {
    const d = parseDate(h.entrada);
    if (d) counts[(d.getDay() + 6) % 7]++;
  });
  return DAYS.map((label, i) => ({ label, value: counts[i] }));
}

function incomeType(visitas, filterFn) {
  const filtered = visitas.filter(filterFn);
  const p = filtered.filter(v => v.mode === 'peatonal').length;
  const v = filtered.filter(v => v.mode === 'vehicular').length;
  const total = p + v;
  if (total === 0) return [{ label: 'Peatonal', value: 0 }, { label: 'Vehicular', value: 0 }];
  return [
    { label: 'Peatonal',  value: Math.round((p / total) * 100) },
    { label: 'Vehicular', value: Math.round((v / total) * 100) },
  ];
}

function isToday(str) {
  const d = parseDate(str);
  if (!d) return false;
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function computeDashboard(user, db) {
  const { propiedades = [], pagos = [], visitas = [], historialVisitas = [], panicAlerts = [] } = db;

  if (user.role === 'Super Admin') {
    const collected    = pagos.filter(p => p.estado === 'aprobado').reduce((s, p) => s + Number(p.monto || 0), 0);
    const totalDebt    = propiedades.reduce((s, p) => s + Number(p.debt || 0), 0);
    const debtorsCount = propiedades.filter(p => Number(p.debt) > 0).length;
    const topDebtors   = [...propiedades]
      .filter(p => Number(p.debt) > 0)
      .sort((a, b) => Number(b.debt) - Number(a.debt))
      .slice(0, 3)
      .map(p => ({ property: `${p.street} - ${p.code}`, block: p.block ? `Bloque ${p.block}` : '-', debt: `$${p.debt}` }));

    return {
      kpis: [
        { label: 'Total Propiedades', value: propiedades.length,                        tone: 'primary' },
        { label: 'Cobrado Este Mes',  value: `$${collected.toLocaleString('es-ES')}`,  tone: 'success' },
        { label: 'En Mora',           value: `$${totalDebt.toLocaleString('es-ES')}`,  tone: 'danger'  },
        { label: 'Morosos',           value: debtorsCount,                              tone: 'warning' },
      ],
      monthlyPayments: monthlyPayments(pagos, () => true),
      visitsByDay:     visitsByDay(historialVisitas, () => true),
      incomeType:      incomeType(visitas, () => true),
      debtors:         topDebtors,
    };
  }

  if (user.role === 'Administrador') {
    const condo   = user.condo || '';
    const cProps  = propiedades.filter(p => !condo || p.condo === condo || p.street === condo);
    const cPagos  = pagos.filter(p => !condo || (p.propiedad || '').toLowerCase().includes(condo.toLowerCase()));
    const cVisitas = visitas.filter(v => !condo || (v.property || '').toLowerCase().includes(condo.toLowerCase()));
    const cHistorial = historialVisitas.filter(h => !condo || (h.propiedad || '').toLowerCase().includes(condo.toLowerCase()));
    const collected = cPagos.filter(p => p.estado === 'aprobado').reduce((s, p) => s + Number(p.monto || 0), 0);
    const totalDebt = cProps.reduce((s, p) => s + Number(p.debt || 0), 0);
    const topDebtors = [...cProps]
      .filter(p => Number(p.debt) > 0)
      .sort((a, b) => Number(b.debt) - Number(a.debt))
      .slice(0, 3)
      .map(p => ({ property: `${p.street} - ${p.code}`, block: p.block ? `Bloque ${p.block}` : '-', debt: `$${p.debt}` }));

    return {
      kpis: [
        { label: 'Total Propiedades', value: cProps.length,                             tone: 'primary' },
        { label: 'Cobrado Este Mes',  value: `$${collected.toLocaleString('es-ES')}`,  tone: 'success' },
        { label: 'En Mora',           value: `$${totalDebt.toLocaleString('es-ES')}`,  tone: 'danger'  },
        { label: 'Morosos',           value: cProps.filter(p => Number(p.debt) > 0).length, tone: 'warning' },
      ],
      monthlyPayments: monthlyPayments(cPagos, () => true),
      visitsByDay:     visitsByDay(cHistorial, () => true),
      incomeType:      incomeType(cVisitas, () => true),
      debtors:         topDebtors,
    };
  }

  if (user.role === 'Propietario') {
    const myProps  = propiedades.filter(p => p.owner === user.name);
    const myPagos  = pagos.filter(p => p.propietario === user.name || p.propiedad === user.property);
    const myVisitas = visitas.filter(v => v.property === user.property);
    const paid     = myPagos.filter(p => p.estado === 'aprobado').reduce((s, p) => s + Number(p.monto || 0), 0);
    const pending  = myPagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + Number(p.monto || 0), 0);

    return {
      kpis: [
        { label: 'Mis Propiedades',     value: myProps.length || 1,  tone: 'primary' },
        { label: 'Pagado Este Mes',     value: `$${paid}`,           tone: 'success' },
        { label: 'Saldo Pendiente',     value: `$${pending}`,        tone: 'danger'  },
        { label: 'Visitas Registradas', value: myVisitas.length,     tone: 'warning' },
      ],
      monthlyPayments: monthlyPayments(myPagos, () => true),
      visitsByDay:     visitsByDay(historialVisitas, h => h.propiedad === user.property),
      incomeType:      incomeType(myVisitas, () => true),
      debtors: [],
    };
  }

  if (user.role === 'Inquilino') {
    const unit     = user.property ? (user.property.split(' - ')[1] || user.property) : '—';
    const myPagos  = pagos.filter(p => p.propietario === user.name || p.propiedad === user.property);
    const myVisitas = visitas.filter(v => v.property === user.property);
    const paid     = myPagos.filter(p => p.estado === 'aprobado').reduce((s, p) => s + Number(p.monto || 0), 0);
    const pending  = myPagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + Number(p.monto || 0), 0);
    const reservas = myPagos.filter(p => p.tipo === 'Reserva' && p.estado === 'pendiente').length;

    return {
      kpis: [
        { label: 'Unidad',        value: unit,         tone: 'primary' },
        { label: 'Pagado',        value: `$${paid}`,   tone: 'success' },
        { label: 'Pendiente',     value: `$${pending}`, tone: 'danger'  },
        { label: 'Reservas',      value: reservas,     tone: 'warning' },
      ],
      monthlyPayments: monthlyPayments(myPagos, () => true),
      visitsByDay:     visitsByDay(historialVisitas, h => h.propiedad === user.property),
      incomeType:      incomeType(myVisitas, () => true),
      debtors: [],
    };
  }

  if (user.role === 'Seguridad') {
    const visitasHoy    = historialVisitas.filter(h => isToday(h.entrada)).length;
    const qrValidados   = visitas.filter(v => v.status === 'Escaneado').length;
    const incidentes    = panicAlerts.filter(a => a.status === 'Pendiente').length;

    return {
      kpis: [
        { label: 'Visitas Hoy',  value: visitasHoy,  tone: 'success' },
        { label: 'QR Validados', value: qrValidados, tone: 'primary' },
        { label: 'Alertas',      value: incidentes,  tone: 'danger'  },
        { label: 'Total Visitas',value: historialVisitas.length, tone: 'warning' },
      ],
      monthlyPayments: MONTHS_ES.slice(-4).map(label => ({ label, value: 0 })),
      visitsByDay:     visitsByDay(historialVisitas, () => true),
      incomeType:      incomeType(visitas, () => true),
      debtors: [],
    };
  }

  return { kpis: [], monthlyPayments: [], visitsByDay: [], incomeType: [], debtors: [] };
}

module.exports = { computeDashboard };
