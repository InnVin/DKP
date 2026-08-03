const ui = window.AUTODOGOVOR_UI || {};
const form = document.querySelector("#dealForm");
const messageNode = document.querySelector("#message");
const progressNode = document.querySelector("#recognitionProgress");
const progressBar = progressNode.querySelector(".recognition-progress-bar");
const progressLabel = document.querySelector("#recognitionStage");

const state = {
  dealId: null,
  documents: [],
  generatedFiles: [],
  archive: [],
  deleted: [],
  appView: "deal",
  dealTab: "documents",
  nextContractNumber: 1,
  contractNumberAuto: true,
  recognitionRunning: false,
  trashOpen: false,
  deleteConfirmId: null,
  trashDeleteConfirmId: null,
  expandedArchiveIds: new Set(),
  fileSheetDealId: null,
  fileSheetFiles: [],
  pendingDocumentDeletes: new Map(),
  backArmedUntil: 0,
};

const tabs = ["documents", "data", "review"];
const sectionFields = {
  contract: ["contract_number", "contract_date", "contract_place", "price"],
  seller: ["seller_full_name", "seller_birth_date", "seller_phone", "seller_passport", "seller_passport_issue_date", "seller_passport_issued_by", "seller_address"],
  buyer: ["buyer_full_name", "buyer_birth_date", "buyer_phone", "buyer_passport", "buyer_passport_issue_date", "buyer_passport_issued_by", "buyer_address"],
  vehicle: ["vehicle_make_model", "vehicle_type", "vehicle_year", "vin", "body_number", "chassis_number", "color", "registration_plate", "pts_series_number", "sts_series_number"],
  notes: ["seller_notes", "buyer_notes", "vehicle_notes"],
};
const readinessGroups = [
  { key: "contract", label: "Договор", fields: ["contract_place", "price"] },
  { key: "seller", label: "Продавец", fields: ["seller_full_name", "seller_passport", "seller_passport_issued_by", "seller_address"] },
  { key: "buyer", label: "Покупатель", fields: ["buyer_full_name", "buyer_passport", "buyer_passport_issued_by", "buyer_address"] },
  { key: "vehicle", label: "Автомобиль", fields: ["vehicle_make_model", "vehicle_year", "body_number", "color", "pts_series_number", "sts_series_number"] },
];
const warningFields = new Set(readinessGroups.flatMap(group => group.fields));
const documentSection = {
  seller_passport: "seller",
  buyer_passport: "buyer",
  vehicle_docs: "vehicle",
  old_contract: "all",
  other: "all",
};
const plateLatinToCyrillic = { A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н", O: "О", P: "Р", C: "С", T: "Т", Y: "У", X: "Х" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]);
}

function api(url, options = {}) {
  return fetch(url, options).then(async response => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || "Ошибка приложения");
    return body;
  });
}

function showMessage(text, error = false, action = null, duration = 2000) {
  clearTimeout(showMessage.timer);
  messageNode.replaceChildren();
  const label = document.createElement("span");
  label.textContent = text;
  messageNode.appendChild(label);
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      clearTimeout(showMessage.timer);
      messageNode.classList.add("hidden");
      action.handler();
    }, { once: true });
    messageNode.appendChild(button);
  }
  messageNode.className = `message${error ? " error" : ""}`;
  messageNode.setAttribute("role", error ? "alert" : "status");
  showMessage.timer = setTimeout(() => {
    messageNode.classList.add("hidden");
    action?.onExpire?.();
  }, error ? Math.max(3500, duration) : duration);
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith("7")) digits = `7${digits}`;
  digits = digits.slice(0, 11);
  const body = digits.slice(1);
  return [
    "+7",
    body.slice(0, 3) ? ` (${body.slice(0, 3)}${body.length >= 3 ? ")" : ""}` : "",
    body.slice(3, 6) ? ` ${body.slice(3, 6)}` : "",
    body.slice(6, 8) ? `-${body.slice(6, 8)}` : "",
    body.slice(8, 10) ? `-${body.slice(8, 10)}` : "",
  ].join("");
}

