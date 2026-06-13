class UserDTO {
  static fromRequest(body = {}) {
    const { name, email, password, phone, role, property, condo } = body;
    if (!name?.trim())  throw new Error('El nombre es requerido');
    if (!email?.trim()) throw new Error('El email es requerido');
    if (!role)          throw new Error('El rol es requerido');
    return {
      name:     name.trim(),
      email:    email.trim().toLowerCase(),
      password: password || '123456',
      phone:    phone || '',
      role,
      property: property || '-',
      condo:    condo || 'General',
    };
  }

  static toResponse(user) {
    const { password, ...rest } = user;
    return rest;
  }
}

module.exports = UserDTO;
