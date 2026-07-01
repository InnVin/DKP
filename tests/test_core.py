import tempfile
import unittest
from pathlib import Path

from app.excel_service import _prepare_baza_payload, _write_default_workbook
from app.ocr import extract_fields


class OcrExtractionTests(unittest.TestCase):
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
            _write_default_workbook(
                path,
                {
                    "buyer_full_name": "Иванов Иван Иванович",
                    "seller_full_name": "Петров Пётр Петрович",
                    "vin": "XTA210990Y1234567",
                },
            )
            self.assertTrue(path.exists())
            self.assertGreater(path.stat().st_size, 1000)


if __name__ == "__main__":
    unittest.main()
