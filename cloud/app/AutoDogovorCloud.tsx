"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

type Deal = Record<string, string | number> & { id: string };
type DocumentItem = { id: string; document_type: string; filename: string; status: string; size: number };

const sections = [
  { title: "Договор", fields: [["contract_number", "№ договора"], ["contract_date", "Дата договора"], ["contract_place", "Место составления"], ["price", "Стоимость, руб."]] },
  { title: "Продавец", fields: [["seller_full_name", "ФИО"], ["seller_passport", "Паспорт"], ["seller_passport_issue_date", "Дата выдачи"], ["seller_passport_issued", "Кем выдан"], ["seller_address", "Адрес"], ["seller_phone", "Телефон"]] },
  { title: "Покупатель", fields: [["buyer_full_name", "ФИО"], ["buyer_passport", "Паспорт"], ["buyer_passport_issue_date", "Дата выдачи"], ["buyer_passport_issued", "Кем выдан"], ["buyer_address", "Адрес"], ["buyer_phone", "Телефон"]] },
  { title: "Автомобиль", fields: [["vehicle_make_model", "Марка и модель"], ["vehicle_year", "Год"], ["vehicle_category", "Категория"], ["vehicle_vin", "VIN"], ["vehicle_body", "Кузов"], ["vehicle_chassis", "Шасси"], ["vehicle_color", "Цвет"], ["vehicle_plate", "Госномер"], ["vehicle_pts", "ПТС"], ["vehicle_sts", "СТС"]] },
  { title: "Заметки", fields: [["notes", "Заметки"]] },
] as const;

const documentCards = [
  ["seller_passport", "Паспорт продавца"], ["buyer_passport", "Паспорт покупателя"], ["vehicle", "ПТС / СТС"], ["old_contract", "Старый ДКП"], ["other", "Прочее"],
] as const;

const emptyDeal = (): Deal => ({
  id: "", contract_number: "", contract_date: new Date().toISOString().slice(0, 10), contract_place: "Якутск", price: "",
  seller_full_name: "", seller_passport: "", seller_passport_issue_date: "", seller_passport_issued: "", seller_address: "", seller_phone: "",
  buyer_full_name: "", buyer_passport: "", buyer_passport_issue_date: "", buyer_passport_issued: "", buyer_address: "", buyer_phone: "",
  vehicle_make_model: "", vehicle_year: "", vehicle_category: "", vehicle_vin: "", vehicle_body: "", vehicle_chassis: "", vehicle_color: "", vehicle_plate: "", vehicle_pts: "", vehicle_sts: "", notes: "",
});

const value = (deal: Deal, key: string) => String(deal[key] ?? "");

const targetImageBytes = 900 * 1024;
const maxUploadBytes = 2 * 1024 * 1024;

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Не удалось подготовить фотографию")), "image/jpeg", quality);
  });
}

