class AsambleaDTO {
  static fromRequest(body = {}, fileName = '', fileUrl = '') {
    const { title, description, startDate, dueDate, condo } = body;
    if (!title?.trim()) throw new Error('El título es requerido');
    if (!startDate?.trim()) throw new Error('La fecha de inicio es requerida');
    if (!dueDate?.trim()) throw new Error('La fecha de vencimiento es requerida');
    return {
      title:           title.trim(),
      description:     description || '',
      startDate:       startDate.trim(),
      dueDate:         dueDate.trim(),
      condo:           condo || 'General',
      documentName:    fileName,
      documentPath:    fileUrl,
      createdAt:       new Date().toISOString(),
      votes:           { favor: 0, contra: 0, abstencion: 0 },
      userVotes:       {},
      votesYes:        0,
      votesNo:         0,
      votesAbstencion: 0,
      userVotesJSON:   '{}',
    };
  }

  static fromUpdate(body = {}, fileName = '', fileUrl = '', existing = {}) {
    const { title, description, startDate, dueDate, condo } = body;
    if (!title?.trim()) throw new Error('El título es requerido');
    return {
      title:        title.trim(),
      description:  description || '',
      startDate:    startDate?.trim() || existing.startDate || '',
      dueDate:      dueDate?.trim()   || existing.dueDate   || '',
      condo:        condo || existing.condo || 'General',
      documentName: fileName || existing.documentName || '',
      documentPath: fileUrl  || existing.documentPath || '',
    };
  }

  static toResponse(asamblea) {
    const { votesYes, votesNo, votesAbstencion, userVotesJSON, documentPath, ...rest } = asamblea;
    return rest;
  }

  static toResponseAdmin(asamblea) {
    const { votesYes, votesNo, votesAbstencion, userVotesJSON, ...rest } = asamblea;
    return rest;
  }
}

module.exports = AsambleaDTO;
