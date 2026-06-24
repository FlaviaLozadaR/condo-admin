// Render bloquea las conexiones SMTP salientes (puerto 465/587) a nivel de
// infraestructura — por eso se manda por la API HTTP de Brevo (puerto 443,
// nunca bloqueado) en vez de conectarse directo al SMTP de Gmail.
const BREVO_API_KEY     = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;

async function sendViaBrevo({ to, cc, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Condo Admin', email: BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      cc: cc ? [{ email: cc }] : undefined,
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${body}`);
  }
  return res.json();
}

async function sendResetEmail(to, name, token) {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3001'}/reset-password.html?token=${token}`;

  await sendViaBrevo({
    to,
    cc: to !== BREVO_SENDER_EMAIL ? BREVO_SENDER_EMAIL : undefined,
    subject: 'Restablecer tu contraseña — Condo Admin',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#f8fafc;border-radius:12px;">
        <div style="background:#0f172a;border-radius:10px;padding:2rem;">
          <h2 style="color:#38bdf8;margin:0 0 0.5rem;">Condo Admin</h2>
          <p style="color:#94a3b8;margin:0 0 1.5rem;font-size:0.85rem;">Sistema de Gestión Condominial</p>
          <h3 style="color:#e2e8f0;margin:0 0 1rem;">Restablecer contraseña</h3>
          <p style="color:#94a3b8;margin:0 0 0.5rem;">Hola <strong style="color:#e2e8f0;">${name}</strong>,</p>
          <p style="color:#94a3b8;margin:0 0 1.5rem;">
            Recibiste este email porque se solicitó un restablecimiento de contraseña para tu cuenta.
            Si no fuiste vos, podés ignorar este mensaje.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:0.75rem 1.75rem;background:#38bdf8;color:#0f172a;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;">
            Crear nueva contraseña
          </a>
          <p style="color:#475569;font-size:0.78rem;margin:1.5rem 0 0;">
            Este link expira en <strong style="color:#94a3b8;">1 hora</strong>.
          </p>
        </div>
      </div>
    `,
  });
}

async function sendWelcomeEmail(to, name, password, role) {
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  await sendViaBrevo({
    to,
    cc: to !== BREVO_SENDER_EMAIL ? BREVO_SENDER_EMAIL : undefined,
    subject: 'Bienvenido a Condo Admin — Tus credenciales de acceso',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#f8fafc;border-radius:12px;">
        <div style="background:#0f172a;border-radius:10px;padding:2rem;">
          <h2 style="color:#38bdf8;margin:0 0 0.5rem;">Condo Admin</h2>
          <p style="color:#94a3b8;margin:0 0 1.5rem;font-size:0.85rem;">Sistema de Gestión Condominial</p>
          <h3 style="color:#e2e8f0;margin:0 0 1rem;">¡Hola, ${name}!</h3>
          <p style="color:#94a3b8;margin:0 0 1.5rem;">
            Tu cuenta fue creada con el rol de <strong style="color:#38bdf8;">${role}</strong>.
            Podés ingresar al sistema con las siguientes credenciales:
          </p>
          <div style="background:#1e293b;border-radius:8px;padding:1.25rem;margin-bottom:1.5rem;">
            <p style="color:#94a3b8;margin:0 0 0.5rem;font-size:0.8rem;">CORREO</p>
            <p style="color:#e2e8f0;margin:0 0 1rem;font-weight:600;">${to}</p>
            <p style="color:#94a3b8;margin:0 0 0.5rem;font-size:0.8rem;">CONTRASEÑA TEMPORAL</p>
            <p style="color:#facc15;margin:0;font-weight:700;font-size:1.1rem;">${password}</p>
          </div>
          <a href="${loginUrl}"
             style="display:inline-block;padding:0.75rem 1.75rem;background:#38bdf8;color:#0f172a;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;">
            Ingresar al sistema
          </a>
          <p style="color:#475569;font-size:0.78rem;margin:1.5rem 0 0;">
            Te recomendamos cambiar tu contraseña después del primer ingreso usando <strong style="color:#94a3b8;">¿Olvidaste tu contraseña?</strong>
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendResetEmail, sendWelcomeEmail };
