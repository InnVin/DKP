const state = { dealId: null, documents: [], highlightMissing: false, deleteConfirmId: null, trashOpen: false };
const form = document.querySelector("#dealForm");
state.nextContractNumber = 1;
state.contractNumberAuto = true;
state.recognitionActive = 0;
state.recognitionQueue = [];
state.recognitionJobs = new Map();
state.globalRecognitionCount = 0;
state.trashDeleteConfirmId = null;
const message = document.querySelector("#message");
const recognitionProgress = document.querySelector("#recognitionProgress");
const recognitionStage = document.querySelector("#recognitionStage");
const documentLabels = {
  seller_passport: "Паспорт продавца",
  buyer_passport: "Паспорт покупателя",
  vehicle_docs: "ПТС / СТС",
  pts: "ПТС",
  sts: "СТС",
  old_contract: "Старый ДКП",
  other: "Прочее",
  auto: "Автоопределение",
};
const readinessGroups = [
  { label: "Договор", target: "section-contract", fields: ["contract_date", "contract_place"] },
  { label: "Продавец", target: "section-seller", fields: ["seller_full_name", "seller_passport", "seller_address"] },
  { label: "Покупатель", target: "section-buyer", fields: ["buyer_full_name", "buyer_passport", "buyer_address"] },
  { label: "Автомобиль", target: "section-vehicle", fields: ["vehicle_make_model", "vin", "pts_series_number", "sts_series_number"] },
];
const sectionFields = {
  contract: ["contract_number", "contract_date", "contract_place", "price"],
  seller: ["seller_full_name", "seller_birth_date", "seller_phone", "seller_passport", "seller_passport_issue_date", "seller_passport_issued_by", "seller_address"],
  buyer: ["buyer_full_name", "buyer_birth_date", "buyer_phone", "buyer_passport", "buyer_passport_issue_date", "buyer_passport_issued_by", "buyer_address"],
  vehicle: ["vehicle_make_model", "vehicle_type", "vehicle_year", "vin", "body_number", "chassis_number", "color", "registration_plate", "pts_series_number", "sts_series_number"],
  notes: ["seller_notes", "buyer_notes", "vehicle_notes", "notes"],
};
const recognizableFields = new Set([
  ...sectionFields.contract,
  ...sectionFields.seller,
  ...sectionFields.buyer,
  ...sectionFields.vehicle,
]);
const requiredAfterRecognition = [
  "contract_date", "contract_place",
  "seller_full_name", "seller_birth_date", "seller_passport", "seller_passport_issue_date", "seller_passport_issued_by", "seller_address",
  "buyer_full_name", "buyer_birth_date", "buyer_passport", "buyer_passport_issue_date", "buyer_passport_issued_by", "buyer_address",
  "vehicle_make_model", "vehicle_type", "vehicle_year", "vin", "body_number", "color", "registration_plate", "pts_series_number", "sts_series_number",
];
const plateLatinToCyrillic = { A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н", O: "О", P: "Р", C: "С", T: "Т", Y: "У", X: "Х" };
const uploadHintByType = {
  seller_passport: "Разворот и прописка",
  buyer_passport: "Разворот и прописка",
  vehicle_docs: "ПТС и СТС одним комплектом",
  pts: "Все нужные страницы",
  sts: "Обе стороны",
  old_contract: "Печатный или рукописный",
  other: "Любые вложения",
};

function showMessage(text, error = false, action = null, duration = 3000) {
  message.replaceChildren();
  const label = document.createElement("span");
  label.textContent = text;
  message.appendChild(label);
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", action.handler, { once: true });
    message.appendChild(button);
  }
  message.className = `message${error ? " error" : ""}`;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => message.classList.add("hidden"), duration);
}

function startRecognitionProgress() {
  clearInterval(startRecognitionProgress.timer);
  recognitionProgress.classList.remove("hidden");
  recognitionProgress.classList.remove("waiting");
  const bar = recognitionProgress.querySelector(".recognition-progress-bar");
  let percent = 8;
  bar.style.width = `${percent}%`;
  recognitionStage.textContent = "Подготовка документов";
  startRecognitionProgress.timer = setInterval(() => {
    percent = Math.min(88, percent + (percent < 45 ? 7 : 3));
    bar.style.width = `${percent}%`;
    recognitionStage.textContent = percent < 35
      ? "Отправка в OpenRouter"
      : percent < 70
        ? "Чтение документов"
        : "Сверка и заполнение полей";
    if (percent >= 88) {
      recognitionProgress.classList.add("waiting");
      recognitionStage.textContent = "Ожидание ответа OpenRouter";
    }
  }, 900);
}

