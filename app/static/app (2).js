const state = { dealId: null, documents: [] };
const form = document.querySelector("#dealForm");
const message = document.querySelector("#message");
const documentLabels = {
  seller_passport: "Паспорт продавца",
  buyer_passport: "Паспорт покупателя",
  pts: "ПТС",
  sts: "СТС",
  old_contract: "Старый ДКП",
  other: "Прочее",
  auto: "Автоопределение",
};
const readinessGroups = [
  { label: "Договор", fields: ["contract_date", "contract_place", "price"] },
  { label: "Продавец", fields: ["seller_full_name", "seller_passport", "seller_address"] },
  { label: "Покупатель", fields: ["buyer_full_name", "buyer_passport", "buyer_address"] },
  { label: "Автомобиль", fields: ["vehicle_make_model", "vin", "pts_series_number", "sts_series_number"] },
];
const plateLatinToCyrillic = { A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н", O: "О", P: "Р", C: "С", T: "Т", Y: "У", X: "Х" };
const uploadHintByType = {
  seller_passport: "Разворот и прописка",
  buyer_passport: "Разворот и прописка",
  pts: "Все нужные страницы",
  sts: "Обе стороны",
  old_contract: "Печатный или рукописный",
  other: "Любые вложения",
};

function showMessage(text, error = false) {
  message.textContent = text;
  message.className = `message${error ? " error" : ""}`;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => message.classList.add("hidden"), 5000);
}

function formData() {
  const data = Object.fromEntries(new FormData(form).entries());
  for (const key of Object.keys(data)) data[key] = normalizeDealField(key, data[key]);
  data.notes = [data.seller_notes, data.buyer_notes, data.vehicle_notes].filter(Boolean).join("\n\n");
  return data;
}

function setForm(data = {}) {
  form.reset();
  if (data.notes && !data.seller_notes && !data.buyer_notes && !data.vehicle_notes) {
    data.seller_notes = data.notes;
  }
  for (const [key, value] of Object.entries(data)) {
    const field = form.elements.namedItem(key);
    if (field && typeof value !== "object") field.value = value || "";
  }
  state.documents = data.documents || [];
  renderDocuments();
  clearConfidence();
  updateReadiness();
}

function clearConfidence() {
  form.querySelectorAll("input, textarea").forEach(field => {
    field.classList.remove("confidence-high", "confidence-medium", "confidence-low");
    field.removeAttribute("title");
  });
}

function applyConfidence(meta = {}) {
  clearConfidence();
  for (const [key, item] of Object.entries(meta)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    const confidence = Number(item.confidence || 0);
    const level = confidence >= .85 ? "high" : confidence >= .65 ? "medium" : "low";
    field.classList.add(`confidence-${level}`);
    field.title = `Уверенность: ${Math.round(confidence * 100)}%. ${item.evidence || ""}`;
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Ошибка приложения");
  return body;
}

async function saveDeal(silent = false) {
  const result = await api("/api/deals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deal_id: state.dealId, data: formData() }),
  });
  state.dealId = result.id;
  document.querySelector("#dealBadge").textContent = `№ ${result.id}`;
  if (!silent) showMessage("Карточка сохранена");
  await loadArchive();
  return result.id;
}

async function loadArchive(query = "") {
  const rows = await api(`/api/deals?q=${encodeURIComponent(query)}`);
  const list = document.querySelector("#archiveList");
  list.innerHTML = rows.map((row, index) => `
    <div class="archive-item ${row.id === state.dealId ? "active" : ""}" data-id="${row.id}">
      <div class="archive-head">
        <span class="archive-number">${index + 1}</span>
        <strong>${escapeHtml(row.buyer_full_name || row.seller_full_name || "Без имени")}</strong>
        ${archiveBadge(row)}
      </div>
      <button class="icon-delete archive-delete" type="button" title="Удалить сделку" data-delete-deal="${row.id}">×</button>
      <span>${escapeHtml(row.vehicle_make_model || "Автомобиль не указан")}</span>
      <span>${escapeHtml([row.registration_plate, row.vin].filter(Boolean).join(" · "))}</span>
    </div>`).join("") || "<p>Архив пока пуст</p>";
}

