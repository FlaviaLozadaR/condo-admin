class VisitaDTO {
  static fromRequest(body = {}) {
    const { mode, fullName, idNumber, property, motive, plate, idDocumentName, platePhotoName, createdBy, status, expiresAt } = body;
    if (!fullName?.trim()) throw new Error('El nombre es requerido');
    if (!idNumber?.trim()) throw new Error('El documento es requerido');
    if (!property?.trim()) throw new Error('La propiedad es requerida');
    if (!motive?.trim())   throw new Error('El motivo es requerido');

    const now = new Date();
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return {
      code:            `QR-${Math.floor(100000 + Math.random() * 900000)}`,
      mode:            mode || 'peatonal',
      fullName:        fullName.trim(),
      idNumber:        idNumber.trim(),
      property:        property.trim(),
      motive:          motive.trim(),
      plate:           plate || '-',
      idDocumentName:  idDocumentName || 'sin-archivo',
      platePhotoName:  platePhotoName || '-',
      createdBy:       createdBy || 'Sistema',
      createdAt:       `${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`,
      status:          status || 'Activo',
      expiresAt:       expiresAt || null,
    };
  }

  static toResponse(visita) {
    const { idDocumentFrontPath, idDocumentBackPath, platePhotoPath, ...rest } = visita;
    return {
      ...rest,
      hasIdDocumentFront: !!idDocumentFrontPath,
      hasIdDocumentBack: !!idDocumentBackPath,
      hasPlatePhoto: !!platePhotoPath,
    };
  }
}

module.exports = VisitaDTO;
