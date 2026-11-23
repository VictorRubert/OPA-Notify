"""Build a Chrome Web Store ZIP from a tested Termofy release ZIP.

The source release keeps the untouched Termostato distribution for auditing.
The upload ZIP includes only runtime files and has one manifest at its root.
"""

import argparse
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


EXTRA_RUNTIME_FILES = {
    "LICENSE",
    "offscreen.html",
    "offscreen.js",
    "content/tag-settings.js",  # background importScripts and popup
    "icons/termofy-mark.svg",     # popup header
    "popup/popup.css",
    "popup/popup.js",
    "sounds/pop.mp3",
}


def build(source_path: Path, output_path: Path) -> None:
    with ZipFile(source_path) as source:
        names = source.namelist()
        roots = {name.split("/", 1)[0] for name in names}
        if len(roots) != 1:
            raise ValueError("O ZIP de origem precisa ter uma única pasta raiz.")
        root = roots.pop() + "/"
        manifest = json.loads(source.read(root + "manifest.json"))
        files = {"manifest.json", manifest["background"]["service_worker"],
                 manifest["action"]["default_popup"], *manifest["icons"].values(),
                 *EXTRA_RUNTIME_FILES}
        for entry in manifest["content_scripts"]:
            files.update(entry.get("js", []))
            files.update(entry.get("css", []))
        missing = sorted(file for file in files if root + file not in names)
        if missing:
            raise ValueError(f"Arquivos necessários ausentes: {missing}")
        if any(file != "manifest.json" and file.endswith("/manifest.json") for file in files):
            raise ValueError("O pacote de execução referencia um manifesto interno.")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with ZipFile(output_path, "w", compression=ZIP_DEFLATED, compresslevel=9) as output:
            for file in sorted(files):
                output.writestr(file, source.read(root + file))

    with ZipFile(output_path) as check:
        if check.testzip() is not None:
            raise ValueError("O ZIP gerado está corrompido.")
        manifests = [name for name in check.namelist() if name.endswith("manifest.json")]
        if manifests != ["manifest.json"]:
            raise ValueError(f"Manifestos encontrados: {manifests}")
        if json.loads(check.read("manifest.json"))["version"] != manifest["version"]:
            raise ValueError("A versão do manifesto mudou durante o empacotamento.")
    print(f"{output_path} — {len(files)} arquivos, versão {manifest['version']}, um manifesto na raiz")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="ZIP de uma versão já testada")
    parser.add_argument("output", type=Path, help="ZIP para upload na Chrome Web Store")
    args = parser.parse_args()
    build(args.source, args.output)