function formatDocumentNumber(value, limit = 10) {
  const raw = String(value || "").toUpperCase().replace(/[^0-9А-ЯA-Z]/g, "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return raw.slice(0, limit);
}

function normalizeField(name, value) {
  const text = String(value ?? "").trim();
  if (name.endsWith("_phone")) return formatPhone(text);
  if (["seller_passport", "buyer_passport", "sts_series_number"].includes(name)) return formatDocumentNumber(text);
  if (name === "pts_series_number") return formatDocumentNumber(text, 15);
  if (name === "registration_plate") {
    return text.toUpperCase().replace(/\s+/g, "").replace(/[ABEKMHOPCTYX]/g, char => plateLatinToCyrillic[char] || char).replace(/[^АВЕКМНОРСТУХ0-9]/g, "").slice(0, 9);
  }
  if (name === "vin") {
    if (text.toUpperCase() === "ОТСУТСТВУЕТ") return "ОТСУТСТВУЕТ";
    return text.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
  }
  return text;
}

function formData() {
  const data = Object.fromEntries(new FormData(form).entries());
  for (const key of Object.keys(data)) data[key] = normalizeField(key, data[key]);
  data.notes = [data.seller_notes, data.buyer_notes, data.vehicle_notes].filter(Boolean).join("\n\n");
  return data;
}

function setForm(data = {}) {
  form.reset();
  const values = { vin: "ОТСУТСТВУЕТ", chassis_number: "ОТСУТСТВУЕТ", ...data };
  if (values.notes && !values.seller_notes && !values.buyer_notes && !values.vehicle_notes) values.seller_notes = values.notes;
  for (const [key, value] of Object.entries(values)) {
    const field = form.elements.namedItem(key);
    if (field && typeof value !== "object") field.value = value || "";
  }
  state.documents = data.documents || [];
  state.generatedFiles = data.generated_files || [];
  renderDocuments();
  renderReadyFiles();
  updateReadiness();
}

function sectionSummary(section, data) {
  const preferred = {
    contract: ["contract_place", "price"],
    seller: ["seller_full_name", "seller_passport", "seller_address"],
    buyer: ["buyer_full_name", "buyer_passport", "buyer_address"],
    vehicle: ["vehicle_make_model", "vehicle_year", "registration_plate", "vin"],
    notes: ["seller_notes", "buyer_notes", "vehicle_notes"],
  }[section];
  const filled = preferred.map(name => data[name]).filter(value => String(value || "").trim());
  if (!filled.length) return section === "notes" ? "Не печатаются в договоре" : "Поля не заполнены";
  return filled.slice(0, 3).join(" · ");
}

function readiness() {
  const data = formData();
  const groups = readinessGroups.map(group => {
    const filled = group.fields.filter(name => String(data[name] || "").trim()).length;
    return { ...group, filled, total: group.fields.length };
  });
  const filled = groups.reduce((sum, group) => sum + group.filled, 0);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const documentPoint = state.documents.length ? 1 : 0;
  return { data, groups, percent: Math.round(((filled + documentPoint) / (total + 1)) * 100) };
}

function updateReadiness() {
  const result = readiness();
  document.querySelector("#readinessPercent").textContent = `${result.percent}%`;
  const title = document.querySelector("#readinessTitle");
  title.textContent = result.percent >= 85 ? "Основные данные заполнены" : result.percent >= 40 ? "Договор заполнен частично" : "Договор пока не заполнен";
  document.querySelector("#readinessHint").textContent = "Пустые поля не мешают создать договор.";
  document.querySelector("#readinessChecks").innerHTML = [
    `<button class="check-chip ${state.documents.length ? "done" : ""}" type="button" data-review-target="documents">Документы: ${state.documents.length}</button>`,
    ...result.groups.map(group => `<button class="check-chip ${group.filled === group.total ? "done" : ""}" type="button" data-review-section="${group.key}">${group.label}: ${group.filled}/${group.total}</button>`),
  ].join("");
  const missing = result.groups.flatMap(group => group.fields.filter(name => !String(result.data[name] || "").trim()));
  document.querySelector("#reviewWarnings").innerHTML = missing.length
    ? `<div class="warning">Не заполнено важных полей: ${missing.length}. Файлы всё равно можно создать.</div>`
    : `<div>Критичных пропусков не найдено.</div>`;
  for (const section of Object.keys(sectionFields)) {
    const node = document.querySelector(`[data-section-summary="${section}"]`);
    if (node) node.textContent = sectionSummary(section, result.data);
  }
  form.querySelectorAll("input, textarea").forEach(field => {
    const empty = !String(field.value || "").trim();
    field.classList.toggle("field-missing", state.dealTab === "review" && warningFields.has(field.name) && empty);
  });
  if (!state.recognitionRunning) setProgress(result.percent, `Заполнено ${result.percent}%`);
}

function setProgress(percent, label) {
  const value = Math.max(0, Math.min(100, Number(percent || 0)));
  progressBar.style.width = `${value}%`;
  progressNode.setAttribute("aria-valuenow", String(value));
  progressLabel.textContent = label;
}

function startRecognitionProgress() {
  clearInterval(startRecognitionProgress.timer);
  state.recognitionRunning = true;
  progressNode.classList.remove("waiting");
  let value = 8;
  setProgress(value, "Распознавание документов");
  startRecognitionProgress.timer = setInterval(() => {
    value = Math.min(88, value + (value < 45 ? 7 : 3));
    setProgress(value, "Распознавание документов");
    if (value >= 88) progressNode.classList.add("waiting");
  }, 850);
  syncButtons();
}

function finishRecognitionProgress(error = false) {
  clearInterval(startRecognitionProgress.timer);
  progressNode.classList.remove("waiting");
  progressBar.style.background = error ? "var(--danger)" : "var(--primary)";
  setProgress(100, error ? "Ошибка распознавания" : "Распознавание завершено");
  setTimeout(() => {
    state.recognitionRunning = false;
    progressBar.style.background = "";
    updateReadiness();
    syncButtons();
  }, 650);
}

function renderNavigation() {
  document.querySelector("#webVersionLabel").textContent = `Web/PWA ${ui.version || "1.0.4"} · дизайн ${ui.designReference || "1.0.1.1"}`;
  const nav = document.querySelector(".bottom-navigation");
  nav.replaceChildren(...(ui.bottomNavigation || []).map(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.bottomAction = item.action;
    button.textContent = item.label;
    return button;
  }));
  updateNavigationState();
}

