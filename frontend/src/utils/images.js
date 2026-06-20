// El campo imagenUrl de un área social puede ser:
// - una URL simple (string), para áreas con una sola foto
// - un array de URLs serializado como JSON, cuando el área tiene varias fotos
export function parseAreaImages(imagenUrl) {
  if (!imagenUrl) return [];
  if (Array.isArray(imagenUrl)) return imagenUrl.filter(Boolean);
  const trimmed = String(imagenUrl).trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // no era JSON válido, tratar como URL simple
    }
  }
  return [trimmed];
}