function finishRecognitionProgress(error = false) {
  clearInterval(startRecognitionProgress.timer);
  const bar = recognitionProgress.querySelector(".recognition-progress-bar");
  recognitionProgress.classList.remove("waiting");
  bar.style.background = error ? "var(--red)" : "var(--accent)";
  bar.style.width = "100%";
  recognitionStage.textContent = error ? "Ошибка распознавания" : "Готово";
  setTimeout(() => {
    recognitionProgress.classList.add("hidden");
    bar.style.width = "0";
    bar.style.background = "";
  }, 500);
}

function beginGlobalRecognition() {
  state.globalRecognitionCount += 1;
  if (state.globalRecognitionCount === 1) startRecognitionProgress();
}

function endGlobalRecognition(error = false) {
  state.globalRecognitionCount = Math.max(0, state.globalRecognitionCount - 1);
  if (state.globalRecognitionCount === 0) finishRecognitionProgress(error);
}

function recognitionIndicator(dealId) {
  const job = state.recognitionJobs.get(Number(dealId));
  if (!job) return "";
  const label = job.status === "queued"
    ? "В очереди"
    : job.status === "done"
      ? "Готово"
      : job.waiting
        ? "Ожидание ответа OpenRouter"
        : "Распознавание";
  const progressText = job.waiting ? "…" : `${Math.round(job.percent || 0)}%`;
  return `<div class="archive-recognition ${job.waiting ? "waiting" : ""}" title="${label}">
    <div><span>${label}</span><small>${progressText}</small></div>
    <i><b style="width:${job.percent || 0}%"></b></i>
  </div>`;
}

function updateRecognitionIndicator(job) {
  const node = document.querySelector(`.archive-item[data-id="${job.dealId}"] .archive-recognition`);
  if (!node) return;
  const label = job.status === "queued"
    ? "В очереди"
    : job.status === "done"
      ? "Готово"
      : job.waiting
        ? "Ожидание ответа OpenRouter"
        : "Распознавание";
  node.classList.toggle("waiting", Boolean(job.waiting));
  node.querySelector("span").textContent = label;
  node.querySelector("small").textContent = job.waiting ? "…" : `${Math.round(job.percent || 0)}%`;
  node.querySelector("b").style.width = `${job.percent || 0}%`;
}

function acquireRecognitionSlot(job) {
  if (state.recognitionActive < 2) {
    state.recognitionActive += 1;
    return Promise.resolve();
  }
  job.status = "queued";
  job.percent = 3;
  updateRecognitionIndicator(job);
  return new Promise(resolve => state.recognitionQueue.push(resolve));
}

function releaseRecognitionSlot() {
  state.recognitionActive = Math.max(0, state.recognitionActive - 1);
  const next = state.recognitionQueue.shift();
  if (next) {
    state.recognitionActive += 1;
    next();
  }
}

function startDealProgress(job) {
  job.status = "working";
  job.percent = 8;
  job.waiting = false;
  updateRecognitionIndicator(job);
  job.timer = setInterval(() => {
    job.percent = Math.min(86, job.percent + (job.percent < 50 ? 6 : 2));
    if (job.percent >= 86) job.waiting = true;
    updateRecognitionIndicator(job);
  }, 900);
}

function syncRecognitionButtons() {
  const busy = Boolean(state.dealId && state.recognitionJobs.has(Number(state.dealId)));
  document.querySelectorAll("#reprocessDeal, [data-reprocess-section], [data-recognize-field]").forEach(button => {
    button.disabled = busy;
    button.classList.toggle("loading", busy);
    if (button.matches("[data-recognize-field]")) {
      button.textContent = busy ? "…" : "↻";
      return;
    }
    const label = button.querySelector(".reprocess-label");
    if (label) label.textContent = busy ? "Распознаю..." : "Распознать заново";
    else button.textContent = busy ? "Распознаю..." : "Распознать";
  });
}

function installFieldRecognitionButtons() {
  for (const fieldName of recognizableFields) {
    const field = form.elements.namedItem(fieldName);
    const label = field?.closest("label");
    if (!field || !label || label.querySelector("[data-recognize-field]")) continue;
    field.classList.add("has-field-recognize");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "field-recognize";
    button.dataset.recognizeField = fieldName;
    button.title = "Распознать только это поле";
    button.setAttribute("aria-label", `Распознать поле ${fieldName}`);
    button.textContent = "↻";
    label.appendChild(button);
  }
}

function clearFieldChoices(fieldNames = []) {
  for (const fieldName of fieldNames) {
    const field = form.elements.namedItem(fieldName);
    field?.closest("label")?.querySelector(".field-choices")?.remove();
  }
}