function updateNavigationState() {
  document.querySelectorAll("[data-bottom-action]").forEach(button => button.classList.toggle("active", button.dataset.bottomAction === state.appView));
  document.querySelectorAll("[data-app-view]").forEach(view => view.classList.toggle("active", view.dataset.appView === state.appView));
  document.querySelector("#nextAction").classList.toggle("hidden", state.appView !== "deal");
}

function setAppView(view) {
  state.appView = view;
  updateNavigationState();
  setAppMenu(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "archive") loadArchive(document.querySelector("#archiveSearch").value).catch(error => showMessage(error.message, true));
  if (view === "settings") loadOcrStatus();
}

function setDealTab(tab) {
  if (!tabs.includes(tab)) return;
  state.dealTab = tab;
  document.querySelectorAll("[data-deal-tab]").forEach(button => button.classList.toggle("active", button.dataset.dealTab === tab));
  document.querySelectorAll("[data-tab-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.tabPanel === tab));
  const next = document.querySelector("#nextAction");
  next.textContent = tab === "review" ? "Готовые файлы" : "Далее";
  updateReadiness();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setAppMenu(open) {
  document.querySelector("#appMenuSheet").classList.toggle("hidden", !open);
  document.body.style.overflow = open ? "hidden" : "";
}

function applyTheme(choice, persist = true) {
  const selected = choice === "dark" ? "dark" : "light";
  if (persist) localStorage.setItem("autodogovor-theme", selected);
  const dark = selected === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#182023" : "#0f7470";
  const toggle = document.querySelector("#themeToggle");
  if (toggle) {
    toggle.checked = dark;
    toggle.setAttribute("aria-checked", String(dark));
  }
}

async function saveDeal(silent = false) {
  const result = await api("/api/deals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deal_id: state.dealId, data: formData() }),
  });
  state.dealId = result.id;
  document.querySelector("#dealBadge").textContent = `ДКП №${form.elements.namedItem("contract_number").value || result.id}`;
  if (!silent) showMessage("Карточка сохранена");
  await loadArchive();
  return result.id;
}

async function newDeal() {
  state.dealId = null;
  state.documents = [];
  state.generatedFiles = [];
  state.contractNumberAuto = true;
  setForm({ contract_date: todayLocal(), contract_place: "Якутск" });
  form.elements.namedItem("contract_number").value = state.nextContractNumber || 1;
  try {
    const result = await api("/api/deals-next-number");
    form.elements.namedItem("contract_number").value = result.contract_number;
    state.nextContractNumber = result.contract_number;
  } catch {}
  document.querySelector("#dealBadge").textContent = "Новая ДКП";
  setAppView("deal");
  setDealTab("documents");
  syncButtons();
}

async function openDeal(id) {
  const data = await api(`/api/deals/${id}`);
  state.dealId = Number(id);
  state.contractNumberAuto = false;
  setForm(data);
  document.querySelector("#dealBadge").textContent = `ДКП №${data.contract_number || id}`;
  setAppView("deal");
  setDealTab("documents");
  await loadArchive();
}

function archiveBadge(row) {
  const filled = readinessGroups.flatMap(group => group.fields).filter(name => String(row[name] || "").trim()).length;
  const total = readinessGroups.flatMap(group => group.fields).length;
  return filled / total >= .85 ? "" : `<span class="status-badge">Черновик</span>`;
}

async function loadArchive(query = "") {
  state.archive = await api(`/api/deals?q=${encodeURIComponent(query || "")}`);
  const numbers = state.archive.map(row => Number(row.contract_number || row.id)).filter(Number.isFinite);
  state.nextContractNumber = Math.max(0, ...numbers) + 1;
  document.querySelector("#archiveList").innerHTML = state.archive.map(row => {
    const expanded = state.expandedArchiveIds.has(Number(row.id));
    return `
    <article class="archive-item ${Number(row.id) === Number(state.dealId) ? "active" : ""} ${expanded ? "expanded" : ""}" data-id="${row.id}">
      <div class="archive-head"><span class="archive-number">№${escapeHtml(row.contract_number || row.id)} · ${escapeHtml(row.contract_date || "")}</span>${archiveBadge(row)}</div>
      <strong class="archive-person">${escapeHtml(row.seller_full_name || "Продавец не указан")}</strong>
      <span>${escapeHtml(row.vehicle_make_model || "Автомобиль не указан")}</span>
      <span>${escapeHtml([row.registration_plate, row.vin].filter(Boolean).join(" · ") || "Номера не указаны")}</span>
      <span>${Number(row.document_count || 0)} фото · ${Number(row.generated_count || 0)} файла</span>
      <div class="archive-tools">
        <button class="archive-tool" type="button" data-archive-files="${row.id}" aria-label="Отправить или сохранить файлы">Файлы</button>
        ${state.deleteConfirmId === row.id
          ? `<div class="archive-confirm"><button class="cancel-delete" type="button" data-cancel-delete aria-label="Отмена">×</button><button class="confirm-delete" type="button" data-confirm-delete="${row.id}" aria-label="Подтвердить удаление">✓</button></div>`
          : `<button class="icon-delete archive-delete" type="button" data-delete-deal="${row.id}" aria-label="Переместить ДКП в корзину"><span class="trash-symbol"></span></button>`}
        <button class="archive-toggle" type="button" data-toggle-archive="${row.id}" aria-expanded="${expanded}" aria-label="${expanded ? "Скрыть" : "Показать"} данные ДКП"></button>
      </div>
      <div class="archive-details" aria-hidden="${!expanded}"><div class="archive-details-inner">
        ${renderArchiveDetails(row)}
        <div class="archive-footer"><button class="button primary archive-open" type="button" data-open-deal="${row.id}">Перейти</button></div>
      </div></div>
    </article>`;
  }).join("") || `<p class="empty-state">Архив пока пуст.</p>`;
  await loadTrash();
}

function renderArchiveDetails(row) {
  const groups = [
    ["Договор", [["Номер", "contract_number"], ["Дата", "contract_date"], ["Место", "contract_place"], ["Стоимость", "price"]]],
    ["Продавец", [["ФИО", "seller_full_name"], ["Дата рождения", "seller_birth_date"], ["Телефон", "seller_phone"], ["Паспорт", "seller_passport"], ["Дата выдачи", "seller_passport_issue_date"], ["Кем выдан", "seller_passport_issued_by"], ["Адрес", "seller_address"]]],
    ["Покупатель", [["ФИО", "buyer_full_name"], ["Дата рождения", "buyer_birth_date"], ["Телефон", "buyer_phone"], ["Паспорт", "buyer_passport"], ["Дата выдачи", "buyer_passport_issue_date"], ["Кем выдан", "buyer_passport_issued_by"], ["Адрес", "buyer_address"]]],
    ["Автомобиль", [["Марка и модель", "vehicle_make_model"], ["Категория", "vehicle_type"], ["Год", "vehicle_year"], ["VIN", "vin"], ["Кузов", "body_number"], ["Шасси", "chassis_number"], ["Цвет", "color"], ["Госномер", "registration_plate"], ["ПТС", "pts_series_number"], ["СТС", "sts_series_number"]]],
  ];
  return groups.map(([title, fields]) => `<section class="archive-data-group"><b>${title}</b>${fields.map(([label, key]) => `<div class="archive-data-row"><span>${label}</span><span>${escapeHtml(row[key] || "—")}</span></div>`).join("")}</section>`).join("");
}

async function openArchiveFiles(id) {
  const deal = await api(`/api/deals/${id}`);
  let files = deal.generated_files || [];
  if (!files.length) {
    const result = await api(`/api/deals/${id}/contract`, { method: "POST" });
    files = result.files || [];
    await loadArchive(document.querySelector("#archiveSearch").value);
  }
  openFileSheet(null, files, Number(id));
}

async function loadTrash() {
  state.deleted = await api("/api/deals-trash");
  const panel = document.querySelector("#trashPanel");
  panel.innerHTML = `
    <button class="trash-toggle" type="button" data-trash-toggle aria-expanded="${state.trashOpen}">
      <svg class="trash-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>
      <span>Корзина · ${state.deleted.length}</span>
      <svg class="trash-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </button>
    <div class="trash-list-wrap ${state.trashOpen ? "expanded" : ""}"><div class="trash-list">
      ${state.deleted.map(row => `
        <article class="trash-item">
          <strong>№${escapeHtml(row.contract_number || row.id)} · ${escapeHtml(row.seller_full_name || "Без продавца")}</strong>
          <span>${escapeHtml(row.vehicle_make_model || "Автомобиль не указан")}</span>
          <div class="trash-actions">
            <button class="restore-button" type="button" data-restore-deal="${row.id}">Восстановить</button>
            ${state.trashDeleteConfirmId === row.id
              ? `<button class="trash-cancel-delete" data-cancel-trash-delete>×</button><button class="trash-confirm-delete" data-confirm-trash-delete="${row.id}">✓</button>`
              : `<button class="trash-delete" data-delete-trash="${row.id}">×</button>`}
          </div>
        </article>
      `).join("") || `<p class="empty-state">Корзина пуста.</p>`}
    </div></div>`;
}

function statusLabel(status) {
  const value = String(status || "").toLowerCase();
  if (["openrouter", "done", "recognized"].some(key => value.includes(key))) return "Распознано";
  if (value.includes("upload") || value.includes("загруз")) return "Загрузка";
  if (value.includes("error") || value.includes("ошиб")) return "Ошибка";
  return "Загружено";
}

function isImage(name) {
  return /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(String(name || ""));
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "";
  if (size < 1048576) return `${Math.max(1, Math.round(size / 1024))} Кб`;
  return `${(size / 1048576).toFixed(1).replace(".", ",")} Мб`;
}

function renderDocuments() {
  document.querySelectorAll(".upload-tile").forEach(card => {
    const type = card.dataset.type;
    const docs = state.documents.filter(doc => (doc.document_type || "other") === type);
    card.querySelector("[data-document-count]").textContent = docs.length;
    const list = card.querySelector(".tile-docs");
    list.innerHTML = docs.length ? `<div class="document-items">${docs.map(doc => {
      const pending = String(doc.id).startsWith("upload-");
      const preview = !pending && isImage(doc.original_name)
        ? `<img class="document-thumb" src="/api/documents/${doc.id}" alt="${escapeHtml(doc.original_name)}">`
        : `<div class="document-file-placeholder">${escapeHtml(String(doc.original_name || "Файл").split(".").pop().toUpperCase())}</div>`;
      return `<div class="document-chip" data-document-id="${doc.id}">
        ${preview}
        <div class="document-status-row">
          <small>${pending ? `${escapeHtml(doc.ocr_status || "Загрузка")} · ${doc.progress || 0}%` : statusLabel(doc.ocr_status)}</small>
          ${pending ? "" : `<button class="icon-delete" type="button" data-delete-document="${doc.id}" aria-label="Удалить фотографию"><span class="trash-symbol"></span></button>`}
        </div>
        ${pending ? `<div class="upload-progress"><span style="width:${doc.progress || 0}%"></span></div>` : ""}
      </div>`;
    }).join("")}</div>` : "";
    const recognize = card.querySelector("[data-card-recognize]");
    recognize.disabled = !docs.some(doc => !String(doc.id).startsWith("upload-")) || state.recognitionRunning;
  });
  syncButtons();
  updateReadiness();
}

async function uploadFiles(files, type) {
  if (!files.length) return;
  if (!state.dealId) await saveDeal(true);
  showMessage(`Выбрано фото: ${files.length}`);
  for (const file of files) {
    await uploadOne(file, type);
  }
  const data = await api(`/api/deals/${state.dealId}`);
  state.documents = data.documents || state.documents;
  renderDocuments();
  await loadArchive();
}

function uploadOne(file, type) {
  return new Promise((resolve, reject) => {
    const tempId = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    state.documents.push({ id: tempId, document_type: type, original_name: file.name, ocr_status: "Загрузка", progress: 0, file_size: file.size });
    renderDocuments();
    const body = new FormData();
    body.append("document_type", type);
    body.append("defer_ocr", "true");
    body.append("file", file);
    const request = new XMLHttpRequest();
    request.open("POST", `/api/deals/${state.dealId}/documents`);
    request.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      const doc = state.documents.find(item => item.id === tempId);
      if (doc) doc.progress = Math.round(event.loaded / event.total * 100);
      renderDocuments();
    };
    request.onload = () => {
      const result = JSON.parse(request.responseText || "{}");
      if (request.status < 200 || request.status >= 300) {
        state.documents = state.documents.filter(item => item.id !== tempId);
        renderDocuments();
        reject(new Error(result.detail || "Не удалось загрузить файл"));
        return;
      }
      state.documents = state.documents.map(item => item.id === tempId ? {
        id: result.document_id,
        document_type: result.effective_type || type,
        original_name: file.name,
        ocr_status: result.status,
        file_size: result.file_size || file.size,
      } : item);
      renderDocuments();
      resolve(result);
    };
    request.onerror = () => reject(new Error(`Не удалось загрузить ${file.name}`));
    request.send(body);
  });
}

