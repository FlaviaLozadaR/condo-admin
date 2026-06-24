const nodemailer = require('nodemailer');
const dns = require('dns');

// Render no tiene ruta de red IPv6 hacia Gmail — la opción "family: 4" de
// nodemailer no alcanza a evitarlo en modo TLS directo, así que se resuelve
// la IP a mano y se fuerza esa IPv4 literal como host de conexión.
function resolveGmailIPv4() {
  return new Promise((resolve) => {
    dns.resolve4('smtp.gmail.com', (err, addresses) => {
      resolve(err || !addresses?.length ? 'smtp.gmail.com' : addresses[0]);
    });
  });
}

async function createTransporter() {
  const host = await resolveGmailIPv4();
  return nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    tls: { servername: 'smtp.gmail.com' },
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    family: 4,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });
}

// La conexión SMTP a Gmail desde el hosting a veces tarda o falla por red
// (timeout intermitente) — se reintenta un par de veces antes de darse por vencido.
async function sendMailWithRetry(mailOptions, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const transporter = await createTransporter();
      return await transporter.sendMail(mailOptions);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function sendResetEmail(to, name, token) {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3001'}/reset-password.html?token=${token}`;
  const adminEmail = process.env.GMAIL_USER;

  await sendMailWithRetry({
    from: `"Condo Admin" <${adminEmail}>`,
    to,
    cc: to !== adminEmail ? adminEmail : undefined,
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
  const adminEmail = process.env.GMAIL_USER;

  await sendMailWithRetry({
    from: `"Condo Admin" <${adminEmail}>`,
    to,
    cc: to !== adminEmail ? adminEmail : undefined,
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