function showFieldConflicts(conflicts = {}) {
  for (const [fieldName, options] of Object.entries(conflicts)) {
    const field = form.elements.namedItem(fieldName);
    const label = field?.closest("label");
    if (!field || !label || !Array.isArray(options) || options.length < 2) continue;
    clearFieldChoices([fieldName]);
    const panel = document.createElement("div");
    panel.className = "field-choices";
    const title = document.createElement("strong");
    title.textContent = "Найдены разные варианты — выберите:";
    panel.appendChild(title);
    for (const option of options) {
      const choice = document.createElement("button");
      choice.type = "button";
      choice.dataset.fieldChoice = fieldName;
      choice.dataset.fieldValue = option.value;
      choice.textContent = `${option.value} · подтверждений: ${option.support}`;
      panel.appendChild(choice);
    }
    label.appendChild(panel);
  }
}

function formData() {
  const data = Object.fromEntries(new FormData(form).entries());
  for (const key of Object.keys(data)) data[key] = normalizeDealField(key, data[key]);
  data.notes = [data.seller_notes, data.buyer_notes, data.vehicle_notes].filter(Boolean).join("\n\n");
  return data;
}

function setForm(data = {}) {
  form.reset();
  data.vin = data.vin || "ОТСУТСТВУЕТ";
  data.chassis_number = data.chassis_number || "ОТСУТСТВУЕТ";
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
  state.highlightMissing = false;
  updateReadiness();
}

function clearConfidence() {
  form.querySelectorAll("input, textarea").forEach(field => {
    field.classList.remove("confidence-high", "confidence-medium", "confidence-low", "field-missing");
    field.removeAttribute("title");
  });
}

function markMissingFields() {
  form.querySelectorAll("input, textarea").forEach(field => field.classList.remove("field-missing"));
  if (!state.highlightMissing) return;
  for (const name of requiredAfterRecognition) {
    const field = form.elements.namedItem(name);
    if (!field || field.name.endsWith("_phone")) continue;
    if (!String(field.value || "").trim()) field.classList.add("field-missing");
  }
  validateVehicleIdentityFields();
}

function validateVehicleIdentityFields() {
  const vin = form.elements.namedItem("vin");
  const chassis = form.elements.namedItem("chassis_number");
  const absent = value => String(value || "").trim().toUpperCase() === "ОТСУТСТВУЕТ";
  const validVin = value => /^[A-HJ-NPR-Z0-9]{17}$/.test(String(value || "").trim().toUpperCase());
  const validChassis = value => /^[A-ZА-Я0-9-]{5,30}$/.test(String(value || "").trim().toUpperCase());
  vin.classList.toggle("field-missing", !absent(vin.value) && !validVin(vin.value));
  chassis.classList.toggle("field-missing", !absent(chassis.value) && !validChassis(chassis.value));
}

function applyConfidence(meta = {}) {
  markMissingFields();
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.detail || "Ошибка приложения");
    error.status = response.status;
    throw error;
  }
  return body;
}

async function saveDeal(silent = false) {
  const result = await api("/api/deals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deal_id: state.dealId, data: formData() }),
  });
  state.dealId = result.id;
  document.querySelector("#dealBadge").textContent = `№${form.elements.namedItem("contract_number").value || result.id}`;
  if (!silent) showMessage("Карточка сохранена");
  await loadArchive();
  return result.id;
}

async function loadArchive(query = "") {
  const rows = await api(`/api/deals?q=${encodeURIComponent(query)}`);
  const numericNumbers = rows.map(row => Number(row.contract_number || row.id)).filter(Number.isFinite);
  state.nextContractNumber = Math.max(0, ...numericNumbers) + 1;
  const numberField = form.elements.namedItem("contract_number");
  if (!state.dealId && state.contractNumberAuto) numberField.value = state.nextContractNumber;
  const list = document.querySelector("#archiveList");
  list.innerHTML = rows.map(row => `
    <div class="archive-item ${row.id === state.dealId ? "active" : ""}" data-id="${row.id}">
      <div class="archive-head">
        <span class="archive-number">№${escapeHtml(row.contract_number || row.id)}</span>
        ${archiveBadge(row)}
      </div>
      <strong class="archive-person">${escapeHtml(row.buyer_full_name || row.seller_full_name || "Без имени")}</strong>
      ${state.deleteConfirmId === row.id ? `
        <div class="archive-confirm">
          <button class="cancel-delete" type="button" title="Отмена" data-cancel-delete>×</button>
          <button class="confirm-delete" type="button" title="Подтвердить удаление" data-confirm-delete-deal="${row.id}">✓</button>
        </div>
      ` : `<button class="icon-delete archive-delete" type="button" title="Удалить сделку" data-delete-deal="${row.id}">×</button>`}
      <span>${escapeHtml(row.vehicle_make_model || "Автомобиль не указан")}</span>
      <span>${escapeHtml([row.registration_plate, row.vin].filter(Boolean).join(" · "))}</span>
      ${recognitionIndicator(row.id)}
    </div>`).join("") || "<p>Архив пока пуст</p>";
  await loadTrash();
}