function applyFields(fields = {}) {
  for (const [name, value] of Object.entries(fields)) {
    const field = form.elements.namedItem(name);
    if (field && value !== null && value !== "") field.value = normalizeField(name, value);
  }
}

function showConflicts(conflicts = {}) {
  form.querySelectorAll(".field-choices").forEach(node => node.remove());
  for (const [name, options] of Object.entries(conflicts)) {
    const field = form.elements.namedItem(name);
    const label = field?.closest("label");
    if (!label || !Array.isArray(options) || options.length < 2) continue;
    const panel = document.createElement("div");
    panel.className = "field-choices";
    panel.innerHTML = `<strong>Выберите распознанный вариант:</strong>${options.map(option => `<button type="button" data-field-choice="${name}" data-field-value="${escapeHtml(option.value)}">${escapeHtml(option.value)}</button>`).join("")}`;
    label.appendChild(panel);
  }
}

function appendNotes(groups = {}, fallback = "") {
  const pairs = [["seller_notes", groups.seller || fallback], ["buyer_notes", groups.buyer], ["vehicle_notes", groups.vehicle]];
  for (const [name, note] of pairs) {
    const field = form.elements.namedItem(name);
    if (field && note) field.value = [field.value, note].filter(Boolean).join("\n\n");
  }
}

