class PanicDTO {
  static fromRequest(body = {}) {
    const { resident, phone, address, unit } = body;
    if (!resident?.trim()) throw new Error('El residente es requerido');
    if (!address?.trim())  throw new Error('La dirección es requerida');
    return {
      resident: resident.trim(),
      phone:    phone || '',
      address:  address.trim(),
      unit:     unit || '',
      status:   'Pendiente',
      createdAt: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  static toResponse(alert) {
    return { ...alert };
  }
}

module.exports = PanicDTO;