async function prepareUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    if (file.size > maxUploadBytes) throw new Error(`Файл «${file.name}» слишком большой. Максимум 2 МБ.`);
    return file;
  }

  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Не удалось прочитать фотографию «${file.name}». Выберите JPG, PNG или WEBP.`);
  }

  try {
    const initialScale = Math.min(1, 2400 / Math.max(image.width, image.height));
    let best: Blob | null = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const dimensionScale = initialScale * Math.pow(0.86, Math.floor(attempt / 2));
      const width = Math.max(640, Math.round(image.width * dimensionScale));
      const height = Math.max(640, Math.round(image.height * dimensionScale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Не удалось подготовить фотографию");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      best = await canvasBlob(canvas, Math.max(0.5, 0.9 - (attempt % 2) * 0.16));
      if (best.size <= targetImageBytes) break;
    }
    if (!best || best.size > maxUploadBytes) throw new Error(`Не удалось уменьшить «${file.name}» до допустимого размера.`);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([best], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    image.close();
  }
}

export default function AutoDogovorCloud() {
  const [deal, setDeal] = useState<Deal>(emptyDeal());
  const [deals, setDeals] = useState<Deal[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [step, setStep] = useState(0);
  const [archive, setArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Договор: true });
  const [openArchive, setOpenArchive] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ad-theme");
    const initial = stored ? stored === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    // Theme preference is an external browser setting loaded once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(initial);
    void loadDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("ad-theme", dark ? "dark" : "light"); }, [dark]);

  const filled = useMemo(() => {
    const keys = sections.flatMap(section => section.fields.map(field => field[0])).filter(key => !["seller_phone", "buyer_phone", "contract_number", "contract_date"].includes(key));
    return Math.round(keys.filter(key => value(deal, key)).length / keys.length * 100);
  }, [deal]);

  async function api(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    const text = await response.text();
    let payload: Record<string, any> = {};
    if (text) {
      try { payload = JSON.parse(text); }
      catch {
        if (response.status === 413 || /payload too large/i.test(text)) {
          throw new Error("Фотография слишком большая. Приложение не смогло уменьшить её автоматически.");
        }
        if (!response.ok) throw new Error("Сервер временно не смог обработать запрос. Повторите ещё раз.");
        throw new Error("Сервер вернул непонятный ответ. Повторите ещё раз.");
      }
    }
    if (!response.ok) throw new Error(payload.error || "Не удалось выполнить действие");
    return payload;
  }

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2200); }

  async function loadDeals() {
    setBusy(true);
    try {
      const payload = await api("/api/deals");
      setDeals(payload.deals);
      if (payload.deals.length) await openDeal(payload.deals[0].id);
      else await newDeal();
    } catch (error) { notify(error instanceof Error ? error.message : "Ошибка загрузки"); }
    finally { setBusy(false); }
  }

  async function newDeal() {
    const payload = await api("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setDeal(payload.deal); setDocuments([]); setDeals(current => [payload.deal, ...current]); setArchive(false); setStep(0);
  }

  async function openDeal(id: string) {
    const payload = await api(`/api/deals/${id}`);
    setDeal(payload.deal); setDocuments(payload.documents || []); setArchive(false); setStep(0);
  }

  async function openFiles(id: string) {
    await openDeal(id);
    setStep(2);
  }

  async function save(next = deal) {
    if (!next.id) return;
    const body = Object.fromEntries(
      Object.entries(next).filter(([key]) => !["id", "created_at", "updated_at"].includes(key)),
    );
    const payload = await api(`/api/deals/${next.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setDeal(payload.deal); setDeals(items => items.map(item => item.id === next.id ? payload.deal : item));
  }

  function update(key: string, nextValue: string) { setDeal(current => ({ ...current, [key]: nextValue })); }

  async function upload(type: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); if (!files.length || !deal.id) return;
    event.target.value = "";
    setBusy(true);
    const uploaded: DocumentItem[] = [];
    const failed: string[] = [];
    try {
      for (const file of files) {
        try {
          const prepared = await prepareUpload(file);
          const body = new FormData();
          body.append("document_type", type);
          body.append("photos", prepared);
          const payload = await api(`/api/deals/${deal.id}/documents`, { method: "POST", body });
          uploaded.push(...(payload.documents || []));
        } catch (error) {
          failed.push(error instanceof Error ? error.message : `Не удалось загрузить «${file.name}»`);
        }
      }
      if (uploaded.length) setDocuments(items => [...items, ...uploaded]);
      if (failed.length) notify(`Загружено: ${uploaded.length}. ${failed[0]}`);
      else notify(`Загружено: ${uploaded.length}`);
    } finally { setBusy(false); }
  }

  async function removeDocument(id: string) {
    await api(`/api/deals/${deal.id}/documents/${id}`, { method: "DELETE" });
    setDocuments(items => items.filter(item => item.id !== id)); notify("Фотография удалена");
  }

  async function recognize() {
    if (!documents.length) return notify("Сначала загрузите фотографии");
    setBusy(true);
    try { const payload = await api(`/api/deals/${deal.id}/recognize`, { method: "POST" }); setDeal(payload.deal); notify("Распознавание завершено"); }
    catch (error) { notify(error instanceof Error ? error.message : "Ошибка OCR"); }
    finally { setBusy(false); }
  }

  async function removeDeal(id: string) {
    await api(`/api/deals/${id}`, { method: "DELETE" });
    setDeals(items => items.filter(item => item.id !== id)); notify("ДКП удалён");
  }

  function exportXls() {
    const rows = sections.flatMap(section => [[section.title, ""], ...section.fields.map(([key, label]) => [label, value(deal, key)])]);
    const html = `<html><meta charset="utf-8"><table>${rows.map(row => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td></tr>`).join("")}</table></html>`;
    download(new Blob([html], { type: "application/vnd.ms-excel" }), fileName("xls")); notify("XLS подготовлен");
  }

  function exportJpg() {
    const canvas = document.createElement("canvas"); canvas.width = 1240; canvas.height = 1754;
    const context = canvas.getContext("2d"); if (!context) return;
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#111"; context.textBaseline = "top";
    context.font = "bold 34px Arial"; context.textAlign = "center"; context.fillText(`ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ № ${value(deal, "contract_number")}`, 620, 55);
    context.textAlign = "left"; let y = 125;
    for (const section of sections.slice(0, 4)) { context.font = "bold 24px Arial"; context.fillText(section.title.toUpperCase(), 70, y); y += 38; for (const [key, label] of section.fields) { context.font = "bold 18px Arial"; context.fillText(label, 75, y); context.font = "18px Arial"; context.fillText(value(deal, key) || "________________", 355, y); context.strokeStyle = "#aaa"; context.beginPath(); context.moveTo(70, y + 28); context.lineTo(1170, y + 28); context.stroke(); y += 48; } y += 12; }
    canvas.toBlob(blob => { if (blob) download(blob, fileName("jpg")); }, "image/jpeg", .92); notify("JPG подготовлен");
  }

  function fileName(ext: string) { return `ДКП_${value(deal, "contract_number") || "без_номера"}.${ext}`; }
  function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  return <main className="app-shell">
    <header className="topbar"><div><strong>АвтоДоговор</strong><small>Cloud 1.0.6 · защищённое хранилище</small></div><div className="top-actions"><button className="new-button" onClick={() => void newDeal()}>＋ Новый ДКП</button><button className="theme-toggle" aria-label="Переключить тему" onClick={() => setDark(!dark)}><span>☀</span><i className={dark ? "on" : ""}/><span>☾</span></button></div></header>
    {!archive && <>
      <nav className="steps" aria-label="Этапы">{["1 Документы", "2 Данные", "3 Проверка"].map((label, index) => <button key={label} className={step === index ? "active" : ""} onClick={() => setStep(index)}>{label}</button>)}</nav>
      <div className={`progress ${busy ? "busy" : ""}`}><span style={{ width: busy ? "76%" : `${filled}%` }}/><em>{busy ? "Выполняется операция" : `Заполнено ${filled}%`}</em></div>
      {step === 0 && <section className="workspace"><div className="section-title"><div><h1>Загрузите документы</h1><p>Можно выбрать несколько фотографий. Оригиналы хранятся отдельно внутри этого ДКП.</p></div><button className="primary" disabled={busy || !documents.length} onClick={() => void recognize()}>⌗ Распознать всё</button></div><div className="document-grid">{documentCards.map(([type, title]) => { const items = documents.filter(doc => doc.document_type === type); return <article className="document-card" key={type}><header><b>{title}</b><span>{items.length}</span></header><div className="document-list">{items.map(item => <div className="document-item" key={item.id}><div className="file-icon">▧</div><div><b>{item.filename}</b><small>{item.status === "recognized" ? "Распознано" : "Загружено"}</small></div><button aria-label="Удалить" onClick={() => void removeDocument(item.id)}>🗑</button></div>)}</div><div className="document-actions"><label title="Сфотографировать">📷<input type="file" accept="image/*" capture="environment" multiple onChange={event => void upload(type, event)}/></label><label className="choose">Выбрать фото<input type="file" accept="image/*,application/pdf" multiple onChange={event => void upload(type, event)}/></label><button title="Распознать документы этого типа" disabled={!items.length || busy} onClick={() => void recognize()}>⌗</button></div></article>; })}</div></section>}
      {step === 1 && <section className="workspace data-workspace"><div className="section-title"><div><h1>Данные договора</h1><p>Проверьте распознанные значения. Изменения сохраняются в облаке.</p></div><button className="secondary" onClick={() => void save()}>Сохранить</button></div>{sections.map(section => { const isOpen = expanded[section.title]; const summary = section.fields.map(([key]) => value(deal, key)).filter(Boolean).slice(0, 3).join(" · "); return <article className={`accordion ${isOpen ? "open" : ""}`} key={section.title}><button className="accordion-head" onClick={() => setExpanded(current => ({ ...current, [section.title]: !isOpen }))}><span><b>{section.title}</b><small>{summary || "Пока не заполнено"}</small></span><i>⌄</i></button>{isOpen && <div className="fields">{section.fields.map(([key, label]) => <label key={key}><span>{label}</span>{key === "notes" ? <textarea value={value(deal, key)} onChange={event => update(key, event.target.value)} onBlur={() => void save()}/> : <input type={key.includes("date") ? "date" : "text"} value={value(deal, key)} onChange={event => update(key, event.target.value)} onBlur={() => void save()}/>}</label>)}</div>}</article>; })}</section>}
      {step === 2 && <section className="workspace review"><div className="section-title"><div><h1>Проверка</h1><p>Пустые поля не блокируют создание документа.</p></div></div><ContractPreview deal={deal}/><div className="ready-actions"><button onClick={exportXls}>Скачать XLS</button><button onClick={() => window.print()}>Печать / PDF</button><button onClick={exportJpg}>Скачать JPG</button></div></section>}
      <button className="next-button" onClick={() => setStep(current => Math.min(2, current + 1))}>{step === 2 ? "Готовые файлы" : "Далее →"}</button>
    </>}
    {archive && <section className="workspace archive"><div className="section-title"><div><h1>Архив ДКП</h1><p>Каждая сделка хранится отдельно вместе с фотографиями.</p></div></div><div className="archive-grid">{deals.map(item => { const isOpen = openArchive[item.id]; return <article className={`archive-card ${isOpen ? "open" : ""}`} key={item.id}><button className="archive-head" onClick={() => setOpenArchive(current => ({ ...current, [item.id]: !isOpen }))}><span><b>ДКП № {value(item, "contract_number") || "без номера"}</b><small>{value(item, "contract_date") || "без даты"} · {value(item, "seller_full_name") || "продавец не указан"}</small><small>{value(item, "vehicle_make_model") || "автомобиль не указан"} · {value(item, "vehicle_plate") || value(item, "vehicle_vin") || "без номера"}</small></span><i>⌄</i></button>{isOpen && <div className="archive-details">{sections.slice(0, 4).map(section => <div key={section.title}><b>{section.title}</b>{section.fields.map(([key, label]) => value(item, key) && <p key={key}><span>{label}</span>{value(item, key)}</p>)}</div>)}</div>}<footer><button className="danger" onClick={() => void removeDeal(item.id)}>🗑 Удалить</button><button className="secondary" onClick={() => void openFiles(item.id)}>Файлы</button><button className="primary" onClick={() => void openDeal(item.id)}>Перейти →</button></footer></article>; })}</div></section>}
    <nav className="bottom-nav"><button className={!archive ? "active" : ""} onClick={() => setArchive(false)}>▤<span>ДКП</span></button><button className={archive ? "active" : ""} onClick={() => setArchive(true)}>▣<span>Архив</span></button></nav>
    {toast && <div className="toast">{toast}</div>}
  </main>;
}

function ContractPreview({ deal }: { deal: Deal }) {
  return <article className="contract-preview"><h2>ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ № {value(deal, "contract_number") || "___"}</h2><div className="contract-meta"><span>{value(deal, "contract_place") || "________"}</span><span>{value(deal, "contract_date") || "________"}</span></div>{sections.slice(1, 4).map(section => <section key={section.title}><h3>{section.title.toUpperCase()}</h3>{section.fields.filter(([key]) => key !== "seller_phone" && key !== "buyer_phone").map(([key, label]) => <p key={key}><b>{label}</b><span>{value(deal, key) || ""}</span></p>)}</section>)}<p className="price-line">Стоимость автомобиля: <b>{value(deal, "price") || "________________"}</b> рублей.</p><div className="signatures"><span>Продавец</span><span>Покупатель</span></div></article>;
}

function escapeHtml(text: string) { return text.replace(/[&<>"']/g, item => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[item] || item)); }
