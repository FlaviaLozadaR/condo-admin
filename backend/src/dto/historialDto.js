class HistorialDTO {
  static fromRequest(body = {}) {
    const { visitante, visitorName, cedula, propiedad, unit, tipo, action, placa, guard, motivo, fecha, entrada, salida } = body;
    const now  = new Date();
    const horaActual  = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const fechaActual = now.toLocaleDateString('es-ES');
    return {
      visitante: visitante || visitorName || '',
      cedula:    cedula   || '',
      propiedad: propiedad || unit || '',
      tipo:      tipo     || action || 'peatonal',
      placa:     placa    || '-',
      guard:     guard    || '',
      motivo:    motivo   || '-',
      fecha:     fecha    || fechaActual,
      entrada:   entrada  || horaActual,
      salida:    salida   || '-',
    };
  }

  static toResponse(historial) {
    return { ...historial };
  }
}

module.exports = HistorialDTO;
