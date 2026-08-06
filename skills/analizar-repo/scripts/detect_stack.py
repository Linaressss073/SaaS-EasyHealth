#!/usr/bin/env python3
"""Deterministic stack detection for the /analizar-repo skill.

Reads real manifests (package.json, requirements.txt, go.mod, etc.) instead
of guessing from folder names, and prints a single JSON object to stdout
describing what it found. Meant to be a fast starting point for further
manual exploration, not the final source of truth.

Usage:
    python detect_stack.py /path/to/repo
"""

from __future__ import annotations

import json
import os
import sys

IGNORED_DIRS = {
    ".git", "node_modules", "dist", "build", ".next", "out",
    "venv", ".venv", "__pycache__", ".turbo", ".cache", "coverage",
    "vendor", "target", ".idea", ".vscode", ".storybook-static",
}

MANIFEST_FILES = [
    "package.json", "requirements.txt", "pyproject.toml", "Pipfile",
    "go.mod", "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts",
    "Gemfile", "composer.json", "mix.exs", "tsconfig.json",
]

DOC_FILES = [
    "README.md", "README.rst", "README.txt", "CONTRIBUTING.md",
    "ARCHITECTURE.md", "ARCHITECTURE.rst",
]

CI_PATHS = [
    ".github/workflows", ".gitlab-ci.yml", ".circleci/config.yml",
    "azure-pipelines.yml", "Jenkinsfile", ".drone.yml",
]

INFRA_FILES = [
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "Makefile", "Procfile", "terraform", "helm", "k8s", "kubernetes",
]

JS_TEST_DEPS = {
    "vitest": "Vitest", "jest": "Jest", "mocha": "Mocha",
    "@playwright/test": "Playwright", "cypress": "Cypress",
    "jasmine": "Jasmine", "ava": "AVA",
}

JS_FRAMEWORK_DEPS = {
    "next": "Next.js", "react": "React", "vue": "Vue", "nuxt": "Nuxt",
    "@angular/core": "Angular", "svelte": "Svelte", "express": "Express",
    "@nestjs/core": "NestJS", "fastify": "Fastify", "koa": "Koa",
    "remix": "Remix", "@remix-run/react": "Remix",
    "drizzle-orm": "Drizzle ORM", "prisma": "Prisma", "@prisma/client": "Prisma",
    "typeorm": "TypeORM", "tailwindcss": "Tailwind CSS",
}


def walk_shallow(root: str, max_depth: int = 2) -> list[str]:
    tree = []
    root_depth = root.rstrip(os.sep).count(os.sep)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS and not d.startswith(".git")]
        depth = dirpath.rstrip(os.sep).count(os.sep) - root_depth
        if depth > max_depth:
            dirnames[:] = []
            continue
        rel = os.path.relpath(dirpath, root)
        if rel == ".":
            rel = "/"
        tree.append(rel)
    return sorted(tree)


def find_existing(root: str, candidates: list[str]) -> list[str]:
    found = []
    for c in candidates:
        p = os.path.join(root, c)
        if os.path.exists(p):
            found.append(c)
    return found


def read_json(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def detect_js(root: str, result: dict) -> None:
    pkg_path = os.path.join(root, "package.json")
    if not os.path.exists(pkg_path):
        return
    pkg = read_json(pkg_path)
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}

    result["languages"].append("TypeScript" if os.path.exists(os.path.join(root, "tsconfig.json")) else "JavaScript")
    result["package_managers"].append("npm" if os.path.exists(os.path.join(root, "package-lock.json"))
                                       else "yarn" if os.path.exists(os.path.join(root, "yarn.lock"))
                                       else "pnpm" if os.path.exists(os.path.join(root, "pnpm-lock.yaml"))
                                       else "unknown (package.json present, no lockfile found)")

    for dep, label in JS_FRAMEWORK_DEPS.items():
        if dep in deps:
            result["frameworks"].append(label)
    for dep, label in JS_TEST_DEPS.items():
        if dep in deps:
            result["testing"].append(label)

    result["package_json_scripts"] = pkg.get("scripts", {})
    if "workspaces" in pkg:
        result["monorepo_workspaces"] = pkg["workspaces"]


def detect_python(root: str, result: dict) -> None:
    has_reqs = os.path.exists(os.path.join(root, "requirements.txt"))
    has_pyproject = os.path.exists(os.path.join(root, "pyproject.toml"))
    has_pipfile = os.path.exists(os.path.join(root, "Pipfile"))
    if not (has_reqs or has_pyproject or has_pipfile):
        return
    result["languages"].append("Python")
    if has_pipfile:
        result["package_managers"].append("pipenv")
    elif has_pyproject:
        result["package_managers"].append("poetry/pip (pyproject.toml)")
    else:
        result["package_managers"].append("pip")

    text = ""
    for fname in ("requirements.txt", "pyproject.toml"):
        p = os.path.join(root, fname)
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as f:
                    text += f.read().lower()
            except OSError:
                pass

    fw_map = {
        "django": "Django", "flask": "Flask", "fastapi": "FastAPI",
        "pytest": "pytest (testing)", "celery": "Celery",
    }
    for needle, label in fw_map.items():
        if needle in text:
            if "testing" in label:
                result["testing"].append(label.split(" (")[0])
            else:
                result["frameworks"].append(label)


def detect_go(root: str, result: dict) -> None:
    if not os.path.exists(os.path.join(root, "go.mod")):
        return
    result["languages"].append("Go")
    result["package_managers"].append("go modules")


def detect_rust(root: str, result: dict) -> None:
    if not os.path.exists(os.path.join(root, "Cargo.toml")):
        return
    result["languages"].append("Rust")
    result["package_managers"].append("cargo")


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python detect_stack.py /path/to/repo", file=sys.stderr)
        sys.exit(1)

    root = os.path.abspath(sys.argv[1])
    if not os.path.isdir(root):
        print(json.dumps({"error": f"not a directory: {root}"}))
        sys.exit(1)

    result: dict = {
        "root": root,
        "languages": [],
        "frameworks": [],
        "testing": [],
        "package_managers": [],
        "package_json_scripts": {},
        "manifests_found": find_existing(root, MANIFEST_FILES),
        "docs_found": find_existing(root, DOC_FILES),
        "ci_cd": find_existing(root, CI_PATHS),
        "infra": find_existing(root, INFRA_FILES),
    }

    detect_js(root, result)
    detect_python(root, result)
    detect_go(root, result)
    detect_rust(root, result)

    docs_dir = os.path.join(root, "docs")
    if os.path.isdir(docs_dir):
        result["docs_found"] += [
            os.path.join("docs", f) for f in os.listdir(docs_dir)
            if os.path.isfile(os.path.join(docs_dir, f))
        ]

    result["languages"] = sorted(set(result["languages"]))
    result["frameworks"] = sorted(set(result["frameworks"]))
    result["testing"] = sorted(set(result["testing"]))
    result["package_managers"] = sorted(set(result["package_managers"]))
    result["directory_tree"] = walk_shallow(root, max_depth=2)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