async function recognize(section = "all") {
  if (!state.documents.length) return showMessage("Сначала добавьте фотографии", true);
  await saveDeal(true);
  startRecognitionProgress();
  try {
    const result = await api(`/api/deals/${state.dealId}/reprocess?section=${encodeURIComponent(section)}`, { method: "POST" });
    applyFields(result.fields || {});
    showConflicts(result.conflicts || {});
    appendNotes(result.notes_by_group || {}, result.notes || "");
    state.documents = (await api(`/api/deals/${state.dealId}`)).documents || state.documents;
    renderDocuments();
    updateReadiness();
    await saveDeal(true);
    finishRecognitionProgress(false);
    const firstError = result.errors?.[0]?.message || result.notes;
    if (!result.processed) {
      showMessage(firstError || "Сервис не смог распознать загруженные фотографии", true, null, 6500);
    } else if (result.status === "partial") {
      showMessage(`Обработано документов: ${result.processed}. ${firstError || "Часть фотографий не распознана."}`, true, null, 6500);
    } else {
      showMessage(`Распознавание завершено. Обработано документов: ${result.processed}.`);
    }
  } catch (error) {
    finishRecognitionProgress(true);
    showMessage(error.message, true);
  }
}

function deleteDocument(id) {
  const index = state.documents.findIndex(doc => Number(doc.id) === Number(id));
  if (index < 0) return;
  const [removed] = state.documents.splice(index, 1);
  renderDocuments();
  const timer = setTimeout(() => {
    state.pendingDocumentDeletes.delete(Number(id));
    api(`/api/documents/${id}`, { method: "DELETE" }).then(loadArchive).catch(error => showMessage(error.message, true));
  }, 2100);
  state.pendingDocumentDeletes.set(Number(id), { timer, removed, index });
  showMessage("Фотография удалена", false, {
    label: "Отменить",
    handler: () => {
      const pending = state.pendingDocumentDeletes.get(Number(id));
      if (!pending) return;
      clearTimeout(pending.timer);
      state.pendingDocumentDeletes.delete(Number(id));
      state.documents.splice(Math.min(pending.index, state.documents.length), 0, pending.removed);
      renderDocuments();
      showMessage("Удаление отменено");
    },
  });
}

