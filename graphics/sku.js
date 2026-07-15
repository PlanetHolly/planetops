(function () {
  const SKU_DICTIONARY = {
    PL2216: { fabric: "Cotton", size: "22x22", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    PL2219: { fabric: "Cotton", size: "22x22", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    PL2222: { fabric: "Cotton", size: "22x22", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    US2116: { fabric: "Cotton", size: "21x21", shape: "Square", product_type: "Standard", made_in_usa: "Yes", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    US2119: { fabric: "Cotton", size: "21x21", shape: "Square", product_type: "Standard", made_in_usa: "Yes", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    US2121: { fabric: "Cotton", size: "21x21", shape: "Square", product_type: "Standard", made_in_usa: "Yes", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    ORG2416: { fabric: "Organic Cotton", size: "24x24", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    ORG2419: { fabric: "Organic Cotton", size: "24x24", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    ORG2424: { fabric: "Organic Cotton", size: "24x24", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    OV2722: { fabric: "Organic Cotton", size: "27x27", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    TRIBAN22: { fabric: "Cotton", size: "22x22x31", shape: "Triangle", product_type: "Doggie", made_in_usa: "No", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    USTRIBAN: { fabric: "Cotton", size: "", shape: "Triangle", product_type: "Doggie", made_in_usa: "Yes", default_print_method: "Screen-Printed", default_ink: "Plastisol" },
    DIGTRISC: { fabric: "Cotton", size: "", shape: "Triangle", product_type: "Doggie", made_in_usa: "Yes", default_print_method: "Digitally Printed", default_ink: "N/A" },
    SUBTRI: { fabric: "Polyester", size: "", shape: "Triangle", product_type: "Doggie", made_in_usa: "No", default_print_method: "Sublimated", default_ink: "Sublimation Dye" },
    SUB1: { fabric: "Polyester", size: "", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Sublimated", default_ink: "Sublimation Dye" },
    SUB2: { fabric: "Polyester", size: "", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Sublimated", default_ink: "Sublimation Dye" },
    SUB27: { fabric: "Polyester", size: "27x27", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Sublimated", default_ink: "Sublimation Dye" },
    DIG22: { fabric: "Cotton", size: "22x22", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Digitally Printed", default_ink: "N/A" },
    DIGCR25: { fabric: "Cotton", size: "22x25", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Digitally Printed", default_ink: "N/A" },
    CUSTOMDIGBAN: { fabric: "Cotton", size: "", shape: "Square", product_type: "Standard", made_in_usa: "No", default_print_method: "Digitally Printed", default_ink: "N/A" },
    BELBAN: { fabric: "", size: "", shape: "", product_type: "", made_in_usa: "No", default_print_method: "", default_ink: "N/A" }
  };

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getSkuRecord(sku) {
    return SKU_DICTIONARY[sku] || SKU_DICTIONARY.PL2216;
  }

  function getPrintMethod(inputs, skuRecord) {
    return inputs.printMethodOverride || skuRecord.default_print_method || "";
  }

  function getExtension(fileName) {
    const match = String(fileName || "").match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : "jpg";
  }

  // shared spec — future production automation must call this same logic.
  function buildFilename(inputs) {
    const skuRecord = getSkuRecord(inputs.sku);
    const tokens = [
      slugify(inputs.brand),
      slugify(getPrintMethod(inputs, skuRecord)),
      slugify(inputs.color),
      slugify(skuRecord.fabric),
      slugify(skuRecord.size),
      slugify(inputs.layout),
      slugify(inputs.style)
    ].filter(Boolean);
    return tokens.join("-") + "." + getExtension(inputs.fileName);
  }

  function displayName(sku, record) {
    const pieces = [record.fabric, record.size, record.shape, record.product_type].filter(Boolean);
    return sku + " — " + (pieces.length ? pieces.join(" ") + " Bandana" : "Bandana");
  }

  window.PG_SKU = { SKU_DICTIONARY, slugify, buildFilename, displayName, getSkuRecord };
})();