async function openDeal(id) {
  const data = await api(`/api/deals/${id}`);
  state.dealId = id;
  setForm(data);
  document.querySelector("#dealBadge").textContent = `№ ${id}`;
  await loadArchive(document.querySelector("#archiveSearch").value);
}

function newDeal() {
  state.dealId = null;
  state.documents = [];
  setForm({ contract_date: todayLocal(), contract_place: "Якутск", vehicle_type: "B/M1" });
  document.querySelector("#dealBadge").textContent = "Новая";
  document.querySelectorAll(".archive-item").forEach(x => x.classList.remove("active"));
}

async function uploadFiles(files, type = "other") {
  if (!files.length) return;
  if (!state.dealId) await saveDeal(true);
  for (const file of files) {
    const body = new FormData();
    body.append("document_type", type);
    body.append("file", file);
    showMessage(`Загружаю ${file.name}...`);
    const result = await api(`/api/deals/${state.dealId}/documents`, { method: "POST", body });
    for (const [key, value] of Object.entries(result.fields || {})) {
      const field = form.elements.namedItem(key);
      const clean = normalizeDealField(key, value);
      if (field && !field.value && clean) field.value = clean;
    }
    applyConfidence(result.field_meta || {});
    updateReadiness();
    if (result.note) {
      appendRecognitionNote(type, result.note);
    }
    state.documents.push({
      id: result.document_id,
      document_type: result.effective_type || type,
      original_name: file.name,
      ocr_status: result.status,
      file_size: result.file_size || file.size,
    });
    renderDocuments();
    updateReadiness();
  }
  await saveDeal(true);
  showMessage("Документы сохранены. Проверьте заполненные поля.");
}

function renderDocuments() {
  const groups = Object.keys(documentLabels).filter(type =>
    type !== "auto" || state.documents.some(doc => doc.document_type === "auto")
  );
  for (const type of groups) {
    const docs = state.documents.filter(doc => (doc.document_type || "other") === type);
    const tile = document.querySelector(`.upload-tile[data-type="${type}"]`);
    if (!tile) continue;
    let dock = tile.querySelector(".tile-docs");
    if (!dock) {
      dock = document.createElement("div");
      dock.className = "tile-docs";
      tile.appendChild(dock);
    }
    dock.innerHTML = `
        <div class="document-group-title">
          <strong>${docs.length ? "Загружено" : uploadHintByType[type] || "Файлы"}</strong>
          <span>${docs.length}</span>
        </div>
        <div class="document-items">
          ${docs.map(doc => `
            <div class="document-chip">
              <a href="/api/documents/${doc.id}" target="_blank">${escapeHtml(doc.original_name)}</a>
              <small>${formatFileSize(doc.file_size)}</small>
              <button class="icon-delete document-delete" type="button" title="Удалить документ" data-delete-document="${doc.id}">×</button>
            </div>
          `).join("")}
        </div>
    `;
  }
  document.querySelector("#documentList").innerHTML = "";
  updateReadiness();
}

async function deleteDocument(id) {
  await api(`/api/documents/${id}`, { method: "DELETE" });
  state.documents = state.documents.filter(doc => Number(doc.id) !== Number(id));
  renderDocuments();
  updateReadiness();
  showMessage("Документ удалён");
}

async function deleteDeal(id) {
  if (!confirm("Удалить сделку и все документы?")) return;
  await api(`/api/deals/${id}`, { method: "DELETE" });
  if (Number(state.dealId) === Number(id)) newDeal();
  await loadArchive(document.querySelector("#archiveSearch").value);
  showMessage("Сделка удалена");
}

