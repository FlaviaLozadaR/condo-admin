class CondominioDTO {
  static fromRequest(body = {}) {
    const { name, type, address, units, plan } = body;
    if (!name?.trim()) throw new Error('El nombre es requerido');
    return {
      name:    name.trim(),
      type:    type || 'Condominio',
      address: address || '',
      units:   Number(units) || 0,
      plan:    plan || 'Básico',
    };
  }

  static toResponse(condo) {
    return { ...condo };
  }
}

module.exports = CondominioDTO;