async function openDeal(id) {
  const data = await api(`/api/deals/${id}`);
  state.dealId = id;
  state.contractNumberAuto = false;
  setForm(data);
  document.querySelector("#dealBadge").textContent = `№${data.contract_number || id}`;
  syncRecognitionButtons();
  await loadArchive(document.querySelector("#archiveSearch").value);
}

async function newDeal() {
  state.dealId = null;
  state.contractNumberAuto = true;
  state.documents = [];
  setForm({ contract_date: todayLocal(), contract_place: "Якутск" });
  const numberField = form.elements.namedItem("contract_number");
  numberField.value = state.nextContractNumber || 1;
  const fallbackNumber = numberField.value;
  try {
    const next = await api("/api/deals-next-number");
    if (!state.dealId && state.contractNumberAuto && numberField.value === fallbackNumber) {
      numberField.value = next.contract_number;
      state.nextContractNumber = Number(next.contract_number) || state.nextContractNumber;
    }
  } catch {
    // Сохраняем номер, уже вычисленный по загруженному архиву.
  }
  document.querySelector("#dealBadge").textContent = "Новая";
  syncRecognitionButtons();
  document.querySelectorAll(".archive-item").forEach(x => x.classList.remove("active"));
}

async function uploadFiles(files, type = "other") {
  if (!files.length) return;
  if (!state.dealId) await saveDeal(true);
  const dealId = Number(state.dealId);
  showMessage(`Добавлено файлов: ${files.length}`);
  startRecognitionProgress();
  try {
    for (let index = 0; index < files.length; index += 1) {
      await uploadOneFile(files[index], type, index < files.length - 1, dealId);
    }
    finishRecognitionProgress();
  } catch (error) {
    finishRecognitionProgress(true);
    throw error;
  }
}

function uploadOneFile(file, type = "other", deferRecognition = false, dealId = Number(state.dealId)) {
  return new Promise((resolve, reject) => {
  const tempId = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.documents.push({
    id: tempId,
    document_type: type,
    original_name: file.name,
    ocr_status: "uploading",
    file_size: file.size,
    progress: 0,
  });
  renderDocuments();

  const body = new FormData();
  body.append("document_type", type);
  body.append("defer_ocr", deferRecognition ? "true" : "false");
  body.append("file", file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `/api/deals/${dealId}/documents`);
  xhr.upload.onprogress = event => {
    if (!event.lengthComputable) return;
    updateUploadProgress(tempId, Math.round((event.loaded / event.total) * 100), "Загрузка");
  };
  xhr.upload.onload = () => updateUploadProgress(tempId, 100, "Распознавание");
  xhr.onload = () => {
    let result = {};
    try {
      result = JSON.parse(xhr.responseText || "{}");
    } catch {
      updateUploadProgress(tempId, 100, "Ошибка");
      showMessage("Сервер вернул неправильный ответ", true);
      reject(new Error("Сервер вернул неправильный ответ"));
      return;
    }
    if (xhr.status < 200 || xhr.status >= 300) {
      updateUploadProgress(tempId, 100, "Ошибка");
      showMessage(result.detail || "Ошибка загрузки файла", true);
      reject(new Error(result.detail || "Ошибка загрузки файла"));
      return;
    }
    if (Number(state.dealId) === dealId) {
      clearFieldChoices([
        ...Object.keys(result.fields || {}),
        ...Object.keys(result.conflicts || {}),
      ]);
      for (const [key, value] of Object.entries(result.fields || {})) {
        const field = form.elements.namedItem(key);
        const clean = normalizeDealField(key, value);
        if (field && clean && isAllowedFieldForDocument(type, key)) field.value = clean;
      }
      state.highlightMissing = true;
      applyConfidence(result.field_meta || {});
      updateReadiness();
      if (result.note) appendRecognitionNote(type, result.note);
      showFieldConflicts(result.conflicts || {});
      state.documents = state.documents.map(doc => doc.id === tempId ? {
        id: result.document_id,
        document_type: result.effective_type || type,
        original_name: file.name,
        ocr_status: result.status,
        file_size: result.file_size || file.size,
        progress: 100,
      } : doc);
      renderDocuments();
      updateReadiness();
    }
    loadArchive(document.querySelector("#archiveSearch").value).catch(() => {});
    showMessage(`${file.name}: сохранён и обработан`);
    resolve(result);
  };
  xhr.onerror = () => {
    updateUploadProgress(tempId, 100, "Ошибка");
    showMessage(`Не удалось загрузить ${file.name}`, true);
    reject(new Error(`Не удалось загрузить ${file.name}`));
  };
  updateUploadProgress(tempId, 0, "Подготовка");
  xhr.send(body);
  });
}

function updateUploadProgress(id, progress, status) {
  state.documents = state.documents.map(doc => doc.id === id ? { ...doc, progress, ocr_status: status } : doc);
  renderDocuments();
}