async function makeContract() {
  const button = document.querySelector("#makeContract");
  if (button.disabled) return;
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Создаю...";
  try {
    await saveDeal(true);
    const result = await api(`/api/deals/${state.dealId}/contract`, { method: "POST" });
    showMessage(`Excel создан: ${result.template}`);
    window.location.href = result.download_url;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function reprocessDeal() {
  if (!state.dealId) {
    showMessage("Сначала сохраните сделку и загрузите документы", true);
    return;
  }
  const button = document.querySelector("#reprocessDeal");
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Распознаю...";
  try {
    const result = await api(`/api/deals/${state.dealId}/reprocess`, { method: "POST" });
    for (const [key, value] of Object.entries(result.fields || {})) {
      const field = form.elements.namedItem(key);
      const clean = normalizeDealField(key, value);
      if (field && clean) field.value = clean;
    }
    applyConfidence(result.field_meta || {});
    setRecognitionNotes(result.notes_by_group || {}, result.notes || "");
    updateReadiness();
    await saveDeal(true);
    showMessage(`Обработано документов: ${result.processed}. Проверьте заполненные поля.`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function getReadiness(data = formData()) {
  const checks = readinessGroups.map(group => {
    const filled = group.fields.filter(name => String(data[name] || "").trim()).length;
    return { ...group, filled, total: group.fields.length, done: filled === group.fields.length };
  });
  const filled = checks.reduce((sum, item) => sum + item.filled, 0);
  const total = checks.reduce((sum, item) => sum + item.total, 0);
  const documentsDone = state.documents.length > 0;
  const percent = Math.round(((filled + (documentsDone ? 1 : 0)) / (total + 1)) * 100);
  return { checks, percent, documentsDone };
}

function updateReadiness() {
  const title = document.querySelector("#readinessTitle");
  const hint = document.querySelector("#readinessHint");
  const percentNode = document.querySelector("#readinessPercent");
  const score = document.querySelector(".readiness-score");
  const list = document.querySelector("#readinessChecks");
  if (!title || !hint || !percentNode || !score || !list) return;

  const readiness = getReadiness();
  const missing = readiness.checks.filter(item => !item.done).map(item => item.label);
  percentNode.textContent = `${readiness.percent}%`;
  score.style.setProperty("--ready-angle", `${readiness.percent * 3.6}deg`);

  if (readiness.percent >= 90) {
    title.textContent = "Договор почти готов к Excel";
    hint.textContent = "Проверьте жёлтые и красные поля распознавания, затем можно создавать договор.";
  } else if (readiness.percent >= 45) {
    title.textContent = "Договор частично заполнен";
    hint.textContent = `Осталось проверить: ${missing.join(", ") || "поля распознавания"}.`;
  } else {
    title.textContent = "Договор пока не заполнен";
    hint.textContent = "Загрузите документы или заполните поля вручную. Подсказка покажет, чего не хватает для Excel.";
  }

  const chips = [
    `<span class="check-chip ${readiness.documentsDone ? "done" : "warn"}">Документы: ${state.documents.length}</span>`,
    ...readiness.checks.map(item =>
      `<span class="check-chip ${item.done ? "done" : "warn"}">${item.label}: ${item.filled}/${item.total}</span>`
    ),
  ];
  list.innerHTML = chips.join("");
}

function archiveBadge(row) {
  const totalFields = readinessGroups.flatMap(group => group.fields);
  const filled = totalFields.filter(name => String(row[name] || "").trim()).length;
  const ratio = filled / totalFields.length;
  if (ratio >= .85) return `<span class="status-badge status-ready">Готов</span>`;
  if (ratio >= .35) return `<span class="status-badge status-check">Проверить</span>`;
  return `<span class="status-badge status-draft">Черновик</span>`;
}

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Кб`;
  return `${(size / 1024 / 1024).toFixed(size < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",")} Мб`;
}

function formatPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith("7")) digits = `7${digits}`;
  digits = digits.slice(0, 11);
  const body = digits.slice(1);
  if (!body) return "+7";
  const p1 = body.slice(0, 3);
  const p2 = body.slice(3, 6);
  const p3 = body.slice(6, 8);
  const p4 = body.slice(8, 10);
  let result = `+7`;
  if (p1) result += ` (${p1}`;
  if (p1.length === 3) result += `)`;
  if (p2) result += ` ${p2}`;
  if (p3) result += `-${p3}`;
  if (p4) result += `-${p4}`;
  return result;
}

function formatSeriesNumber(value) {
  const raw = String(value || "").toUpperCase().replace(/[^0-9А-ЯA-Z]/g, "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) return `${digits.slice(0, 4)} ${digits.slice(4, 10)}`;
  if (raw.length >= 10) return `${raw.slice(0, 4)} ${raw.slice(4, 10)}`;
  return raw;
}

function normalizePlate(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[ABEKMHOPCTYX]/g, char => plateLatinToCyrillic[char] || char)
    .replace(/[^АВЕКМНОРСТУХ0-9]/g, "")
    .slice(0, 9);
}

function normalizeDealField(key, value) {
  if (value === null || value === undefined) return "";
  if (key.endsWith("_phone")) return formatPhone(value);
  if (["seller_passport", "buyer_passport", "pts_series_number", "sts_series_number"].includes(key)) return formatSeriesNumber(value);
  if (key === "registration_plate") return normalizePlate(value);
  if (key === "vehicle_type") return String(value || "B/M1").trim() || "B/M1";
  if (key === "vin") return String(value).toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
  return String(value).trim();
}

function noteFieldForType(type) {
  if (type === "buyer_passport") return "buyer_notes";
  if (["pts", "sts", "old_contract", "auto"].includes(type)) return "vehicle_notes";
  return "seller_notes";
}

function appendRecognitionNote(type, note) {
  const field = form.elements.namedItem(noteFieldForType(type));
  if (field) field.value = [field.value, note].filter(Boolean).join("\n\n");
}

function setRecognitionNotes(groups = {}, fallback = "") {
  form.elements.namedItem("seller_notes").value = groups.seller || fallback || "";
  form.elements.namedItem("buyer_notes").value = groups.buyer || "";
  form.elements.namedItem("vehicle_notes").value = groups.vehicle || "";
}

document.querySelector("#saveDeal").addEventListener("click", () => saveDeal().catch(e => showMessage(e.message, true)));
document.querySelector("#newDeal").addEventListener("click", newDeal);
document.querySelector("#makeContract").addEventListener("click", () => makeContract().catch(e => showMessage(e.message, true)));
document.querySelector("#reprocessDeal").addEventListener("click", () => reprocessDeal().catch(e => showMessage(e.message, true)));
document.querySelector("#uploadGrid").addEventListener("change", e => {
  const input = e.target.closest("input[type='file']");
  if (!input) return;
  uploadFiles([...input.files], input.dataset.documentType).catch(err => showMessage(err.message, true));
  input.value = "";
});
document.querySelector("#uploadGrid").addEventListener("click", e => {
  const deleteButton = e.target.closest("[data-delete-document]");
  if (deleteButton) {
    e.preventDefault();
    e.stopPropagation();
    deleteDocument(Number(deleteButton.dataset.deleteDocument)).catch(err => showMessage(err.message, true));
    return;
  }
  if (e.target.closest(".document-chip a")) {
    e.stopPropagation();
  }
});
document.querySelector("#documentList").addEventListener("click", e => {
  const button = e.target.closest("[data-delete-document]");
  if (!button) return;
  e.preventDefault();
  deleteDocument(Number(button.dataset.deleteDocument)).catch(err => showMessage(err.message, true));
});
document.querySelector("#archiveSearch").addEventListener("input", e => loadArchive(e.target.value).catch(err => showMessage(err.message, true)));
document.querySelector("#archiveList").addEventListener("click", e => {
  const deleteButton = e.target.closest("[data-delete-deal]");
  if (deleteButton) {
    e.preventDefault();
    e.stopPropagation();
    deleteDeal(Number(deleteButton.dataset.deleteDeal)).catch(err => showMessage(err.message, true));
    return;
  }
  const item = e.target.closest(".archive-item");
  if (item) openDeal(Number(item.dataset.id)).catch(err => showMessage(err.message, true));
});
form.addEventListener("input", e => {
  const field = e.target;
  if (!field.name) return updateReadiness();
  if (field.name.endsWith("_phone")) field.value = formatPhone(field.value);
  if (["seller_passport", "buyer_passport", "pts_series_number", "sts_series_number"].includes(field.name)) {
    field.value = formatSeriesNumber(field.value);
  }
  if (field.name === "registration_plate") field.value = normalizePlate(field.value);
  if (field.name === "vin") field.value = normalizeDealField("vin", field.value);
  updateReadiness();
});

newDeal();
loadArchive().catch(e => showMessage(e.message, true));
