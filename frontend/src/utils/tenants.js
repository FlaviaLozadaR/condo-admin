// Una propiedad puede tener varios inquilinos (array `tenants`) o, en datos
// antiguos, un único inquilino en el campo `tenant`.
export function getPropertyTenants(propiedad) {
  if (Array.isArray(propiedad?.tenants)) {
    return propiedad.tenants.filter(Boolean);
  }
  if (propiedad?.tenant && propiedad.tenant !== "-") {
    return [propiedad.tenant];
  }
  return [];
}

export function getPropertyTenantsText(propiedad) {
  const tenants = getPropertyTenants(propiedad);
  return tenants.length ? tenants.join(", ") : "-";
}

export function propertyHasTenant(propiedad, name) {
  return getPropertyTenants(propiedad).includes(name);
}
