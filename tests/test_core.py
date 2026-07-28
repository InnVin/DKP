import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook

from app.excel_service import _prepare_baza_payload, _write_default_workbook
from app.ocr import extract_fields
from app.field_postprocess import postprocess_fields
from app.hybrid_ocr import _resolve_candidates


class OcrExtractionTests(unittest.TestCase):
    def test_conflicting_candidates_require_user_choice(self):
        resolved, conflicts = _resolve_candidates({
            "body_number": [
                {"value": "SCP92-1009017", "page": 1, "confidence": 0.91},
                {"value": "8CP92-1009017", "page": 2, "confidence": 0.89},
            ]
        }, "vehicle_docs")
        self.assertNotIn("body_number", resolved)
        self.assertEqual(len(conflicts["body_number"]), 2)

    def test_candidate_majority_is_resolved(self):
        resolved, conflicts = _resolve_candidates({
            "body_number": [
                {"value": "SCP92-1009017", "page": 1, "confidence": 0.91},
                {"value": "SCP92-1009017", "page": 2, "confidence": 0.88},
                {"value": "8CP92-1009017", "page": 3, "confidence": 0.90},
            ]
        }, "vehicle_docs")
        self.assertEqual(resolved["body_number"], "SCP92-1009017")
        self.assertNotIn("body_number", conflicts)

    def test_body_number_has_no_model_specific_replacement(self):
        result = postprocess_fields({"body_number": "8CP92-1009017"}, "vehicle_docs")
        self.assertEqual(result["body_number"], "8CP92-1009017")

    def test_extract_vehicle_fields(self):
        text = """
        VIN: XTA210990Y1234567
        Марка, модель: LADA 21099
        Год выпуска: 2000
        Цвет кузова: СЕРЕБРИСТЫЙ
        """
        fields = extract_fields(text, "sts")
        self.assertEqual(fields["vin"], "XTA210990Y1234567")
        self.assertEqual(fields["vehicle_year"], "2000")


class ExcelTests(unittest.TestCase):
    def test_baza_date_format(self):
        payload = _prepare_baza_payload({"contract_date": "2026-06-18"})
        self.assertEqual(payload["contract_date"], "18.06.2026")

    def test_default_workbook_created(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "contract.xlsx"
            seller_name = "Петров Пётр Петрович"
            buyer_name = "Иванов Иван Иванович"
            _write_default_workbook(
                path,
                {
                    "buyer_full_name": buyer_name,
                    "seller_full_name": seller_name,
                    "vin": "XTA210990Y1234567",
                },
            )
            self.assertTrue(path.exists())
            self.assertGreater(path.stat().st_size, 1000)
            workbook = load_workbook(path, read_only=True, data_only=False)
            sheet = workbook.active
            values = [
                str(cell.value or "")
                for row in sheet.iter_rows()
                for cell in row
            ]
            seller_cells = [value for value in values if seller_name in value]
            buyer_cells = [value for value in values if buyer_name in value]
            self.assertGreaterEqual(len(seller_cells), 2)
            self.assertGreaterEqual(len(buyer_cells), 2)
            self.assertTrue(any("Продавец:" in value for value in seller_cells))
            self.assertTrue(any("Покупатель:" in value for value in buyer_cells))
            workbook.close()


if __name__ == "__main__":
    unittest.main()
