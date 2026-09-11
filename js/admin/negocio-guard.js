// Exige que el admin ya tenga su negocio configurado antes de usar esta
// página; si no, lo regresa a Usuarios para completar ese paso primero.
export function requerirNegocio(perfil) {
  if (!perfil.negocioId) {
    alert("Primero debes configurar tu negocio desde la sección Usuarios.");
    window.location.href = "admin-dashboard.html";
    return false;
  }
  return true;
}
