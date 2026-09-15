(function () {
  const clothing = [["length_cm", "LARGO"], ["chest_width_cm", "ANCHO DE PECHO"]];
  const jackets = [...clothing, ["sleeve_width_cm", "ANCHO DE MANGA"]];
  const pants = [["length_cm", "LARGO TOTAL"], ["waist_width_cm", "ANCHO DE CINTURA EN PLANO"], ["inseam_cm", "ANCHO DE PIERNA"]];
  const bags = [["height_cm", "ALTO"], ["width_cm", "ANCHO"], ["depth_cm", "FONDO"]];
  function fields(category) {
    return category === "pantalones" ? pants : category === "mochilas" ? bags : ["jacket_damas", "jacket_caballeros"].includes(category) ? jackets : clothing;
  }
  function editor(container, category, product = {}, original = product) {
    container.replaceChildren();
    const selected = fields(category);
    // Keep historical measurements editable under their original names.
    const legacy = [...clothing, ...jackets.filter(([key]) => !clothing.some(([field]) => field === key))].filter(([key]) => !selected.some(([field]) => field === key) && original[key] != null);
    for (const [key, title] of [...selected, ...legacy]) {
      const label = document.createElement("label");
      const editorTitle = key === "inseam_cm" ? "ANCHO DE PIERNA" : title;
      label.textContent = `${editorTitle}${legacy.some(([field]) => field === key) ? " · MEDIDA ANTERIOR" : ""} (CM)`;
      const input = document.createElement("input");
      Object.assign(input, { name: key, type: "number", min: "0", max: "9999.99", step: "0.01", value: product[key] ?? "" });
      label.append(input);
      container.append(label);
    }
  }
  function values(container) {
    return Object.fromEntries([...container.querySelectorAll("input")].map(input => [input.name, input.value === "" ? null : Number(input.value)]));
  }
  function display(product) {
    const length = document.getElementById("dialogLength").parentElement;
    const chest = document.getElementById("dialogChestWidth").parentElement;
    const sleeve = document.getElementById("dialogSleeveWidth")?.parentElement;
    length.style.display = "none";
    chest.style.display = "none";
    if (sleeve) sleeve.style.display = "none";
    const list = length.parentElement;
    list.querySelectorAll("[data-measurement]").forEach(node => node.remove());
    const selected = fields(product.category);
    const legacy = [...clothing, ...jackets.filter(([key]) => !clothing.some(([field]) => field === key))].filter(([key]) => !selected.some(([field]) => field === key) && product[key] != null);
    for (const [key, title] of [...selected, ...legacy]) {
      if (product[key] == null) continue;
      if (key === "sleeve_width_cm" && sleeve) {
        sleeve.style.display = "";
        document.getElementById("dialogSleeveWidth").textContent = `${product[key]} cm`;
        continue;
      }
      const row = document.createElement("div");
      row.dataset.measurement = key;
      const label = document.createElement("dt"), value = document.createElement("dd");
      label.textContent = title;
      value.textContent = `${product[key]} cm`;
      row.append(label, value);
      list.insertBefore(row, length);
    }
  }
  window.ProductMeasurements = { fields, editor, values, display };
})();
