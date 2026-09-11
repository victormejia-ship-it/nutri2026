// Apunta los botones de "Regístrate" de esta landing al negocio dueño del
// sitio. Si aún no existe ningún negocio configurado, los redirige al
// formulario de contacto en su lugar.
import { obtenerNegocioIdActual } from "./negocio-actual.js";

(async () => {
  const enlaces = document.querySelectorAll("[data-registro-link]");
  if (!enlaces.length) return;

  const negocioId = await obtenerNegocioIdActual();
  enlaces.forEach((a) => {
    a.href = negocioId ? `registro.html?negocio=${negocioId}` : "#contacto";
  });
})();
