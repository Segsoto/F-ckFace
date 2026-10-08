"""Create small local catalogue covers from the current public Supabase catalogue.

Run with Python 3 and Pillow after products change, then deploy the generated
images and product-thumbnails.js together with the site.
"""

import io
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
CONFIG = (ROOT / "config.js").read_text(encoding="utf-8")
URL = re.search(r'url:\s*"(https://[^\"]+)"', CONFIG).group(1)
KEY = re.search(r'anonKey:\s*"([^\"]+)"', CONFIG).group(1)
HOST = urlparse(URL).hostname
OUTPUT = ROOT / "img" / "product-thumbs"
MAP = ROOT / "assets" / "js" / "shared" / "product-thumbnails.js"


def read_limited(request, limit=10_000_000):
    with urlopen(request, timeout=30) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Image or response exceeds size limit")
    return data


def main():
    catalogue = json.loads(read_limited(Request(
        URL + "/rest/v1/rpc/get_public_catalog",
        data=b"{}",
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
        method="POST",
    )))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    mapping = {}
    for product in catalogue:
        source = (product.get("image_urls") or [None])[0]
        product_id = product.get("id", "")
        parsed = urlparse(source or "")
        if not re.fullmatch(r"[0-9a-f-]{36}", product_id) or parsed.scheme != "https" or parsed.hostname != HOST or not parsed.path.startswith("/storage/v1/object/public/product-images/"):
            continue
        try:
            raw = read_limited(Request(source))
            with Image.open(io.BytesIO(raw)) as image:
                image = ImageOps.exif_transpose(image).convert("RGB")
                image.thumbnail((400, 540), Image.Resampling.LANCZOS)
                image.save(OUTPUT / f"{product_id}.webp", "WEBP", quality=60, method=6)
            mapping[product_id] = {"source": source, "thumbnail": f"img/product-thumbs/{product_id}.webp"}
        except Exception as error:
            print(f"Skipped {product_id}: {error}")
    MAP.write_text("window.ProductThumbnails = " + json.dumps(mapping, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"Created {len(mapping)} catalogue covers in {OUTPUT}")


if __name__ == "__main__":
    main()
