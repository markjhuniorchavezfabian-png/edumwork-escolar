"""Backup automático de la BD PostgreSQL.
Uso: python manage.py backup_db
Genera un .sql.gz en BACKUPS_DIR con timestamp. Retiene últimos 30."""
import gzip
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Genera un backup pg_dump comprimido y elimina los antiguos (retención 30 días)."

    def add_arguments(self, parser):
        parser.add_argument("--retencion", type=int, default=30,
                            help="Cantidad de backups a conservar (default 30).")
        parser.add_argument("--destino", default=None,
                            help="Carpeta destino (default: BASE_DIR/backups/).")

    def handle(self, *args, **options):
        destino = Path(options["destino"] or (settings.BASE_DIR / "backups"))
        destino.mkdir(parents=True, exist_ok=True)

        db = settings.DATABASES["default"]
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        archivo = destino / f"backup_{db['NAME']}_{ts}.sql.gz"

        env = os.environ.copy()
        env["PGPASSWORD"] = db["PASSWORD"]

        cmd = [
            "pg_dump",
            "-h", db["HOST"] or "localhost",
            "-p", str(db["PORT"] or "5432"),
            "-U", db["USER"],
            "-d", db["NAME"],
            "--no-owner", "--no-acl", "--clean",
        ]

        self.stdout.write(f"Ejecutando pg_dump → {archivo}")
        try:
            with gzip.open(archivo, "wb") as gz:
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, env=env)
                shutil.copyfileobj(proc.stdout, gz)
                proc.wait()
                if proc.returncode != 0:
                    self.stdout.write(self.style.ERROR(f"pg_dump falló con código {proc.returncode}"))
                    archivo.unlink(missing_ok=True)
                    return
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(
                "pg_dump no encontrado. Instalá postgresql-client."
            ))
            return

        size_mb = archivo.stat().st_size / 1024 / 1024
        self.stdout.write(self.style.SUCCESS(f"✓ Backup OK ({size_mb:.2f} MB)"))

        # Retención
        backups = sorted(destino.glob("backup_*.sql.gz"), reverse=True)
        for viejo in backups[options["retencion"]:]:
            viejo.unlink()
            self.stdout.write(f"  eliminado: {viejo.name}")