function renderReadyFiles() {
  const container = document.querySelector("#readyFiles");
  container.innerHTML = state.generatedFiles.length ? state.generatedFiles.map(file => `
    <button class="ready-file" type="button" data-ready-file="${file.id}">
      <b>${escapeHtml(file.kind.toUpperCase())}</b><span>${escapeHtml(file.name)}</span><small>${formatFileSize(file.file_size)}</small>
    </button>`).join("") : `<p class="empty-state">Файлы ещё не созданы.</p>`;
}

async function makeContract() {
  const button = document.querySelector("#makeContract");
  button.disabled = true;
  button.textContent = "Создаём…";
  try {
    await saveDeal(true);
    const result = await api(`/api/deals/${state.dealId}/contract`, { method: "POST" });
    state.generatedFiles = result.files || [];
    renderReadyFiles();
    showMessage("XLSX, PDF и JPG готовы");
    openFileSheet(null, state.generatedFiles, Number(state.dealId));
    await loadArchive();
  } finally {
    button.disabled = false;
    button.textContent = "Создать";
  }
}

function openFileSheet(fileId = null, sourceFiles = state.generatedFiles, dealId = state.dealId) {
  if (!sourceFiles.length) {
    setDealTab("review");
    return showMessage("Сначала создайте готовые файлы");
  }
  state.fileSheetDealId = Number(dealId);
  state.fileSheetFiles = sourceFiles;
  const files = fileId ? sourceFiles.filter(file => Number(file.id) === Number(fileId)) : sourceFiles;
  document.querySelector("#readyFileOptions").innerHTML = files.map(file => `
    <div class="file-option">
      <b>${escapeHtml(file.kind.toUpperCase())}</b>
      <div class="file-name-edit">
        <input type="text" value="${escapeHtml(file.name)}" data-file-name="${file.id}" maxlength="120" aria-label="Название файла ${escapeHtml(file.kind.toUpperCase())}">
        <button type="button" data-rename-file="${file.id}">Сохранить имя</button>
      </div>
      <div class="file-option-actions">
        <button type="button" data-share-file="${file.id}">Отправить</button>
        <a href="${file.download_url}" download>Скачать</a>
        ${file.kind === "pdf" ? `<button type="button" data-print-file="${file.id}">Печать</button>` : ""}
      </div>
    </div>`).join("");
  document.querySelector("#fileActionSheet").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeFileSheet() {
  document.querySelector("#fileActionSheet").classList.add("hidden");
  document.body.style.overflow = "";
}

async function shareFile(id) {
  const file = state.fileSheetFiles.find(item => Number(item.id) === Number(id));
  if (!file) return;
  try {
    const response = await fetch(file.download_url);
    const blob = await response.blob();
    const sharedFile = new File([blob], file.name, { type: file.media_type });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [sharedFile] }))) {
      await navigator.share({ files: [sharedFile], title: file.name });
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }
  const link = document.createElement("a");
  link.href = file.download_url;
  link.download = file.name;
  link.click();
  showMessage("Системная отправка недоступна — файл скачан");
}

