"""Run with: python tests/product-thumbnails.test.py (requires Pillow)."""
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import sys
from unittest.mock import patch

from PIL import Image


SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "build-product-thumbnails.py"
SPEC = importlib.util.spec_from_file_location("thumbnails", SCRIPT)
thumbnails = importlib.util.module_from_spec(SPEC)
sys.dont_write_bytecode = True
SPEC.loader.exec_module(thumbnails)
PRODUCT_ID = "c570255f-7ece-4fab-9f7d-c7d0e8e4e1c1"
BASE = f"https://{thumbnails.HOST}/storage/v1/object/public/product-images/test/"


class ThumbnailTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "img/product-thumbs").mkdir(parents=True)
        self.root_patch = patch.object(thumbnails, "ROOT", self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        buffer = io.BytesIO()
        Image.new("RGB", (800, 1200), "red").save(buffer, "JPEG")
        self.raw = buffer.getvalue()

    def test_previews_are_small_and_unchanged_sources_are_never_downloaded_twice(self):
        product = {"id": PRODUCT_ID, "image_urls": [BASE + "front.jpg", BASE + "back.jpg"]}
        with patch.object(thumbnails, "read_limited", return_value=self.raw) as download:
            _, entry = thumbnails.build_product(product, {})
            self.assertEqual(download.call_count, 2)
        for preview in entry["gallery"]:
            with Image.open(self.root / preview["thumbnail"]) as image:
                self.assertEqual(image.format, "WEBP")
                self.assertLessEqual(image.width, 128)
                self.assertLessEqual(image.height, 172)
        with patch.object(thumbnails, "read_limited", side_effect=AssertionError("Unexpected download")):
            self.assertEqual(thumbnails.build_product(product, {PRODUCT_ID: entry})[1], entry)

    def test_current_legacy_cover_is_reused_without_downloading_the_original(self):
        relative = f"img/product-thumbs/{PRODUCT_ID}.webp"
        Image.new("RGB", (360, 540)).save(self.root / relative, "WEBP")
        previous = {PRODUCT_ID: {"source": BASE + "front.jpg", "thumbnail": relative}}
        with patch.object(thumbnails, "read_limited", side_effect=AssertionError("Unexpected download")):
            _, entry = thumbnails.build_product({"id": PRODUCT_ID, "image_urls": [BASE + "front.jpg"]}, previous)
        self.assertEqual(entry["thumbnail"], relative)
        self.assertEqual(len(entry["gallery"]), 1)

    def test_replaced_photo_gets_a_new_cache_path_and_failure_preserves_other_previews(self):
        with patch.object(thumbnails, "read_limited", return_value=self.raw):
            _, old = thumbnails.build_product({"id": PRODUCT_ID, "image_urls": [BASE + "old.jpg"]}, {})
        with patch.object(thumbnails, "read_limited", side_effect=[self.raw, OSError("Unavailable")]):
            _, new = thumbnails.build_product({"id": PRODUCT_ID, "image_urls": [BASE + "new.jpg", BASE + "bad.jpg"]}, {PRODUCT_ID: old})
        self.assertNotEqual(old["thumbnail"], new["thumbnail"])
        self.assertNotEqual(old["gallery"][0]["thumbnail"], new["gallery"][0]["thumbnail"])
        self.assertEqual(len(new["gallery"]), 1)

    def test_nonpublic_or_foreign_sources_are_not_fetched(self):
        with patch.object(thumbnails, "read_limited", side_effect=AssertionError("Unexpected download")):
            result = thumbnails.build_product({"id": PRODUCT_ID, "image_urls": [
                "https://other.example/photo.jpg",
                f"https://{thumbnails.HOST}/storage/v1/object/private/product-images/photo.jpg",
            ]}, {})
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
