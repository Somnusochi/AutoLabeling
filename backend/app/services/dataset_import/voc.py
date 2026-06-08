"""Pascal VOC XML format parser."""

import logging
import xml.etree.ElementTree as ET
from pathlib import Path

from .helpers import find_image_by_name, read_image_size, save_image

logger = logging.getLogger(__name__)


def parse_voc_zip(extract_dir: str) -> list[dict]:
    """Parse Pascal VOC XML annotations."""
    extract = Path(extract_dir)
    items: list[dict] = []

    for xml_path in sorted(extract.rglob("*.xml")):
        if "images" in xml_path.parts or "__MACOSX" in str(xml_path):
            continue

        try:
            tree = ET.parse(xml_path)
            root_elem = tree.getroot()
        except ET.ParseError:
            logger.warning("Invalid XML: %s, skipping", xml_path.name)
            continue

        filename_el = root_elem.find("filename")
        if filename_el is None or not filename_el.text:
            logger.warning("No filename in %s, skipping", xml_path.name)
            continue
        img_name = filename_el.text.strip()

        img_file = find_image_by_name(extract, img_name)
        if not img_file:
            logger.warning("Image not found: %s, skipping", img_name)
            continue

        size_el = root_elem.find("size")
        if size_el is not None:
            w_el = size_el.find("width")
            h_el = size_el.find("height")
            w = int(w_el.text) if w_el is not None and w_el.text else 0
            h = int(h_el.text) if h_el is not None and h_el.text else 0
        else:
            w, h = 0, 0
        if w == 0 or h == 0:
            w, h = read_image_size(str(img_file))

        boxes: list[dict] = []
        for obj in root_elem.findall("object"):
            name_el = obj.find("name")
            class_name = name_el.text.strip() if name_el is not None and name_el.text else "object"
            bndbox = obj.find("bndbox")
            if bndbox is None:
                continue
            try:
                x1 = int(float(bndbox.findtext("xmin", "0")))
                y1 = int(float(bndbox.findtext("ymin", "0")))
                x2 = int(float(bndbox.findtext("xmax", "0")))
                y2 = int(float(bndbox.findtext("ymax", "0")))
            except (ValueError, TypeError):
                continue
            boxes.append(
                {
                    "class_name": class_name,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "confidence": None,
                    "mask_polygon": None,
                }
            )

        saved_path = save_image(str(img_file), img_name)
        items.append(
            {
                "image_path": saved_path,
                "image_name": img_name,
                "image_width": w,
                "image_height": h,
                "boxes": boxes,
            }
        )

    if not items:
        raise ValueError("No valid image-annotation pairs found in VOC dataset")
    return items