function isAllowedFieldForDocument(type, key) {
  if (type === "seller_passport") return key.startsWith("seller_");
  if (type === "buyer_passport") return key.startsWith("buyer_");
  if (["vehicle_docs", "pts", "sts"].includes(type)) {
    return !key.startsWith("seller_") && !key.startsWith("buyer_") && !["price", "contract_date"].includes(key);
  }
  return true;
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
              ${isUploadPending(doc)
                ? `<span class="pending-document">${escapeHtml(doc.original_name)}</span>`
                : `<a href="/api/documents/${doc.id}" target="_blank">${escapeHtml(doc.original_name)}</a>`}
              <small>${isUploadPending(doc) ? `${doc.progress || 0}%` : formatFileSize(doc.file_size)}</small>
              ${isUploadPending(doc) ? `<div class="upload-progress"><span style="width:${doc.progress || 0}%"></span></div>` : ""}
              ${isUploadPending(doc) ? "" : `<button class="icon-delete document-delete" type="button" title="Удалить документ" data-delete-document="${doc.id}">×</button>`}
            </div>
          `).join("")}
        </div>
    `;
  }
  document.querySelector("#documentList").innerHTML = "";
  updateReadiness();
}

function isUploadPending(doc) {
  return String(doc.id || "").startsWith("upload-") || (Number.isFinite(doc.progress) && doc.progress < 100);
}

async function deleteDocument(id) {
  await api(`/api/documents/${id}`, { method: "DELETE" });
  state.documents = state.documents.filter(doc => Number(doc.id) !== Number(id));
  renderDocuments();
  updateReadiness();
  showMessage("Документ удалён");
}

async function deleteDeal(id) {
  await api(`/api/deals/${id}`, { method: "DELETE" });
  if (Number(state.dealId) === Number(id)) newDeal();
  state.deleteConfirmId = null;
  await loadArchive(document.querySelector("#archiveSearch").value);
  showMessage(
    "ДКП перемещён в корзину",
    false,
    {
      label: "Отменить",
      handler: () => restoreDeal(id, true).catch(err => showMessage(err.message, true)),
    },
    3000,
  );
}

async function loadTrash() {
  const panel = document.querySelector("#trashPanel");
  if (!panel) return;
  const rows = await api("/api/deals-trash");
  panel.innerHTML = `
    <button class="trash-toggle" type="button" data-trash-toggle title="Корзина" aria-label="Корзина, удалённых договоров: ${rows.length}" aria-expanded="${state.trashOpen}">
      <svg class="trash-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/>
      </svg>
      <span class="trash-count">${rows.length}</span>
      <svg class="trash-chevron ${state.trashOpen ? "open" : ""}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </button>
    <div class="trash-list ${state.trashOpen ? "" : "hidden"}">
      ${rows.map(row => `
        <div class="trash-item">
          <span class="trash-deal-number">№${escapeHtml(row.contract_number || row.id)}</span>
          <strong>${escapeHtml(row.seller_full_name || "Без продавца")}</strong>
          <span>${escapeHtml(row.vehicle_make_model || "Автомобиль не указан")}</span>
          <small>${formatDeletedAt(row.deleted_at)}</small>
          <div class="trash-actions">
            <button class="button restore-button" type="button" data-restore-deal="${row.id}">Восстановить</button>
            ${state.trashDeleteConfirmId === row.id ? `
              <button class="trash-cancel-delete" type="button" title="Отмена" data-cancel-trash-delete>×</button>
              <button class="trash-confirm-delete" type="button" title="Удалить навсегда" data-confirm-trash-delete="${row.id}">✓</button>
            ` : `<button class="trash-delete" type="button" title="Удалить навсегда" data-delete-trash="${row.id}">×</button>`}
          </div>
        </div>
      `).join("") || `<p>Корзина пуста</p>`}
    </div>
  `;
}

async function restoreDeal(id, fromUndo = false) {
  await api(`/api/deals/${id}/restore`, { method: "POST" });
  await loadArchive(document.querySelector("#archiveSearch").value);
  showMessage(fromUndo ? "Удаление отменено" : "ДКП восстановлен");
}

async function permanentlyDeleteDeal(id) {
  await api(`/api/deals/${id}/permanent`, { method: "DELETE" });
  state.trashDeleteConfirmId = null;
  await loadTrash();
  showMessage("ДКП удалён навсегда");
}

