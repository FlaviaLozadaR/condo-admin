// Helpers puros compartidos por DashboardScreen y SuperAdminDashboardScreen.

export const parseFecha = (str) => {
  if (!str) return null;
  const parts = String(str).split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return new Date(+y, +m - 1, +d);
};

export const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
export const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

export const formatAmount = (value) => `Bs. ${Number(value || 0).toLocaleString("es-ES")}`;

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
};

export const describeSector = (centerX, centerY, radius, startAngle, endAngle) => {
  const span = endAngle - startAngle;

  // Sin ángulo: nada que dibujar (evita el "puntito" que queda al cerrar
  // un camino degenerado de centro→borde→borde→centro).
  if (span <= 0) return "";

  // Círculo completo (100%): un solo arco no se puede dibujar porque el
  // punto de inicio y fin coinciden — hay que partirlo en dos mitades.
  if (span >= 360) {
    const mid = polarToCartesian(centerX, centerY, radius, startAngle + 180);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    return [
      `M ${end.x} ${end.y}`,
      `A ${radius} ${radius} 0 1 0 ${mid.x} ${mid.y}`,
      `A ${radius} ${radius} 0 1 0 ${end.x} ${end.y}`,
      "Z"
    ].join(" ");
  }

  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = span <= 180 ? "0" : "1";

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z"
  ].join(" ");
};

// Geometría compartida de los gráficos SVG (viewBox 620x260)
export const chartLeft = 44;
export const chartTop = 10;
export const chartWidth = 536;
export const chartHeight = 190;

export const barWidth = 105;
export const barGap = 24;
export const barBaseX = chartLeft + 12;
