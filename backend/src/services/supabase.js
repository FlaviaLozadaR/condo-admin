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

module.exports = { supabase, uploadFile, deleteFile };
