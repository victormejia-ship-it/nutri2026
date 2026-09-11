// Componente reutilizable: tabla editable para secciones repetibles de la
// historia clínica (filas fijas o filas que el usuario puede agregar/quitar).
//
// columnas: [{ key, label, tipo: 'text'|'number'|'select', opciones? }]
// filas: datos iniciales (array de objetos { [key]: valor })
// filasFijas: boolean — si es true, las filas vienen de "etiquetas" y no se
//             pueden agregar/quitar (solo se editan sus columnas).
// etiquetas: cuando filasFijas es true, array de strings para la 1a columna.
export function crearTablaEditable({ contenedor, columnas, filas = [], filasFijas = false, etiquetas = [] }) {
  const tabla = document.createElement("table");
  tabla.className = "w-full text-xs border-collapse";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr class="bg-gray-50 text-gray-500 text-left uppercase">
      ${filasFijas ? `<th class="px-2 py-2 border border-gray-100">&nbsp;</th>` : ""}
      ${columnas.map((c) => `<th class="px-2 py-2 border border-gray-100">${c.label}</th>`).join("")}
      ${filasFijas ? "" : `<th class="px-2 py-2 border border-gray-100 w-10"></th>`}
    </tr>
  `;
  tabla.appendChild(thead);

  const tbody = document.createElement("tbody");
  tabla.appendChild(tbody);

  function celda(columna, valor) {
    const td = document.createElement("td");
    td.className = "border border-gray-100 p-1";
    let input;
    if (columna.tipo === "select") {
      input = document.createElement("select");
      input.className = "w-full rounded border border-gray-200 px-1.5 py-1 text-xs";
      input.innerHTML = columna.opciones.map((o) => `<option value="${o}" ${o === valor ? "selected" : ""}>${o || "—"}</option>`).join("");
    } else {
      input = document.createElement("input");
      input.type = columna.tipo === "number" ? "number" : "text";
      input.className = "w-full rounded border border-gray-200 px-1.5 py-1 text-xs";
      input.value = valor ?? "";
    }
    input.dataset.key = columna.key;
    td.appendChild(input);
    return td;
  }

  function agregarFila(datosFila = {}, etiqueta = null) {
    const tr = document.createElement("tr");

    if (filasFijas) {
      const tdLabel = document.createElement("td");
      tdLabel.className = "px-2 py-1.5 border border-gray-100 font-medium text-gray-700 whitespace-nowrap";
      tdLabel.textContent = etiqueta;
      tr.appendChild(tdLabel);
    }

    columnas.forEach((columna) => {
      tr.appendChild(celda(columna, datosFila[columna.key]));
    });

    if (!filasFijas) {
      const tdBtn = document.createElement("td");
      tdBtn.className = "border border-gray-100 text-center";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "✕";
      btn.className = "text-red-500 hover:text-red-700 font-bold px-2";
      btn.addEventListener("click", () => tr.remove());
      tdBtn.appendChild(btn);
      tr.appendChild(tdBtn);
    }

    tbody.appendChild(tr);
  }

  if (filasFijas) {
    etiquetas.forEach((etiqueta, i) => agregarFila(filas[i] || {}, etiqueta));
  } else {
    (filas.length ? filas : []).forEach((f) => agregarFila(f));
  }

  contenedor.innerHTML = "";
  contenedor.appendChild(tabla);

  if (!filasFijas) {
    const btnAgregar = document.createElement("button");
    btnAgregar.type = "button";
    btnAgregar.textContent = "+ Agregar fila";
    btnAgregar.className = "mt-2 text-sm font-semibold text-brandDark hover:underline";
    btnAgregar.addEventListener("click", () => agregarFila({}));
    contenedor.appendChild(btnAgregar);
  }

  return {
    leer() {
      return Array.from(tbody.querySelectorAll("tr")).map((tr) => {
        const obj = {};
        tr.querySelectorAll("[data-key]").forEach((input) => {
          obj[input.dataset.key] = input.value;
        });
        return obj;
      });
    },
  };
}