async function makeContract() {
  const button = document.querySelector("#makeContract");
  if (button.disabled) return;
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Формирую Excel...";
  try {
    await saveDeal(true);
    const result = await api(`/api/deals/${state.dealId}/contract`, { method: "POST" });
    showMessage("Excel-файл создан по печатному шаблону");
    window.location.href = result.download_url;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function reprocessDeal(section = "all", triggerButton = null) {
  if (!state.dealId) {
    showMessage("Сначала сохраните сделку и загрузите документы", true);
    return;
  }
  const completedDocuments = state.documents.filter(document => !isUploadPending(document));
  if (!completedDocuments.length) {
    showMessage("Нет документов для распознавания", true);
    return;
  }
  await saveDeal(true);
  const dealId = Number(state.dealId);
  if (state.recognitionJobs.has(dealId)) {
    showMessage("Этот ДКП уже распознаётся или ожидает своей очереди");
    return;
  }
  const button = triggerButton || document.querySelector("#reprocessDeal");
  const job = { dealId, section, status: "queued", percent: 3, timer: null };
  state.recognitionJobs.set(dealId, job);
  syncRecognitionButtons();
  button.disabled = true;
  button.classList.add("loading");
  button.setAttribute("aria-label", "Распознаю документы");
  const label = button.querySelector(".reprocess-label");
  const originalText = button.textContent;
  let succeeded = false;
  await loadArchive(document.querySelector("#archiveSearch").value);
  await acquireRecognitionSlot(job);
  startDealProgress(job);
  beginGlobalRecognition();
  if (label) label.textContent = "Распознаю...";
  try {
    const result = await api(`/api/deals/${dealId}/reprocess?section=${encodeURIComponent(section)}`, { method: "POST" });
    if (Number(state.dealId) === dealId) {
      clearFieldChoices([
        ...Object.keys(result.fields || {}),
        ...Object.keys(result.conflicts || {}),
      ]);
      for (const [key, value] of Object.entries(result.fields || {})) {
        const field = form.elements.namedItem(key);
        const clean = normalizeDealField(key, value);
        if (field && clean) field.value = clean;
      }
      state.highlightMissing = true;
      applyConfidence(result.field_meta || {});
      if (section === "all" || section === "notes") setRecognitionNotes(result.notes_by_group || {}, result.notes || "");
      updateReadiness();
      showFieldConflicts(result.conflicts || {});
    }
    showMessage(`Раздел распознан. Обработано документов: ${result.processed}.`);
    succeeded = true;
  } finally {
    clearInterval(job.timer);
    job.status = "done";
    job.percent = 100;
    job.waiting = false;
    updateRecognitionIndicator(job);
    endGlobalRecognition(!succeeded);
    releaseRecognitionSlot();
    await loadArchive(document.querySelector("#archiveSearch").value).catch(() => {});
    setTimeout(() => {
      state.recognitionJobs.delete(dealId);
      syncRecognitionButtons();
      loadArchive(document.querySelector("#archiveSearch").value).catch(() => {});
    }, 1200);
    button.disabled = false;
    button.classList.remove("loading");
    if (label) label.textContent = "Распознать заново";
    if (!label) button.textContent = originalText;
    button.setAttribute("aria-label", "Распознать документы заново");
    syncRecognitionButtons();
  }
}

async function reprocessSingleField(fieldName, button) {
  if (!state.dealId) {
    showMessage("Сначала создайте и сохраните ДКП", true);
    return;
  }
  const completedDocuments = state.documents.filter(document => !isUploadPending(document));
  if (!completedDocuments.length) {
    showMessage("Нет документов для распознавания", true);
    return;
  }
  await saveDeal(true);
  const dealId = Number(state.dealId);
  if (state.recognitionJobs.has(dealId)) {
    showMessage("Этот ДКП уже распознаётся или ожидает своей очереди");
    return;
  }

  const job = { dealId, section: `field:${fieldName}`, status: "queued", percent: 3, waiting: false, timer: null };
  state.recognitionJobs.set(dealId, job);
  syncRecognitionButtons();
  await loadArchive(document.querySelector("#archiveSearch").value);
  await acquireRecognitionSlot(job);
  startDealProgress(job);
  beginGlobalRecognition();
  let succeeded = false;
  try {
    const result = await api(
      `/api/deals/${dealId}/reprocess-field?field_name=${encodeURIComponent(fieldName)}`,
      { method: "POST" },
    );
    const value = result.fields?.[fieldName];
    if (value && Number(state.dealId) === dealId) {
      const field = form.elements.namedItem(fieldName);
      field.value = normalizeDealField(fieldName, value);
      markMissingFields();
      updateReadiness();
    }
    if (Number(state.dealId) === dealId) {
      clearFieldChoices([fieldName]);
      showFieldConflicts(result.conflicts || {});
    }
    showMessage(value ? "Поле обновлено" : "Поле не удалось надёжно распознать");
    succeeded = true;
  } finally {
    clearInterval(job.timer);
    job.status = "done";
    job.percent = 100;
    job.waiting = false;
    updateRecognitionIndicator(job);
    endGlobalRecognition(!succeeded);
    releaseRecognitionSlot();
    await loadArchive(document.querySelector("#archiveSearch").value).catch(() => {});
    setTimeout(() => {
      state.recognitionJobs.delete(dealId);
      syncRecognitionButtons();
      loadArchive(document.querySelector("#archiveSearch").value).catch(() => {});
    }, 1200);
    button.disabled = false;
    syncRecognitionButtons();
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
    hint.textContent = "Проверьте пустые поля, затем можно создавать договор.";
  } else if (readiness.percent >= 45) {
    title.textContent = "Договор частично заполнен";
    hint.textContent = `Осталось проверить: ${missing.join(", ") || "поля распознавания"}.`;
  } else {
    title.textContent = "Договор пока не заполнен";
    hint.textContent = "Загрузите документы или заполните поля вручную. Подсказка покажет, чего не хватает для Excel.";
  }

  const chips = [
    `<button type="button" class="check-chip ${readiness.documentsDone ? "done" : "warn"}" data-scroll-target="section-documents">Документы: ${state.documents.length}</button>`,
    ...readiness.checks.map(item =>
      `<button type="button" class="check-chip ${item.done ? "done" : "warn"}" data-scroll-target="${item.target}">${item.label}: ${item.filled}/${item.total}</button>`
    ),
  ];
  list.innerHTML = chips.join("");
}

function archiveBadge(row) {
  const totalFields = readinessGroups.flatMap(group => group.fields);
  const filled = totalFields.filter(name => String(row[name] || "").trim()).length;
  const ratio = filled / totalFields.length;
  if (ratio >= .85) return "";
  return `<span class="status-badge status-draft">Черновик</span>`;
}

function scrollToSection(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function clearSection(section) {
  if (section === "documents") {
    const savedDocuments = state.documents.filter(doc => !isUploadPending(doc));
    await Promise.all(savedDocuments.map(doc => api(`/api/documents/${doc.id}`, { method: "DELETE" })));
    state.documents = state.documents.filter(isUploadPending);
    renderDocuments();
    showMessage("Загруженные документы удалены");
    return;
  }
  for (const name of sectionFields[section] || []) {
    const field = form.elements.namedItem(name);
    if (field) field.value = ["vin", "chassis_number"].includes(name) ? "ОТСУТСТВУЕТ" : "";
  }
  markMissingFields();
  updateReadiness();
  showMessage("Поля раздела очищены");
}

function formatDeletedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `Удалено: ${value}`;
  return `Удалено: ${date.toLocaleDateString("ru-RU")} ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
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

function formatStsNumber(value) {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[^0-9А-ЯA-Z]/g, "")
    .replace(/[ABEKMHOPCTYX]/g, char => plateLatinToCyrillic[char] || char);
  const digits = raw.replace(/\D/g, "");
  if (/^\d{10}$/.test(raw)) return `${raw.slice(0, 4)} ${raw.slice(4, 10)}`;
  if (/^\d{2}[А-Я]{2}\d{6}$/.test(raw)) return `${raw.slice(0, 4)} ${raw.slice(4, 10)}`;
  if (digits.length === 10) return `${digits.slice(0, 4)} ${digits.slice(4, 10)}`;
  return raw.slice(0, 10);
}

function formatPtsNumber(value) {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/[^0-9А-ЯA-Z]/g, "")
    .replace(/[ABEKMHOPCTYX]/g, char => plateLatinToCyrillic[char] || char);
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 15) return digits;
  if (/^\d{2}[А-Я]{2}\d{6}$/.test(raw)) return `${raw.slice(0, 4)} ${raw.slice(4, 10)}`;
  if (digits.length === 8) return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
  return raw.slice(0, 15);
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
  if (["seller_passport", "buyer_passport"].includes(key)) return formatSeriesNumber(value);
  if (key === "sts_series_number") return formatStsNumber(value);
  if (key === "pts_series_number") return formatPtsNumber(value);
  if (key === "registration_plate") return normalizePlate(value);
  if (key === "vehicle_type") return String(value || "B/M1").trim() || "B/M1";
  if (key === "vin") {
    const text = String(value).trim().toUpperCase();
    if (text === "ОТСУТСТВУЕТ") return text;
    return text.replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
  }
  return String(value).trim();
}

function noteFieldForType(type) {
  if (type === "buyer_passport") return "buyer_notes";
  if (["vehicle_docs", "pts", "sts", "old_contract", "auto"].includes(type)) return "vehicle_notes";
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
document.querySelector("#topNewDeal").addEventListener("click", () => newDeal().catch(err => showMessage(err.message, true)));
document.querySelector("#makeContract").addEventListener("click", () => makeContract().catch(e => showMessage(e.message, true)));
document.querySelector("#reprocessDeal").addEventListener("click", e => reprocessDeal("all", e.currentTarget).catch(err => showMessage(err.message, true)));
document.querySelector("#sidebarToggle").addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
  const collapsed = document.body.classList.contains("sidebar-collapsed");
  const button = document.querySelector("#sidebarToggle");
  button.title = collapsed ? "Показать архив" : "Свернуть архив";
  button.setAttribute("aria-label", button.title);
});
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
  const confirmButton = e.target.closest("[data-confirm-delete-deal]");
  if (confirmButton) {
    e.preventDefault();
    e.stopPropagation();
    deleteDeal(Number(confirmButton.dataset.confirmDeleteDeal)).catch(err => showMessage(err.message, true));
    return;
  }
  const cancelButton = e.target.closest("[data-cancel-delete]");
  if (cancelButton) {
    e.preventDefault();
    e.stopPropagation();
    state.deleteConfirmId = null;
    loadArchive(document.querySelector("#archiveSearch").value).catch(err => showMessage(err.message, true));
    return;
  }
  const deleteButton = e.target.closest("[data-delete-deal]");
  if (deleteButton) {
    e.preventDefault();
    e.stopPropagation();
    state.deleteConfirmId = Number(deleteButton.dataset.deleteDeal);
    loadArchive(document.querySelector("#archiveSearch").value).catch(err => showMessage(err.message, true));
    return;
  }
  const item = e.target.closest(".archive-item");
  if (item) openDeal(Number(item.dataset.id)).catch(err => showMessage(err.message, true));
});
document.querySelector("#trashPanel").addEventListener("click", e => {
  const toggle = e.target.closest("[data-trash-toggle]");
  if (toggle) {
    state.trashOpen = !state.trashOpen;
    loadTrash().catch(err => showMessage(err.message, true));
    return;
  }
  const restoreButton = e.target.closest("[data-restore-deal]");
  if (restoreButton) {
    restoreDeal(Number(restoreButton.dataset.restoreDeal)).catch(err => showMessage(err.message, true));
    return;
  }
  const deleteButton = e.target.closest("[data-delete-trash]");
  if (deleteButton) {
    state.trashDeleteConfirmId = Number(deleteButton.dataset.deleteTrash);
    loadTrash().catch(err => showMessage(err.message, true));
    return;
  }
  if (e.target.closest("[data-cancel-trash-delete]")) {
    state.trashDeleteConfirmId = null;
    loadTrash().catch(err => showMessage(err.message, true));
    return;
  }
  const confirmButton = e.target.closest("[data-confirm-trash-delete]");
  if (confirmButton) {
    permanentlyDeleteDeal(Number(confirmButton.dataset.confirmTrashDelete)).catch(err => showMessage(err.message, true));
  }
});
document.querySelector("#readinessChecks").addEventListener("click", e => {
  const button = e.target.closest("[data-scroll-target]");
  if (button) scrollToSection(button.dataset.scrollTarget);
});
document.querySelector(".workspace").addEventListener("click", e => {
  const choiceButton = e.target.closest("[data-field-choice]");
  if (choiceButton) {
    const fieldName = choiceButton.dataset.fieldChoice;
    const field = form.elements.namedItem(fieldName);
    if (field) {
      field.value = normalizeDealField(fieldName, choiceButton.dataset.fieldValue);
      clearFieldChoices([fieldName]);
      markMissingFields();
      updateReadiness();
      saveDeal(true).then(() => showMessage("Выбранный вариант сохранён")).catch(err => showMessage(err.message, true));
    }
    return;
  }
  const fieldButton = e.target.closest("[data-recognize-field]");
  if (fieldButton) {
    reprocessSingleField(fieldButton.dataset.recognizeField, fieldButton).catch(err => {
      showMessage(
        err.status === 404
          ? "Сервер не обновлён. Перезапустите сервер и повторите."
          : err.message,
        true,
      );
    });
    return;
  }
  const recognizeButton = e.target.closest("[data-reprocess-section]");
  if (recognizeButton) {
    reprocessDeal(recognizeButton.dataset.reprocessSection, recognizeButton).catch(err => showMessage(err.message, true));
    return;
  }
  const button = e.target.closest("[data-clear-section]");
  if (!button) return;
  clearSection(button.dataset.clearSection).catch(err => showMessage(err.message, true));
});
form.addEventListener("input", e => {
  const field = e.target;
  if (!field.name) return updateReadiness();
  if (field.name === "contract_number") state.contractNumberAuto = false;
  if (field.name.endsWith("_phone")) field.value = formatPhone(field.value);
  if (["seller_passport", "buyer_passport"].includes(field.name)) {
    field.value = formatSeriesNumber(field.value);
  }
  if (field.name === "sts_series_number") field.value = formatStsNumber(field.value);
  if (field.name === "pts_series_number") field.value = formatPtsNumber(field.value);
  if (field.name === "registration_plate") field.value = normalizePlate(field.value);
  if (field.name === "vin" && field.value.toUpperCase() !== "ОТСУТСТВУЕТ") field.value = normalizeDealField("vin", field.value);
  markMissingFields();
  updateReadiness();
});

installFieldRecognitionButtons();
newDeal();
loadArchive().catch(e => showMessage(e.message, true));



