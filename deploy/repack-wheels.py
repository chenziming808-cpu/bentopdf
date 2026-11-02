#!/usr/bin/env python3
"""Rewrite Pyodide wheels / stdlib zip with ZIP_STORED entries (same contents).

Why: the .whl files are already deflate-compressed per entry, so HTTP
compression can't shrink them. Stored (uncompressed) archives let the
precompressed .br (brotli -q 11, 16 MB window) beat per-file deflate by
~20-35% on the wire. Pyodide installs URL wheels without a sha256 check,
and the extracted files are byte-identical, so runtime behaviour is unchanged.

Usage: repack-wheels.py <dir> [<dir> ...]   (idempotent; python>=3.6)
"""
import os
import sys
import zipfile


def needs_repack(path):
    with zipfile.ZipFile(path) as zf:
        return any(i.compress_type != zipfile.ZIP_STORED for i in zf.infolist())


def repack(path):
    tmp = path + '.repack.tmp'
    with zipfile.ZipFile(path) as src, zipfile.ZipFile(tmp, 'w') as dst:
        for info in src.infolist():
            data = src.read(info.filename)
            out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            out.external_attr = info.external_attr
            out.create_system = info.create_system
            out.compress_type = zipfile.ZIP_STORED
            dst.writestr(out, data)
    with zipfile.ZipFile(tmp) as check:
        bad = check.testzip()
        if bad:
            raise RuntimeError('CRC check failed for %s in %s' % (bad, tmp))
    st = os.stat(path)
    os.chmod(tmp, st.st_mode & 0o777)
    os.replace(tmp, path)


def main(dirs):
    n = 0
    for d in dirs:
        for root, _, files in os.walk(d):
            for name in files:
                if not (name.endswith('.whl') or name == 'python_stdlib.zip'):
                    continue
                p = os.path.join(root, name)
                if needs_repack(p):
                    before = os.path.getsize(p)
                    repack(p)
                    print('repacked %s: %d -> %d bytes' % (p, before, os.path.getsize(p)))
                    n += 1
    print('repack-wheels: %d archive(s) rewritten' % n)


if __name__ == '__main__':
    main(sys.argv[1:] or ['.'])
