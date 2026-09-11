// Lee/rellena formularios grandes usando atributos data-field="a.b.c"
// (rutas con punto) sin tener que mapear cada campo a mano.

export function leerCamposPlanos(root) {
  const datos = {};
  root.querySelectorAll("[data-field]").forEach((el) => {
    const ruta = el.dataset.field.split(".");
    let nodo = datos;
    for (let i = 0; i < ruta.length - 1; i++) {
      nodo[ruta[i]] = nodo[ruta[i]] || {};
      nodo = nodo[ruta[i]];
    }
    const clave = ruta[ruta.length - 1];
    if (el.type === "checkbox") {
      nodo[clave] = el.checked;
    } else {
      nodo[clave] = el.value;
    }
  });
  return datos;
}

export function poblarCamposPlanos(root, datos) {
  root.querySelectorAll("[data-field]").forEach((el) => {
    const ruta = el.dataset.field.split(".");
    let nodo = datos;
    for (const parte of ruta) {
      if (nodo == null) break;
      nodo = nodo[parte];
    }
    if (nodo == null) return;
    if (el.type === "checkbox") {
      el.checked = Boolean(nodo);
    } else {
      el.value = nodo;
    }
  });
}
