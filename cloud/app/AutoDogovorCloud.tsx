"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { PDFDocument, PageSizes } from "pdf-lib";
import { Archive, Camera, ChevronRight, Download, Eraser, FileImage, FileSpreadsheet, FileText, ImagePlus, Moon, RotateCcw, Save, ScanLine, Sun, Trash2, TriangleAlert } from "lucide-react";

type Conflict = { field: string; message: string; sources?: string[] };
type Deal = Record<string, unknown> & { id: string; ocr_conflicts?: Conflict[] };
type DocumentItem = { id: string; document_type: string; filename: string; status: string; size: number };
type Field = readonly [string, string];

const contractFields: Field[] = [["contract_number", "№ договора"], ["contract_date", "Дата"], ["contract_place", "Место"], ["price", "Стоимость, руб."]];
const sellerFields: Field[] = [["seller_full_name", "ФИО"], ["seller_passport", "Паспорт"], ["seller_passport_issue_date", "Дата выдачи"], ["seller_passport_issued", "Кем выдан"], ["seller_address", "Адрес"], ["seller_phone", "Телефон"]];
const buyerFields: Field[] = [["buyer_full_name", "ФИО"], ["buyer_passport", "Паспорт"], ["buyer_passport_issue_date", "Дата выдачи"], ["buyer_passport_issued", "Кем выдан"], ["buyer_address", "Адрес"], ["buyer_phone", "Телефон"]];
const vehicleFields: Field[] = [["vehicle_make_model", "Марка и модель"], ["vehicle_year", "Год"], ["vehicle_category", "Категория"], ["vehicle_vin", "VIN"], ["vehicle_body", "Кузов"], ["vehicle_chassis", "Шасси"], ["vehicle_color", "Цвет"], ["vehicle_plate", "Госномер"], ["vehicle_pts", "ПТС"], ["vehicle_sts", "СТС"]];
const allFields = [...contractFields, ...sellerFields, ...buyerFields, ...vehicleFields, ["notes", "Заметки"] as const];
const documentCards = [["seller_passport", "Паспорт продавца"], ["buyer_passport", "Паспорт покупателя"], ["vehicle", "ПТС / СТС"], ["old_contract", "Старый ДКП"], ["other", "Прочее"]] as const;

