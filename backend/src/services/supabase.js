const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

/**
 * Sube un archivo a Supabase Storage y devuelve la URL pública.
 * @param {Buffer} buffer  - Contenido del archivo
 * @param {string} bucket  - Nombre del bucket ('comprobantes' | 'asambleas')
 * @param {string} filename - Nombre con el que se guardará
 * @param {string} mimetype - MIME type del archivo
 */
async function uploadFile(buffer, bucket, filename, mimetype) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: mimetype, upsert: false });

  if (error) throw new Error(`Error subiendo archivo: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Sube un archivo a un bucket privado de Supabase Storage y devuelve la
 * ruta interna (no una URL pública). Para verlo luego hay que generar un
 * enlace temporal con getSignedUrl.
 * @param {Buffer} buffer
 * @param {string} bucket
 * @param {string} filename
 * @param {string} mimetype
 */
async function uploadPrivateFile(buffer, bucket, filename, mimetype) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: mimetype, upsert: false });

  if (error) throw new Error(`Error subiendo archivo: ${error.message}`);

  return filename;
}

/**
 * Genera un enlace temporal (firmado) para ver un archivo de un bucket privado.
 * @param {string} bucket
 * @param {string} filename - Ruta/nombre del archivo dentro del bucket
 * @param {number} expiresIn - Segundos de validez del enlace
 */
async function getSignedUrl(bucket, filename, expiresIn = 300) {
  if (!filename) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filename, expiresIn);

  if (error) throw new Error(`Error generando enlace: ${error.message}`);
  return data.signedUrl;
}

/**
 * Elimina un archivo de Supabase Storage.
 * @param {string} bucket
 * @param {string} filename - Solo el nombre del archivo (sin la URL base)
 */
async function deleteFile(bucket, filename) {
  if (!filename) return;
  // Si es una URL completa, extraer solo el nombre del archivo
  const name = filename.includes('/') ? filename.split('/').pop() : filename;
  await supabase.storage.from(bucket).remove([name]);
}

module.exports = { supabase, uploadFile, uploadPrivateFile, getSignedUrl, deleteFile };
