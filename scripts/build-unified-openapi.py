#!/usr/bin/env python3
"""Build one public OpenAPI document from the six MedicalField services."""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


SERVICES = (
    {
        "key": "auth",
        "tag": "Autenticação e profissionais",
        "description": "Login, sessão e cadastro de profissionais.",
        "url": "http://127.0.0.1:8001/openapi.json",
        "prefix": "/api",
    },
    {
        "key": "patients",
        "tag": "Pacientes",
        "description": "Cadastro e consulta de pacientes.",
        "url": "http://127.0.0.1:8081/v3/api-docs",
        "prefix": "/api",
    },
    {
        "key": "records",
        "tag": "Prontuários e atendimentos",
        "description": "Prontuários, atendimentos e correções auditáveis.",
        "url": "http://127.0.0.1:3001/openapi.json",
        "prefix": "/api",
    },
    {
        "key": "medications",
        "tag": "Medicamentos",
        "description": "Catálogo de medicamentos e alterações.",
        "url": "http://127.0.0.1:8002/openapi.json",
        "prefix": "/api",
    },
    {
        "key": "sync",
        "tag": "Sincronização e auditoria",
        "description": "Sincronização offline e trilha de auditoria.",
        "url": "http://127.0.0.1:8082/v3/api-docs",
        "prefix": "/api",
    },
    {
        "key": "documents",
        "tag": "Documentos",
        "description": "Geração e envio de documentos clínicos.",
        "url": "http://127.0.0.1:3002/openapi.json",
        "prefix": "/api/documents",
    },
)

HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}
COMPONENT_REF = re.compile(r"^#/components/([^/]+)/([^/]+)$")
INTERNAL_PATHS = {"/internal/health", "/health"}


def fetch_json(url: str) -> dict[str, Any]:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "MedicalField-OpenAPI-Builder/1.0"})
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Não foi possível obter um contrato em {url}: {exc}") from exc


def public_path(prefix: str, path: str) -> str:
    return f"/{prefix.strip('/')}/{path.lstrip('/')}".replace("//", "/")


def component_maps(service_key: str, spec: dict[str, Any]) -> dict[str, dict[str, str]]:
    mappings: dict[str, dict[str, str]] = {}
    for category, definitions in (spec.get("components") or {}).items():
        if not isinstance(definitions, dict):
            continue
        category_map: dict[str, str] = {}
        for name, definition in definitions.items():
            if category == "securitySchemes" and isinstance(definition, dict):
                is_bearer = definition.get("type") == "http" and definition.get("scheme", "").lower() == "bearer"
                category_map[name] = "bearerAuth" if is_bearer else f"{service_key}_{name}"
            else:
                category_map[name] = f"{service_key}_{name}"
        mappings[category] = category_map
    return mappings


def rewrite_security(value: Any, mappings: dict[str, dict[str, str]]) -> Any:
    if not isinstance(value, list):
        return value
    scheme_map = mappings.get("securitySchemes", {})
    return [
        {scheme_map.get(name, name): scopes for name, scopes in requirement.items()}
        if isinstance(requirement, dict)
        else requirement
        for requirement in value
    ]


def rewrite(value: Any, mappings: dict[str, dict[str, str]]) -> Any:
    if isinstance(value, list):
        return [rewrite(item, mappings) for item in value]
    if not isinstance(value, dict):
        return value

    rewritten: dict[str, Any] = {}
    for key, item in value.items():
        if key == "$ref" and isinstance(item, str):
            match = COMPONENT_REF.match(item)
            if match:
                category, name = match.groups()
                item = f"#/components/{category}/{mappings.get(category, {}).get(name, name)}"
            rewritten[key] = item
        elif key == "security":
            rewritten[key] = rewrite_security(item, mappings)
        else:
            rewritten[key] = rewrite(item, mappings)
    return rewritten


def operation_id(service_key: str, method: str, path: str, current: Any) -> str:
    suffix = str(current) if current else f"{method}_{path}"
    normalized = re.sub(r"[^A-Za-z0-9_]+", "_", suffix).strip("_")
    return f"{service_key}_{normalized}"


def build_document() -> dict[str, Any]:
    output: dict[str, Any] = {
        "openapi": "3.1.0",
        "info": {
            "title": "MedicalField — API completa",
            "version": "1.0.0",
            "description": (
                "Contrato unificado dos seis microsserviços do MedicalField. "
                "Faça login, copie o access token e use Authorize para testar as rotas protegidas."
            ),
        },
        "servers": [{"url": "/", "description": "Servidor atual"}],
        "tags": [
            {"name": service["tag"], "description": service["description"]}
            for service in SERVICES
        ],
        "paths": {},
        "components": {},
    }

    for service in SERVICES:
        spec = fetch_json(service["url"])
        mappings = component_maps(service["key"], spec)

        for category, definitions in (spec.get("components") or {}).items():
            if not isinstance(definitions, dict):
                continue
            target_category = output["components"].setdefault(category, {})
            for name, definition in definitions.items():
                target_name = mappings[category][name]
                rewritten_definition = rewrite(copy.deepcopy(definition), mappings)
                if target_name in target_category:
                    # Todos os serviços usam o mesmo JWT. Diferenças de descrição ou
                    # bearerFormat não devem criar vários botões Authorize no Swagger.
                    if category == "securitySchemes" and target_name == "bearerAuth":
                        continue
                    if target_category[target_name] != rewritten_definition:
                        raise RuntimeError(f"Componente incompatível: {category}/{target_name}")
                target_category[target_name] = rewritten_definition

        inherited_security = rewrite_security(spec.get("security"), mappings)
        for path, path_item in (spec.get("paths") or {}).items():
            if path in INTERNAL_PATHS:
                continue
            target_path = public_path(service["prefix"], path)
            if target_path in output["paths"]:
                raise RuntimeError(f"Rota duplicada no contrato unificado: {target_path}")

            rewritten_path_item = rewrite(copy.deepcopy(path_item), mappings)
            for method, operation in rewritten_path_item.items():
                if method.lower() not in HTTP_METHODS or not isinstance(operation, dict):
                    continue
                operation["tags"] = [service["tag"]]
                operation["operationId"] = operation_id(
                    service["key"], method, target_path, operation.get("operationId")
                )
                if "security" not in operation and inherited_security is not None:
                    operation["security"] = copy.deepcopy(inherited_security)

            output["paths"][target_path] = rewritten_path_item

    if not output["components"]:
        output.pop("components")
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("deployment/api-docs/openapi.json"),
        help="Arquivo JSON de saída",
    )
    args = parser.parse_args()

    try:
        document = build_document()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, RuntimeError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 1

    print(f"OpenAPI unificada: {len(document['paths'])} caminhos em {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