const blank = (): Deal => ({ id: "", contract_number: "", contract_date: new Date().toISOString().slice(0, 10), contract_place: "Якутск", price: "", seller_full_name: "", seller_passport: "", seller_passport_issue_date: "", seller_passport_issued: "", seller_address: "", seller_phone: "", buyer_full_name: "", buyer_passport: "", buyer_passport_issue_date: "", buyer_passport_issued: "", buyer_address: "", buyer_phone: "", vehicle_make_model: "", vehicle_year: "", vehicle_category: "", vehicle_vin: "", vehicle_body: "", vehicle_chassis: "", vehicle_color: "", vehicle_plate: "", vehicle_pts: "", vehicle_sts: "", notes: "", ocr_conflicts: [] });
const val = (deal: Deal, key: string) => String(deal[key] ?? "");
const formatDate = (input: unknown) => { const match = String(input ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return match ? `${match[3]}.${match[2]}.${match[1]}` : String(input ?? ""); };

export default function AutoDogovorCloud() {
  const [deal, setDeal] = useState<Deal>(blank());
  const [deals, setDeals] = useState<Deal[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [step, setStep] = useState(0);
  const [archive, setArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(() => typeof window !== "undefined" && (localStorage.getItem("ad-theme") === "dark" || (!localStorage.getItem("ad-theme") && matchMedia("(prefers-color-scheme: dark)").matches)));
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const pending = useRef<{ timer: number; commit: () => void } | null>(null);

  useEffect(() => {
    void loadDeals();
    return () => { if (pending.current) window.clearTimeout(pending.current.timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("ad-theme", dark ? "dark" : "light"); }, [dark]);

  const filled = useMemo(() => Math.round(allFields.filter(([key]) => !["notes", "seller_phone", "buyer_phone", "contract_number"].includes(key)).filter(([key]) => val(deal, key)).length / 22 * 100), [deal]);

  async function api(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Не удалось выполнить действие");
    return payload;
  }
  function notify(message: string) { setToast({ message }); window.setTimeout(() => setToast(current => current?.undo ? current : null), 2400); }
  function delayed(message: string, commit: () => void, undo: () => void) {
    if (pending.current) { window.clearTimeout(pending.current.timer); pending.current.commit(); }
    const timer = window.setTimeout(() => { commit(); pending.current = null; setToast(null); }, 3000);
    pending.current = { timer, commit };
    setToast({ message, undo: () => { window.clearTimeout(timer); pending.current = null; undo(); setToast(null); } });
  }
  async function loadDeals() {
    setBusy(true);
    try { const data = await api("/api/deals"); setDeals(data.deals); if (data.deals.length) await openDeal(data.deals[0].id); else await newDeal(); }
    catch (error) { notify(error instanceof Error ? error.message : "Ошибка загрузки"); }
    finally { setBusy(false); }
  }
  async function newDeal() { const data = await api("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); setDeal(data.deal); setDocuments([]); setDeals(items => [data.deal, ...items]); setArchive(false); setStep(0); }
  async function openDeal(id: string) { const data = await api(`/api/deals/${id}`); setDeal(data.deal); setDocuments(data.documents || []); setArchive(false); }
  async function save(next = deal) {
    if (!next.id) return;
    const body = Object.fromEntries(Object.entries(next).filter(([key]) => !["id", "created_at", "updated_at", "deleted_at"].includes(key)));
    const data = await api(`/api/deals/${next.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setDeal(data.deal); setDeals(items => items.map(item => item.id === next.id ? data.deal : item));
  }
  function update(key: string, nextValue: string) { setDeal(current => ({ ...current, [key]: nextValue, ocr_conflicts: (current.ocr_conflicts || []).filter(conflict => conflict.field !== key) })); }
  function clearSection(fields: Field[], title: string) {
    const before = deal;
    const next = { ...deal, ...Object.fromEntries(fields.map(([key]) => [key, ""])), ocr_conflicts: (deal.ocr_conflicts || []).filter(item => !fields.some(([key]) => key === item.field)) };
    setDeal(next);
    delayed(`${title} очищен`, () => { void save(next); }, () => setDeal(before));
  }
  async function upload(type: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); event.target.value = ""; if (!files.length) return;
    setBusy(true);
    try { for (const file of files) { const body = new FormData(); body.append("document_type", type); body.append("photos", await prepareUpload(file)); const data = await api(`/api/deals/${deal.id}/documents`, { method: "POST", body }); setDocuments(items => [...items, ...(data.documents || [])]); } notify(`Загружено: ${files.length}`); }
    catch (error) { notify(error instanceof Error ? error.message : "Ошибка загрузки"); }
    finally { setBusy(false); }
  }
  function removeDocument(item: DocumentItem) { setDocuments(items => items.filter(doc => doc.id !== item.id)); delayed("Фотография будет удалена", () => { void api(`/api/deals/${deal.id}/documents/${item.id}`, { method: "DELETE" }); }, () => setDocuments(items => [...items, item])); }
  async function recognize() { if (!documents.length) return notify("Сначала загрузите фотографии"); setBusy(true); try { const data = await api(`/api/deals/${deal.id}/recognize`, { method: "POST" }); setDeal(data.deal); setDeals(items => items.map(item => item.id === deal.id ? data.deal : item)); notify(data.conflicts?.length ? "Данные распознаны. Проверьте жёлтые поля" : "Распознавание завершено"); setStep(1); } catch (error) { notify(error instanceof Error ? error.message : "Ошибка OCR"); } finally { setBusy(false); } }
  function removeDeal(item: Deal) { setDeals(items => items.filter(current => current.id !== item.id)); delayed("Договор будет удалён", () => { void api(`/api/deals/${item.id}`, { method: "DELETE" }); }, () => setDeals(items => [item, ...items])); }
  function downloadUrl(url: string) { const link = document.createElement("a"); link.href = url; link.click(); }
  async function exportImage(kind: "jpeg" | "pdf") { const canvas = await drawContract(deal); const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Не удалось создать файл")), "image/jpeg", .96)); const name = `ДКП_${val(deal, "contract_number") || "без_номера"}`; if (kind === "jpeg") return downloadBlob(blob, `${name}.jpeg`); const pdf = await PDFDocument.create(); const page = pdf.addPage(PageSizes.A4); const image = await pdf.embedJpg(await blob.arrayBuffer()); page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() }); const bytes = await pdf.save(); const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes); downloadBlob(new Blob([buffer], { type: "application/pdf" }), `${name}.pdf`); }

  return <main className="app-shell">
    <style>{"button{font-weight:600!important}"}</style>
    <header className="topbar"><div><strong>АвтоДоговор</strong><small>Cloud 1.0.7 · защищённое хранилище</small></div><div className="top-actions"><button className="primary" onClick={() => void newDeal()}><FileText/> Новый ДКП</button><button className="icon-button" aria-label="Переключить тему" onClick={() => setDark(!dark)}>{dark ? <Sun/> : <Moon/>}</button></div></header>
    {!archive && <div className="workflow-rail"><nav className="steps">{["Документы", "Данные", "Проверка"].map((label, index) => <button key={label} className={step === index ? "active" : ""} onClick={() => setStep(index)}>{index + 1}. {label}</button>)}</nav><div className={`progress ${busy ? "busy" : ""}`}><span style={{ width: `${filled}%` }}/><em>{busy ? "Выполняется…" : `${filled}%`}</em></div></div>}
    {!archive && step === 0 && <section className="workspace"><Title title="Документы" text="Загрузите фотографии отдельно по типам — это повышает точность ПТС, СТС и госномера."><button className="primary" disabled={busy || !documents.length} onClick={() => void recognize()}><ScanLine/> Распознать всё</button></Title><div className="document-grid">{documentCards.map(([type, title]) => <article className="card document-card" key={type}><header><b>{title}</b><span>{documents.filter(item => item.document_type === type).length}</span></header>{documents.filter(item => item.document_type === type).map(item => <div className="document-item" key={item.id}><FileImage/><span><b>{item.filename}</b><small>{item.status === "recognized" ? "Распознано" : "Загружено"}</small></span><button className="icon-button" onClick={() => removeDocument(item)}><Trash2/></button></div>)}<footer><label className="icon-button"><Camera/><input type="file" accept="image/*" capture="environment" multiple onChange={event => void upload(type, event)}/></label><label className="choose"><ImagePlus/> Выбрать<input type="file" accept="image/*,application/pdf" multiple onChange={event => void upload(type, event)}/></label></footer></article>)}</div></section>}
    {!archive && step === 1 && <section className="workspace"><Title title="Данные договора" text="Жёлтым отмечены сведения из конфликтующих документов."><button className="secondary" onClick={() => void save()}><Save/> Сохранить</button></Title><Section title="Договор" fields={contractFields} deal={deal} update={update}/><div className="people-grid"><Section title="Продавец" fields={sellerFields} deal={deal} update={update} onClear={() => clearSection(sellerFields, "Продавец")}/><Section title="Покупатель" fields={buyerFields} deal={deal} update={update} onClear={() => clearSection(buyerFields, "Покупатель")}/></div><Section title="Автомобиль" fields={vehicleFields} deal={deal} update={update} columns onClear={() => clearSection(vehicleFields, "Автомобиль")}/><section className="card data-section"><label className="field wide"><span>Заметки</span><textarea value={val(deal, "notes")} onChange={event => update("notes", event.target.value)} onBlur={() => void save()}/></label></section></section>}
    {!archive && step === 2 && <section className="workspace review"><Title title="Готовые файлы" text="Excel заполняется по BAZA.xls; PDF — одна страница A4; JPEG — 2480×3508."/><div className="preview-paper"><h2>ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ</h2><p>{val(deal, "seller_full_name")} → {val(deal, "buyer_full_name")}</p><p>{val(deal, "vehicle_make_model")} · {val(deal, "vehicle_vin")}</p></div><div className="ready-actions"><button onClick={() => downloadUrl(`/api/deals/${deal.id}/export`)}><FileSpreadsheet/> Excel</button><button onClick={() => void exportImage("pdf")}><FileText/> PDF</button><button onClick={() => void exportImage("jpeg")}><FileImage/> JPEG</button></div></section>}
    {!archive && <button className="next-button" onClick={() => setStep(current => Math.min(2, current + 1))}>Далее <ChevronRight/></button>}
    {archive && <section className="workspace"><Title title="Архив ДКП" text="Все действующие договоры и фотографии хранятся отдельно."><button className="secondary" onClick={() => downloadUrl("/api/deals/export")}><Download/> Вся база Excel</button></Title><div className="archive-grid">{deals.map(item => <article className="card archive-card" key={item.id}><div><b>ДКП № {val(item, "contract_number") || "без номера"}</b><small>{formatDate(item.contract_date)} · {val(item, "seller_full_name") || "продавец не указан"}</small><small>{val(item, "vehicle_make_model") || "автомобиль не указан"} · {val(item, "vehicle_plate") || val(item, "vehicle_vin")}</small></div><footer><button className="danger" onClick={() => removeDeal(item)}><Trash2/> Удалить</button><button className="primary" onClick={() => void openDeal(item.id)}>Открыть <ChevronRight/></button></footer></article>)}</div></section>}
    <nav className="bottom-nav"><button className={!archive ? "active" : ""} onClick={() => setArchive(false)}><FileText/><span>ДКП</span></button><button className={archive ? "active" : ""} onClick={() => setArchive(true)}><Archive/><span>Архив</span></button></nav>
    {toast && <div className="toast"><span>{toast.message}</span>{toast.undo && <button onClick={toast.undo}><RotateCcw/> Вернуть</button>}</div>}
  </main>;
}

function Title({ title, text, children }: { title: string; text: string; children?: ReactNode }) { return <div className="section-title"><div><h1>{title}</h1><p>{text}</p></div>{children}</div>; }
function Section({ title, fields, deal, update, onClear, columns }: { title: string; fields: Field[]; deal: Deal; update: (key: string, value: string) => void; onClear?: () => void; columns?: boolean }) {
  return <section className="card data-section"><header><h2>{title}</h2>{onClear && <button className="clear-button" onClick={onClear}><Eraser/> Очистить</button>}</header><div className={`fields ${columns ? "vehicle-fields" : ""}`}>{fields.map(([key, label]) => { const conflict = (deal.ocr_conflicts || []).find(item => item.field === key); return <label className={`field ${conflict ? "conflict" : ""}`} key={key}><span>{label}{conflict && <TriangleAlert aria-label="Конфликт"/>}</span><input type={key.includes("date") ? "date" : "text"} value={val(deal, key)} title={conflict?.message} onChange={event => update(key, event.target.value)}/>{conflict && <small>{conflict.message}</small>}</label>; })}</div></section>;
}

async function prepareUpload(file: File) {
  if (!file.type.startsWith("image/") || file.size <= 1_800_000) return file;
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2200 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d"); if (!context) throw new Error("Не удалось обработать фотографию"); context.drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Не удалось обработать фотографию")), "image/jpeg", .82));
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

type LayoutField = { key: string; x: number; y: number; width: number; height: number; fontSize: number; bold: boolean; align: CanvasTextAlign };
async function drawContract(deal: Deal) {
  const canvas = document.createElement("canvas"); canvas.width = 2480; canvas.height = 3508;
  const context = canvas.getContext("2d")!;
  const [background, layout] = await Promise.all([loadImage("/templates/baza-contract-bg.jpeg"), fetch("/templates/baza-contract-layout.json").then(response => response.json() as Promise<Record<string, LayoutField>>)]);
  context.drawImage(background, 0, 0, canvas.width, canvas.height); context.fillStyle = "#111"; context.textBaseline = "middle";
  for (const field of Object.values(layout)) {
    const raw = field.key.includes("date") ? formatDate(deal[field.key]) : val(deal, field.key);
    if (!raw) continue;
    context.save(); context.beginPath(); context.rect(field.x + 4, field.y + 2, field.width - 8, field.height - 4); context.clip();
    let size = field.fontSize; context.font = `${field.bold ? "bold " : ""}${size}px Arial`; while (size > 18 && context.measureText(raw).width > field.width - 16) { size -= 1; context.font = `${field.bold ? "bold " : ""}${size}px Arial`; }
    context.textAlign = field.align; const x = field.align === "center" ? field.x + field.width / 2 : field.align === "right" ? field.x + field.width - 8 : field.x + 8;
    context.fillText(raw, x, field.y + field.height / 2); context.restore();
  }
  return canvas;
}
function loadImage(source: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Не удалось загрузить шаблон BAZA.xls")); image.src = source; }); }
function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
