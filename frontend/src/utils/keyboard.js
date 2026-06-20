// Permite guardar/enviar un formulario presionando Enter en cualquiera
// de sus campos, sin tener que hacer click en el botón con el mouse.
export const onEnterKey = (fn, disabled = false) => (e) => {
  if (e.key === "Enter" && !disabled) {
    e.preventDefault();
    fn();
  }
};
