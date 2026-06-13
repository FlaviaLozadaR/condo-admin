class PropiedadDTO {
  static fromRequest(body = {}) {
    const { code, street, block, owner, tenant, debt, condo } = body;
    if (!code?.trim())   throw new Error('El código es requerido');
    if (!street?.trim()) throw new Error('La calle es requerida');
    if (!owner?.trim())  throw new Error('El propietario es requerido');
    return {
      code:   code.trim().toUpperCase(),
      street: street.trim(),
      block:  block?.trim().toUpperCase() || code.trim().split('-')[0] || '-',
      owner:  owner.trim(),
      tenant: tenant?.trim() || '-',
      debt:   Math.max(0, Number(debt) || 0),
      condo:  condo || 'General',
    };
  }

  static toResponse(prop) {
    return { ...prop };
  }
}

module.exports = PropiedadDTO;
