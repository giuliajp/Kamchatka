"""Three targeted behavioral probes in disposable copies; no aggregate mutation score.
Run: python3 scripts/check-review-mutations.py
"""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PROBES = [
    ("stale-401", "src/api.ts", " && readToken() === token", "", "tests/Api.test.tsx",
     "does not expire a new session"),
    ("lost-seconds", "src/ui.tsx", ".slice(0,19)", ".slice(0,16)", "tests/PassIntegrity.test.tsx",
     "keeps seconds"),
    ("invented-arrival", "src/pages/Monitoring.tsx",
     "arrived_at:kamchatkaValue(data,'arrived_at',base?.arrived_at ?? null)",
     "arrived_at:'2000-01-01T00:00:00Z'", "tests/PassIntegrity.test.tsx", "preserves a draft"),
]


def main():
    results = []
    with tempfile.TemporaryDirectory(prefix="avacha-review-mutations-") as folder:
        copy = Path(folder)
        for app in ("frontend", "admin-panel"):
            shutil.copytree(ROOT / app, copy / app, ignore=shutil.ignore_patterns(
                "node_modules", "dist", "coverage", "storybook-static", "playwright-report", "test-results"))
            (copy / app / "node_modules").symlink_to(ROOT / app / "node_modules", target_is_directory=True)
        for name, file, original, mutated, test, title in PROBES:
            target = copy / "admin-panel" / file
            source = target.read_text()
            if source.count(original) != 1:
                raise RuntimeError(f"{name}: expected exactly one mutation target")
            target.write_text(source.replace(original, mutated))
            try:
                run = subprocess.run(["npx", "--no-install", "vitest", "run", test, "-t", title,
                                      "--reporter=dot"], cwd=copy / "admin-panel",
                                     text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=90)
                behavioral = run.returncode != 0 and "AssertionError" in run.stdout
                results.append({"probe": name, "behavioral_failure": behavioral, "exit_code": run.returncode})
                if not behavioral:
                    print(run.stdout)
            finally:
                target.write_text(source)
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0 if all(result["behavioral_failure"] for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
