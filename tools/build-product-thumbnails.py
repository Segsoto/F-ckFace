"""Create static WebP covers and gallery previews for the public catalogue.

Run with Python 3 and Pillow after products change, then deploy the generated
images and product-thumbnails.js together with the site.
"""

import io
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
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
COVER_VERSION = 2
COVER_SIZE = (800, 1080)
COVER_QUALITY = 88


def read_limited(request, limit=10_000_000):
    with urlopen(request, timeout=30) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Image or response exceeds size limit")
    return data


def existing_mapping():
    if not MAP.exists():
        return {}
    return json.loads(MAP.read_text(encoding="utf-8").split("=", 1)[1].strip().rstrip(";"))


def local_thumbnail(entry, source):
    thumbnail = entry.get("thumbnail", "")
    if entry.get("cover_version") == COVER_VERSION and entry.get("source") == source and re.fullmatch(r"img/product-thumbs/[0-9a-f-]+(?:-cover)?\.webp", thumbnail) and (ROOT / thumbnail).is_file():
        return thumbnail
    return None


def save_thumbnail(image, destination, size, quality=60):
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    copy.save(destination, "WEBP", quality=quality, method=6)


def build_product(product, previous):
    product_id = product.get("id", "")
    if not re.fullmatch(r"[0-9a-f-]{36}", product_id):
        return None
    sources = product.get("image_urls") or []
    if not isinstance(sources, list):
        return None
    entry = previous.get(product_id, {})
    result = {"gallery": []}
    for index, source in enumerate(sources):
        parsed = urlparse(source or "")
        if parsed.scheme != "https" or parsed.hostname != HOST or not parsed.path.startswith("/storage/v1/object/public/product-images/"):
            continue
        digest = hashlib.sha256(source.encode("utf-8")).hexdigest()[:20]
        preview_path = f"img/product-thumbs/{product_id}-{digest}.webp"
        cover_path = local_thumbnail(entry, source) if index == 0 else None
        try:
            if not (ROOT / preview_path).is_file() or (index == 0 and not cover_path):
                # A current local cover is enough to build its 128px preview.
                raw = (ROOT / cover_path).read_bytes() if cover_path else read_limited(Request(source))
                with Image.open(io.BytesIO(raw)) as image:
                    image = ImageOps.exif_transpose(image).convert("RGB")
                    if index == 0 and not cover_path:
                        cover_digest = hashlib.sha256(f"{source}|cover-v{COVER_VERSION}|{COVER_SIZE}|q{COVER_QUALITY}".encode("utf-8")).hexdigest()[:20]
                        destination = f"img/product-thumbs/{product_id}-{cover_digest}-cover.webp"
                        save_thumbnail(image, ROOT / destination, COVER_SIZE, COVER_QUALITY)
                        cover_path = destination
                    if not (ROOT / preview_path).is_file():
                        save_thumbnail(image, ROOT / preview_path, (128, 172))
            if index == 0:
                result.update(source=source, thumbnail=cover_path, cover_version=COVER_VERSION)
            result["gallery"].append({"source": source, "thumbnail": preview_path})
        except Exception as error:
            print(f"Skipped {product_id} image {index + 1}: {error}", flush=True)
            if index == 0 and cover_path:
                result.update(source=source, thumbnail=cover_path, cover_version=COVER_VERSION)
    if result["gallery"] or result.get("thumbnail"):
        print(f"Ready {product_id}: {len(result['gallery'])} previews", flush=True)
        return product_id, result
    return None


def main():
    catalogue = json.loads(read_limited(Request(
        URL + "/rest/v1/rpc/get_public_catalog",
        data=b"{}",
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
        method="POST",
    )))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    previous = existing_mapping()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = pool.map(lambda product: build_product(product, previous), catalogue)
        mapping = dict(result for result in results if result)
    MAP.write_text("window.ProductThumbnails = " + json.dumps(mapping, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"Prepared {len(mapping)} products with {sum(len(entry['gallery']) for entry in mapping.values())} previews in {OUTPUT}")


if __name__ == "__main__":
    main()
