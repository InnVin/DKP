import { Directory, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";

import { contractFileBase, contractHtml } from "@/lib/contract-template";
import { replaceGeneratedFiles } from "@/lib/database";
import { DealData, GeneratedFile } from "@/types/deal";

function outputDirectory(dealId: number) {
  const directory = new Directory(Paths.document, "deals", String(dealId), "generated");
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

type WorkbookRow = { cells: [string, string]; kind: "title" | "meta" | "section" | "field" };

function addSection(rows: WorkbookRow[], title: string, fields: [string, string][]) {
  rows.push({ cells: [title, ""], kind: "section" });
  fields.forEach(([label, value]) => rows.push({ cells: [label, value], kind: "field" }));
}

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function workbookBytes(data: DealData) {
  const rows: WorkbookRow[] = [
    {
      cells: [`ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ № ${data.contract_number}`, ""],
      kind: "title",
    },
    { cells: [`г. ${data.contract_place}`, data.contract_date], kind: "meta" },
  ];
  addSection(rows, "ПРОДАВЕЦ", [
    ["ФИО", data.seller_full_name],
    ["Дата рождения", data.seller_birth_date],
    ["Паспорт", data.seller_passport],
    ["Кем выдан", data.seller_passport_issued_by],
    ["Дата выдачи", data.seller_passport_issue_date],
    ["Адрес", data.seller_address],
    ["Телефон", data.seller_phone],
  ]);
  addSection(rows, "ПОКУПАТЕЛЬ", [
    ["ФИО", data.buyer_full_name],
    ["Дата рождения", data.buyer_birth_date],
    ["Паспорт", data.buyer_passport],
    ["Кем выдан", data.buyer_passport_issued_by],
    ["Дата выдачи", data.buyer_passport_issue_date],
    ["Адрес", data.buyer_address],
    ["Телефон", data.buyer_phone],
  ]);
  addSection(rows, "АВТОМОБИЛЬ", [
    ["Марка, модель", data.vehicle_make_model],
    ["Категория ТС", data.vehicle_type],
    ["Год выпуска", data.vehicle_year],
    ["VIN", data.vin],
    ["Номер кузова", data.body_number],
    ["Номер шасси", data.chassis_number],
    ["Цвет", data.color],
    ["Госномер", data.registration_plate],
    ["ПТС", data.pts_series_number],
    ["СТС", data.sts_series_number],
    ["Стоимость, руб.", data.price],
  ]);

  const styleId = { title: 1, meta: 2, section: 3, field: 4 } as const;
  const worksheetRows = rows
    .map((row, index) => {
      const number = index + 1;
      const height = row.kind === "title" ? 34 : row.kind === "section" ? 25 : 22;
      const secondStyle = row.kind === "field" ? 5 : styleId[row.kind];
      return `<row r="${number}" ht="${height}" customHeight="1">
        <c r="A${number}" t="inlineStr" s="${styleId[row.kind]}"><is><t xml:space="preserve">${xml(row.cells[0])}</t></is></c>
        <c r="B${number}" t="inlineStr" s="${secondStyle}"><is><t xml:space="preserve">${xml(row.cells[1])}</t></is></c>
      </row>`;
    })
    .join("");
  const merged = [
    "A1:B1",
    ...rows
      .map((row, index) => (row.kind === "section" ? `A${index + 1}:B${index + 1}` : ""))
      .filter(Boolean),
  ];

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
      <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
      <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
    </Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
      <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
    </Relationships>`,
  );
  zip.folder("docProps")?.file(
    "core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
      xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <dc:title>Договор купли-продажи автомобиля</dc:title>
      <dc:creator>АвтоДоговор</dc:creator>
      <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
    </cp:coreProperties>`,
  );
  zip.folder("docProps")?.file(
    "app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
      <Application>АвтоДоговор</Application>
    </Properties>`,
  );
  zip.folder("xl")?.file(
    "workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets><sheet name="ДКП" sheetId="1" r:id="rId1"/></sheets>
    </workbook>`,
  );
  zip.folder("xl")?.folder("_rels")?.file(
    "workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    </Relationships>`,
  );
  zip.folder("xl")?.file(
    "styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <fonts count="4">
        <font><sz val="11"/><name val="Times New Roman"/></font>
        <font><b/><sz val="15"/><name val="Times New Roman"/></font>
        <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Times New Roman"/></font>
        <font><b/><sz val="11"/><name val="Times New Roman"/></font>
      </fonts>
      <fills count="3">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FF315B7D"/><bgColor indexed="64"/></patternFill></fill>
      </fills>
      <borders count="2">
        <border><left/><right/><top/><bottom/><diagonal/></border>
        <border><left/><right/><top/><bottom style="thin"><color rgb="FF9CA6AD"/></bottom><diagonal/></border>
      </borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="6">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
        <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
        <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
        <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      </cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`,
  );
  zip.folder("xl")?.folder("worksheets")?.file(
    "sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
      <dimension ref="A1:B${rows.length}"/>
      <sheetViews><sheetView workbookViewId="0"/></sheetViews>
      <sheetFormatPr defaultRowHeight="20"/>
      <cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="78" customWidth="1"/></cols>
      <sheetData>${worksheetRows}</sheetData>
      <mergeCells count="${merged.length}">${merged.map((range) => `<mergeCell ref="${range}"/>`).join("")}</mergeCells>
      <pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
      <pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>
    </worksheet>`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function generateContractFiles(
  dealId: number,
  data: DealData,
  capturedJpgUri?: string,
) {
  const directory = outputDirectory(dealId);
  const base = contractFileBase(data);
  const xlsx = new File(directory, `${base}.xlsx`);
  xlsx.create({ overwrite: true, intermediates: true });
  xlsx.write(await workbookBytes(data));

  const printed = await Print.printToFileAsync({
    html: contractHtml(data),
    width: 595,
    height: 842,
    textZoom: 100,
  });
  const pdf = new File(directory, `${base}.pdf`);
  await new File(printed.uri).copy(pdf, { overwrite: true });

  const files: Omit<GeneratedFile, "id" | "dealId" | "createdAt">[] = [
    {
      kind: "xlsx",
      localUri: xlsx.uri,
      name: xlsx.name,
      syncStatus: "pending",
      remotePath: "",
    },
    {
      kind: "pdf",
      localUri: pdf.uri,
      name: pdf.name,
      syncStatus: "pending",
      remotePath: "",
    },
  ];
  if (capturedJpgUri) {
    const jpg = new File(directory, `${base}.jpg`);
    await new File(capturedJpgUri).copy(jpg, { overwrite: true });
    files.push({
      kind: "jpg",
      localUri: jpg.uri,
      name: jpg.name,
      syncStatus: "pending",
      remotePath: "",
    });
  }
  await replaceGeneratedFiles(dealId, files);
  return files;
}

export async function shareGeneratedFile(uri: string, name: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Системное меню отправки недоступно на этом устройстве.");
  }
  await Sharing.shareAsync(uri, {
    dialogTitle: `Отправить ${name}`,
    mimeType: name.endsWith(".pdf")
      ? "application/pdf"
      : name.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "image/jpeg",
  });
}

export async function printPdf(uri: string) {
  await Print.printAsync({ uri });
}
