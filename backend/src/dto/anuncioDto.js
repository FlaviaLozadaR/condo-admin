class AnuncioDTO {
  static fromRequest(body = {}) {
    const { title, content, message, author, category, priority, condo, target, createdByRole } = body;
    if (!title?.trim()) throw new Error('El título es requerido');
    const now = new Date();
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return {
      title:         title.trim(),
      message:       message || content || '',
      author:        author || '',
      category:      category || 'General',
      priority:      priority || 'Media',
      condo:         condo || 'General',
      target:        target || 'todos',
      createdByRole: createdByRole || 'Administrador',
      dateLabel:     `${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`,
    };
  }

  static toResponse(anuncio) {
    return { ...anuncio };
  }
}

module.exports = AnuncioDTO;
