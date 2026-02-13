#!/usr/bin/env python3
"""
Альтернатива `npm run dev:all`: запуск основного сайта, apisite и бота из корня репо
через subprocess. Остановка — Ctrl+C (все дочерние процессы завершаются).
"""
import os
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TENDERBOT = ROOT / "tenderbot"


def main() -> None:
    procs: list[subprocess.Popen] = []

    def kill_children(*_args: object) -> None:
        for p in procs:
            try:
                p.terminate()
                p.wait(timeout=5)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                try:
                    p.kill()
                except ProcessLookupError:
                    pass
        sys.exit(0)

    signal.signal(signal.SIGINT, kill_children)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, kill_children)

    use_shell = os.name == "nt"

    # 1) Основной сайт
    procs.append(
        subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=ROOT,
            stdout=sys.stdout,
            stderr=sys.stderr,
            shell=use_shell,
        )
    )

    # 2) apisite (cwd=apisite для uvicorn reload "main:app")
    procs.append(
        subprocess.Popen(
            [sys.executable, "main.py"],
            cwd=TENDERBOT / "apisite",
            stdout=sys.stdout,
            stderr=sys.stderr,
            shell=use_shell,
        )
    )

    # 3) бот + веб (cwd=tenderbot)
    procs.append(
        subprocess.Popen(
            [sys.executable, "run.py"],
            cwd=TENDERBOT,
            stdout=sys.stdout,
            stderr=sys.stderr,
            shell=use_shell,
        )
    )

    for p in procs:
        p.wait()


if __name__ == "__main__":
    main()
