export const features = [
  {
    title: "Seguridad Avanzada",
    description: "Control de acceso con QR, registro de visitas y boton de panico para emergencias.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3L5 6V11C5 16 8.4 20.5 12 21C15.6 20.5 19 16 19 11V6L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    title: "Gestion de Pagos",
    description: "Pago de expensas con QR, seguimiento de morosos y reportes financieros.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3V21M16.5 7.5C16.5 6.1 15 5 12.8 5H11.2C9 5 7.5 6.1 7.5 7.5C7.5 8.9 9 10 11.2 10H12.8C15 10 16.5 11.1 16.5 12.5C16.5 13.9 15 15 12.8 15H11.2C9 15 7.5 13.9 7.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    title: "Reservas en Linea",
    description: "Sistema de reservas para areas comunes con disponibilidad en tiempo real.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 3V6M16 3V6M4 9H20M5 6H19C20.1 6 21 6.9 21 8V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V8C3 6.9 3.9 6 5 6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    highlight: true
  },
  {
    title: "Asambleas Digitales",
    description: "Votaciones electronicas y participacion remota en asambleas.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 8C17.7 8 19 6.7 19 5C19 3.3 17.7 2 16 2C14.3 2 13 3.3 13 5C13 6.7 14.3 8 16 8ZM8 10C9.7 10 11 8.7 11 7C11 5.3 9.7 4 8 4C6.3 4 5 5.3 5 7C5 8.7 6.3 10 8 10ZM4 20V18.8C4 16.7 5.8 15 8 15H10C12.2 15 14 16.7 14 18.8V20M13 20V18.7C13 17.5 12.5 16.4 11.7 15.6C12.3 15.2 13 15 13.8 15H16.2C18.4 15 20 16.6 20 18.8V20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    title: "Comunicacion Directa",
    description: "Anuncios instantaneos y notificaciones a todos los residentes.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 17H9M17 10C17 7.2 14.8 5 12 5C9.2 5 7 7.2 7 10V12.7C7 13.5 6.7 14.2 6.1 14.8L5 15.9H19L17.9 14.8C17.3 14.2 17 13.5 17 12.7V10ZM13.7 19C13.4 20.2 12.8 21 12 21C11.2 21 10.6 20.2 10.3 19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    title: "Acceso QR",
    description: "Pre-registro de visitas con codigos QR de un solo uso.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4H10V10H4V4ZM14 4H20V10H14V4ZM4 14H10V20H4V14ZM14 14H16V16H14V14ZM18 14H20V16H18V14ZM14 18H16V20H14V18ZM18 18H20V20H18V18Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
];

export const reasons = [
  {
    title: "Multi-dispositivo sin concesiones",
    description: "Interfaz optimizada para laptop y escritorio. Los residentes acceden desde celular; los administradores operan cómodos desde su PC.",
  },
  {
    title: "Seguridad de nivel empresarial",
    description: "Autenticación JWT, roles granulares por unidad y cifrado en tránsito. Cada acción queda registrada y es auditable en cualquier momento.",
  },
  {
    title: "Automatización real, no cosmética",
    description: "Cobros recurrentes, recordatorios de mora, actas de asamblea y reportes financieros se generan solos. Menos trabajo manual, cero errores de tipeo.",
  }
];