async function renameReadyFile(id) {
  const input = document.querySelector(`[data-file-name="${id}"]`);
  if (!input) return;
  const file = await api(`/api/deals/${state.fileSheetDealId}/files/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.value.trim() }),
  });
  state.fileSheetFiles = state.fileSheetFiles.map(item => Number(item.id) === Number(id) ? file : item);
  if (Number(state.fileSheetDealId) === Number(state.dealId)) {
    state.generatedFiles = state.generatedFiles.map(item => Number(item.id) === Number(id) ? file : item);
    renderReadyFiles();
  }
  openFileSheet(null, state.fileSheetFiles, state.fileSheetDealId);
  showMessage("Название файла сохранено");
}

function syncButtons() {
  const hasDocuments = state.documents.some(doc => !String(doc.id).startsWith("upload-"));
  document.querySelector("#reprocessDeal").disabled = !hasDocuments || state.recognitionRunning;
  document.querySelectorAll("[data-card-recognize]").forEach(button => {
    const hasType = state.documents.some(doc => doc.document_type === button.dataset.cardRecognize && !String(doc.id).startsWith("upload-"));
    button.disabled = !hasType || state.recognitionRunning;
  });
}

async function loadOcrStatus() {
  try {
    const status = await api("/api/health");
    const ocr = status.openrouter_ocr || {};
    document.querySelector("#ocrSettingsStatus").textContent = ocr.configured
      ? `OpenRouter подключён · ${ocr.model}`
      : "OpenRouter не настроен. Добавьте API-ключ в конфигурацию.";
  } catch (error) {
    document.querySelector("#ocrSettingsStatus").textContent = error.message;
  }
}

function armBack() {
  const now = Date.now();
  if (state.backArmedUntil > now) return true;
  state.backArmedUntil = now + 2000;
  showMessage("Нажмите «Назад» ещё раз для выхода");
  return false;
}

document.querySelector("#dealTabs").addEventListener("click", event => {
  const button = event.target.closest("[data-deal-tab]");
  if (button) setDealTab(button.dataset.dealTab);
});
document.querySelector("#nextAction").addEventListener("click", () => {
  if (state.dealTab === "review") return openFileSheet();
  setDealTab(tabs[Math.min(tabs.length - 1, tabs.indexOf(state.dealTab) + 1)]);
});
document.querySelector(".bottom-navigation").addEventListener("click", event => {
  const button = event.target.closest("[data-bottom-action]");
  if (button) setAppView(button.dataset.bottomAction);
});
document.querySelector("#sidebarToggle").addEventListener("click", () => setAppMenu(true));
document.querySelector("#appMenuSheet").addEventListener("click", event => {
  if (event.target.closest("[data-close-menu]")) return setAppMenu(false);
  const action = event.target.closest("[data-app-action]")?.dataset.appAction;
  if (!action) return;
  if (action === "new") return newDeal();
  if (action === "files") {
    setAppView("deal");
    setDealTab("review");
    setAppMenu(false);
    return openFileSheet();
  }
  if (action === "install") {
    setAppMenu(false);
    document.querySelector("#installPwa").click();
    return;
  }
  setAppView(action);
});
document.querySelector("#saveDeal").addEventListener("click", () => saveDeal().catch(error => showMessage(error.message, true)));
document.querySelector("#archiveNewDeal").addEventListener("click", newDeal);
document.querySelector("#topNewDeal").addEventListener("click", newDeal);
document.querySelector("#reprocessDeal").addEventListener("click", () => recognize("all"));
document.querySelector("#makeContract").addEventListener("click", () => makeContract().catch(error => showMessage(error.message, true)));
document.querySelector("#uploadGrid").addEventListener("change", event => {
  const input = event.target.closest("input[type=file]");
  if (!input) return;
  uploadFiles([...input.files], input.dataset.documentType).catch(error => showMessage(error.message, true));
  input.value = "";
});
document.querySelector("#uploadGrid").addEventListener("click", event => {
  const recognizeButton = event.target.closest("[data-card-recognize]");
  if (recognizeButton) recognize(documentSection[recognizeButton.dataset.cardRecognize] || "all");
  const deleteButton = event.target.closest("[data-delete-document]");
  if (deleteButton) deleteDocument(deleteButton.dataset.deleteDocument);
});
document.querySelector("#archiveSearch").addEventListener("input", event => loadArchive(event.target.value).catch(error => showMessage(error.message, true)));
document.querySelector("#archiveList").addEventListener("click", event => {
  const toggle = event.target.closest("[data-toggle-archive]");
  if (toggle) {
    const id = Number(toggle.dataset.toggleArchive);
    if (state.expandedArchiveIds.has(id)) state.expandedArchiveIds.delete(id);
    else state.expandedArchiveIds.add(id);
    return loadArchive(document.querySelector("#archiveSearch").value);
  }
  const filesButton = event.target.closest("[data-archive-files]");
  if (filesButton) return openArchiveFiles(filesButton.dataset.archiveFiles).catch(error => showMessage(error.message, true));
  const openButton = event.target.closest("[data-open-deal]");
  if (openButton) return openDeal(openButton.dataset.openDeal).catch(error => showMessage(error.message, true));
  const deleteButton = event.target.closest("[data-delete-deal]");
  if (deleteButton) {
    event.stopPropagation();
    state.deleteConfirmId = Number(deleteButton.dataset.deleteDeal);
    return loadArchive(document.querySelector("#archiveSearch").value);
  }
  if (event.target.closest("[data-cancel-delete]")) {
    event.stopPropagation();
    state.deleteConfirmId = null;
    return loadArchive(document.querySelector("#archiveSearch").value);
  }
  const confirm = event.target.closest("[data-confirm-delete]");
  if (confirm) {
    event.stopPropagation();
    const id = Number(confirm.dataset.confirmDelete);
    api(`/api/deals/${id}`, { method: "DELETE" }).then(async () => {
      state.deleteConfirmId = null;
      if (state.dealId === id) await newDeal();
      await loadArchive();
      showMessage("ДКП перемещён в корзину", false, {
        label: "Отменить",
        handler: () => api(`/api/deals/${id}/restore`, { method: "POST" }).then(loadArchive),
      });
    }).catch(error => showMessage(error.message, true));
    return;
  }
});
document.querySelector("#trashPanel").addEventListener("click", event => {
  if (event.target.closest("[data-trash-toggle]")) {
    state.trashOpen = !state.trashOpen;
    return loadTrash();
  }
  const restore = event.target.closest("[data-restore-deal]");
  if (restore) return api(`/api/deals/${restore.dataset.restoreDeal}/restore`, { method: "POST" }).then(loadArchive).then(() => showMessage("ДКП восстановлен"));
  const remove = event.target.closest("[data-delete-trash]");
  if (remove) {
    state.trashDeleteConfirmId = Number(remove.dataset.deleteTrash);
    return loadTrash();
  }
  if (event.target.closest("[data-cancel-trash-delete]")) {
    state.trashDeleteConfirmId = null;
    return loadTrash();
  }
  const confirm = event.target.closest("[data-confirm-trash-delete]");
  if (confirm) return api(`/api/deals/${confirm.dataset.confirmTrashDelete}/permanent`, { method: "DELETE" }).then(() => {
    state.trashDeleteConfirmId = null;
    return loadArchive();
  }).then(() => showMessage("ДКП удалён навсегда"));
});
document.querySelector("#readinessChecks").addEventListener("click", event => {
  if (event.target.closest("[data-review-target=documents]")) return setDealTab("documents");
  const section = event.target.closest("[data-review-section]")?.dataset.reviewSection;
  if (section) {
    setDealTab("data");
    document.querySelector(`#section-${section}`)?.setAttribute("open", "");
    setTimeout(() => document.querySelector(`#section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }
});
document.querySelector("#readyFiles").addEventListener("click", event => {
  const button = event.target.closest("[data-ready-file]");
  if (button) openFileSheet(button.dataset.readyFile);
});
document.querySelector("#fileActionSheet").addEventListener("click", event => {
  if (event.target.closest("[data-close-files]")) return closeFileSheet();
  const share = event.target.closest("[data-share-file]");
  if (share) shareFile(share.dataset.shareFile);
  const rename = event.target.closest("[data-rename-file]");
  if (rename) renameReadyFile(rename.dataset.renameFile).catch(error => showMessage(error.message, true));
  const print = event.target.closest("[data-print-file]");
  if (print) {
    const file = state.fileSheetFiles.find(item => Number(item.id) === Number(print.dataset.printFile));
    if (file) window.open(`${file.download_url}?inline=1`, "_blank", "noopener");
  }
});
document.querySelector("#themeToggle").addEventListener("change", event => applyTheme(event.target.checked ? "dark" : "light"));
form.addEventListener("input", updateReadiness);
form.addEventListener("change", event => {
  if (event.target.name) event.target.value = normalizeField(event.target.name, event.target.value);
  updateReadiness();
});
form.addEventListener("click", event => {
  const choice = event.target.closest("[data-field-choice]");
  if (!choice) return;
  form.elements.namedItem(choice.dataset.fieldChoice).value = choice.dataset.fieldValue;
  choice.closest(".field-choices")?.remove();
  updateReadiness();
});

let swipeStart = null;
document.querySelector("#dealView").addEventListener("touchstart", event => {
  const touch = event.changedTouches[0];
  if (!touch || event.target.closest("input, textarea, button, label, summary, .document-chip, .app-menu-sheet")) return swipeStart = null;
  swipeStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
document.querySelector("#dealView").addEventListener("touchend", event => {
  if (!swipeStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipeStart.x;
  const dy = touch.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  const next = Math.max(0, Math.min(tabs.length - 1, tabs.indexOf(state.dealTab) + (dx < 0 ? 1 : -1)));
  setDealTab(tabs[next]);
}, { passive: true });

history.replaceState({ autodogovor: true }, "");
history.pushState({ autodogovor: true }, "");
window.addEventListener("popstate", () => {
  if (armBack()) {
    history.go(-1);
    return;
  }
  history.pushState({ autodogovor: true }, "");
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!document.querySelector("#fileActionSheet").classList.contains("hidden")) return closeFileSheet();
  if (!document.querySelector("#appMenuSheet").classList.contains("hidden")) return setAppMenu(false);
  if (armBack()) history.back();
});

const installButton = document.querySelector("#installPwa");
let installPrompt = null;
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  installButton.classList.remove("hidden");
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) return showMessage("Установка доступна через меню браузера");
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.classList.add("hidden");
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.classList.add("hidden");
  showMessage("PWA установлено");
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => {
  if (!localStorage.getItem("autodogovor-theme")) applyTheme(event.matches ? "dark" : "light", false);
});

if ("serviceWorker" in navigator && (window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {}));
}

renderNavigation();
const savedTheme = localStorage.getItem("autodogovor-theme");
applyTheme(savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"), Boolean(savedTheme));
setDealTab("documents");
loadArchive().then(newDeal).catch(error => showMessage(error.message, true));
