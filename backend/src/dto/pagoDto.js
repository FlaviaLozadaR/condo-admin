class PagoDTO {
  static fromRequest(body = {}) {
    const { propiedad, propietario, resident, unit, tipo, monto, fecha, estado, dueDate, referencia } = body;
    if (!monto) throw new Error('El monto es requerido');
    return {
      propiedad:   propiedad || `${unit || ''} - ${resident || ''}`,
      propietario: propietario || resident || '',
      resident:    resident || propietario || '',
      unit:        unit || '',
      tipo:        tipo || 'Expensa',
      monto:       Number(monto),
      fecha:       fecha || new Date().toLocaleDateString('es-ES'),
      estado:      estado || 'pendiente',
      dueDate:     dueDate || '',
      referencia:  referencia || '',
    };
  }

  static toResponse(pago) {
    return { ...pago };
  }
}

module.exports = PagoDTO;
