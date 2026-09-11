#!/usr/bin/env python3
"""Extract / edit / repack PGSharp PGSData.dat (Java serialized HashMap).

The .dat file is NOT a text export. It is Java Object Serialization
(magic AC ED 00 05) of a HashMap<String, Object>. Editing it in Notepad
will corrupt it. This tool round-trips through JSON.

Usage:
  python tools/pgsdata_tool.py extract PGSData.dat
  python tools/pgsdata_tool.py pack PGSData.json -o PGSData.edited.dat
  python tools/pgsdata_tool.py add-xxl PGSData.dat -o PGSData.xxl.dat

Do not share PGSData.dat or the JSON: they can contain license keys,
coordinates, and other account settings.
"""

from __future__ import annotations

import argparse
import copy
import json
import struct
import sys
from pathlib import Path
from typing import Any

STREAM_MAGIC = 0xACED
STREAM_VERSION = 5
TC_NULL = 0x70
TC_REFERENCE = 0x71
TC_CLASSDESC = 0x72
TC_OBJECT = 0x73
TC_STRING = 0x74
TC_BLOCKDATA = 0x77
TC_ENDBLOCKDATA = 0x78
TC_LONGSTRING = 0x7C
BASE_WIRE_HANDLE = 0x7E0000
SC_WRITE_METHOD = 0x01
SC_SERIALIZABLE = 0x02

# serialVersionUIDs captured from a real PGSData.dat (OpenJDK boxed types).
HASHMAP_SUID = 0x0507DAC1C31660D1
INTEGER_SUID = 0x12E2A0A4F7818738
BOOLEAN_SUID = 0xCD207280D59CFAEE
NUMBER_SUID = 0x86AC951D0B94E08B
FLOAT_SUID = 0xDAEDC9A2DB3CF0EC
LONG_SUID = 0x3B8BE490CC8F23DF

# Pokemon GO PokemonDisplay.Size; PGSharp feeds use the same field.
SIZE_ANY = 0
SIZE_XXS = 1
SIZE_XS = 2
SIZE_M = 3
SIZE_XL = 4
SIZE_XXL = 5

TYPE_INT = "int"
TYPE_LONG = "long"
TYPE_FLOAT = "float"
TYPE_BOOL = "bool"
TYPE_STRING = "string"


class StreamError(ValueError):
    pass


class JavaReader:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.pos = 0
        self.handles: list[Any] = []

    def remaining(self) -> int:
        return len(self.data) - self.pos

    def u1(self) -> int:
        if self.pos >= len(self.data):
            raise StreamError("unexpected EOF")
        v = self.data[self.pos]
        self.pos += 1
        return v

    def u2(self) -> int:
        v = struct.unpack_from(">H", self.data, self.pos)[0]
        self.pos += 2
        return v

    def u4(self) -> int:
        v = struct.unpack_from(">I", self.data, self.pos)[0]
        self.pos += 4
        return v

    def i4(self) -> int:
        v = struct.unpack_from(">i", self.data, self.pos)[0]
        self.pos += 4
        return v

    def i8(self) -> int:
        v = struct.unpack_from(">q", self.data, self.pos)[0]
        self.pos += 8
        return v

    def f4(self) -> float:
        v = struct.unpack_from(">f", self.data, self.pos)[0]
        self.pos += 4
        return v

    def bytes(self, n: int) -> bytes:
        chunk = self.data[self.pos : self.pos + n]
        if len(chunk) != n:
            raise StreamError("unexpected EOF")
        self.pos += n
        return chunk

    def new_handle(self, obj: Any) -> Any:
        self.handles.append(obj)
        return obj

    def utf(self, length: int) -> str:
        raw = self.bytes(length)
        return decode_modified_utf8(raw)

    def read_stream(self) -> Any:
        magic = self.u2()
        version = self.u2()
        if magic != STREAM_MAGIC or version != STREAM_VERSION:
            raise StreamError(f"not a Java serialized stream (magic={magic:#x} ver={version})")
        return self.read_content()

    def read_content(self) -> Any:
        tc = self.u1()
        return self.read_content_tc(tc)

    def read_content_tc(self, tc: int) -> Any:
        if tc == TC_NULL:
            return None
        if tc == TC_REFERENCE:
            handle = self.u4()
            idx = handle - BASE_WIRE_HANDLE
            if idx < 0 or idx >= len(self.handles):
                raise StreamError(f"bad handle {handle:#x}")
            return self.handles[idx]
        if tc == TC_STRING:
            return self.new_handle(self.utf(self.u2()))
        if tc == TC_LONGSTRING:
            n = self.i8()
            if n < 0 or n > 10_000_000:
                raise StreamError("implausible long string")
            return self.new_handle(self.utf(n))
        if tc == TC_CLASSDESC:
            return self.read_class_desc_body()
        if tc == TC_OBJECT:
            return self.read_new_object()
        raise StreamError(f"unsupported type code {tc:#x} at {self.pos - 1}")

    def read_class_desc(self) -> dict[str, Any] | None:
        tc = self.u1()
        if tc == TC_NULL:
            return None
        if tc == TC_REFERENCE:
            return self.read_content_tc(tc)
        if tc == TC_CLASSDESC:
            return self.read_class_desc_body()
        raise StreamError(f"expected classDesc, got {tc:#x}")

    def read_class_desc_body(self) -> dict[str, Any]:
        name = self.utf(self.u2())
        suid = self.i8() & 0xFFFFFFFFFFFFFFFF
        # Handle is assigned before fields/superclass (Java serialization spec).
        desc: dict[str, Any] = {
            "name": name,
            "suid": suid,
            "flags": 0,
            "fields": [],
            "super": None,
        }
        self.new_handle(desc)
        desc["flags"] = self.u1()
        nfields = self.u2()
        fields = []
        for _ in range(nfields):
            code = chr(self.u1())
            fname = self.utf(self.u2())
            if code in "L[":
                ftype = self.read_content()
            else:
                ftype = code
            fields.append({"code": code, "name": fname, "type": ftype})
        desc["fields"] = fields
        while True:
            tc = self.u1()
            if tc == TC_ENDBLOCKDATA:
                break
            self.read_content_tc(tc)
        desc["super"] = self.read_class_desc()
        return desc

    def read_new_object(self) -> Any:
        desc = self.read_class_desc()
        if desc is None:
            raise StreamError("object without classDesc")
        obj: dict[str, Any] = {"__class__": desc["name"]}
        handle_idx = len(self.handles)
        self.new_handle(obj)
        self.read_class_data(desc, obj)
        unwrapped = unwrap_boxed(obj)
        self.handles[handle_idx] = unwrapped
        return unwrapped

    def read_class_data(self, desc: dict[str, Any], obj: dict[str, Any]) -> None:
        chain = class_chain(desc)
        for c in chain:
            for field in c["fields"]:
                obj[field["name"]] = self.read_field(field["code"])
            if c["flags"] & SC_WRITE_METHOD:
                self.read_optional_data(c, obj)

    def read_field(self, code: str) -> Any:
        if code == "I":
            return self.i4()
        if code == "F":
            return self.f4()
        if code == "J":
            return self.i8()
        if code == "Z":
            return bool(self.u1())
        if code in "L[":
            return self.read_content()
        raise StreamError(f"unsupported field code {code}")

    def read_optional_data(self, desc: dict[str, Any], obj: dict[str, Any]) -> None:
        if desc["name"] == "java.util.HashMap":
            self.read_hashmap_data(obj)
            return
        while True:
            tc = self.u1()
            if tc == TC_ENDBLOCKDATA:
                return
            if tc == TC_BLOCKDATA:
                n = self.u1()
                self.bytes(n)
                continue
            self.read_content_tc(tc)

    def read_hashmap_data(self, obj: dict[str, Any]) -> None:
        tc = self.u1()
        if tc != TC_BLOCKDATA:
            raise StreamError(f"HashMap expected blockdata, got {tc:#x}")
        n = self.u1()
        if n != 8:
            raise StreamError(f"HashMap blockdata length {n}, expected 8")
        buckets = self.i4()
        size = self.i4()
        entries: dict[str, Any] = {}
        order: list[str] = []
        for _ in range(size):
            key = self.read_content()
            value = self.read_content()
            if not isinstance(key, str):
                raise StreamError(f"non-string HashMap key: {key!r}")
            entries[key] = value
            order.append(key)
        end = self.u1()
        if end != TC_ENDBLOCKDATA:
            raise StreamError(f"HashMap missing TC_ENDBLOCKDATA, got {end:#x}")
        obj["__buckets__"] = buckets
        obj["__size__"] = size
        obj["__order__"] = order
        obj["__entries__"] = entries


def class_chain(desc: dict[str, Any]) -> list[dict[str, Any]]:
    chain = []
    cur: dict[str, Any] | None = desc
    while cur is not None:
        chain.append(cur)
        cur = cur.get("super")
    chain.reverse()
    return chain


def unwrap_boxed(obj: dict[str, Any]) -> Any:
    name = obj.get("__class__")
    if name == "java.lang.Integer":
        return ("int", obj["value"])
    if name == "java.lang.Long":
        return ("long", obj["value"])
    if name == "java.lang.Float":
        return ("float", obj["value"])
    if name == "java.lang.Boolean":
        return ("bool", bool(obj["value"]))
    if name == "java.util.HashMap":
        return obj
    return obj


def decode_modified_utf8(raw: bytes) -> str:
    out: list[str] = []
    i = 0
    while i < len(raw):
        b1 = raw[i]
        if b1 == 0:
            raise StreamError("embedded NUL in modified UTF-8")
        if b1 < 0x80:
            out.append(chr(b1))
            i += 1
            continue
        if b1 & 0xE0 == 0xC0:
            b2 = raw[i + 1]
            code = ((b1 & 0x1F) << 6) | (b2 & 0x3F)
            out.append(chr(code))
            i += 2
            continue
        if b1 & 0xF0 == 0xE0:
            b2 = raw[i + 1]
            b3 = raw[i + 2]
            code = ((b1 & 0x0F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F)
            out.append(chr(code))
            i += 3
            continue
        raise StreamError(f"bad modified UTF-8 byte {b1:#x}")
    return "".join(out)


def encode_modified_utf8(text: str) -> bytes:
    out = bytearray()
    for ch in text:
        code = ord(ch)
        if code == 0:
            out.extend((0xC0, 0x80))
        elif code <= 0x7F:
            out.append(code)
        elif code <= 0x7FF:
            out.append(0xC0 | (code >> 6))
            out.append(0x80 | (code & 0x3F))
        elif code <= 0xFFFF:
            out.append(0xE0 | (code >> 12))
            out.append(0x80 | ((code >> 6) & 0x3F))
            out.append(0x80 | (code & 0x3F))
        else:
            u = code - 0x10000
            hi = 0xD800 | (u >> 10)
            lo = 0xDC00 | (u & 0x3FF)
            for unit in (hi, lo):
                out.append(0xE0 | (unit >> 12))
                out.append(0x80 | ((unit >> 6) & 0x3F))
                out.append(0x80 | (unit & 0x3F))
    return bytes(out)


class JavaWriter:
    def __init__(self) -> None:
        self.buf = bytearray()
        self.handle_count = 0
        self.class_handles: dict[str, int] = {}
        self.string_handles: dict[str, int] = {}

    def write(self, data: bytes) -> None:
        self.buf.extend(data)

    def u1(self, v: int) -> None:
        self.buf.append(v & 0xFF)

    def u2(self, v: int) -> None:
        self.write(struct.pack(">H", v))

    def u4(self, v: int) -> None:
        self.write(struct.pack(">I", v))

    def i4(self, v: int) -> None:
        self.write(struct.pack(">i", v))

    def i8(self, v: int) -> None:
        self.write(struct.pack(">q", v))

    def f4(self, v: float) -> None:
        self.write(struct.pack(">f", v))

    def next_handle(self) -> int:
        h = self.handle_count
        self.handle_count += 1
        return h

    def write_utf_body(self, text: str) -> None:
        raw = encode_modified_utf8(text)
        if len(raw) > 65535:
            raise StreamError(f"string too long for TC_STRING ({len(raw)} bytes)")
        self.u2(len(raw))
        self.write(raw)

    def write_string(self, text: str) -> None:
        if text in self.string_handles:
            self.u1(TC_REFERENCE)
            self.u4(BASE_WIRE_HANDLE + self.string_handles[text])
            return
        self.u1(TC_STRING)
        self.string_handles[text] = self.next_handle()
        self.write_utf_body(text)

    def write_class_desc(
        self,
        name: str,
        suid: int,
        flags: int,
        fields: list[tuple[str, str]],
        super_name: str | None,
    ) -> None:
        if name in self.class_handles:
            self.u1(TC_REFERENCE)
            self.u4(BASE_WIRE_HANDLE + self.class_handles[name])
            return
        self.u1(TC_CLASSDESC)
        self.class_handles[name] = self.next_handle()
        raw_name = encode_modified_utf8(name)
        self.u2(len(raw_name))
        self.write(raw_name)
        self.i8(suid if suid < 0x8000000000000000 else suid - (1 << 64))
        self.u1(flags)
        self.u2(len(fields))
        for code, fname in fields:
            self.u1(ord(code))
            raw_f = encode_modified_utf8(fname)
            self.u2(len(raw_f))
            self.write(raw_f)
        self.u1(TC_ENDBLOCKDATA)
        if super_name == "java.lang.Number":
            self.write_class_desc("java.lang.Number", NUMBER_SUID, SC_SERIALIZABLE, [], None)
        elif super_name is None:
            self.u1(TC_NULL)
        else:
            raise StreamError(f"unsupported superclass {super_name}")

    def write_boxed_int(self, value: int) -> None:
        self.u1(TC_OBJECT)
        self.write_class_desc(
            "java.lang.Integer",
            INTEGER_SUID,
            SC_SERIALIZABLE,
            [("I", "value")],
            "java.lang.Number",
        )
        self.next_handle()
        self.i4(value)

    def write_boxed_long(self, value: int) -> None:
        self.u1(TC_OBJECT)
        self.write_class_desc(
            "java.lang.Long",
            LONG_SUID,
            SC_SERIALIZABLE,
            [("J", "value")],
            "java.lang.Number",
        )
        self.next_handle()
        self.i8(value)

    def write_boxed_float(self, value: float) -> None:
        self.u1(TC_OBJECT)
        self.write_class_desc(
            "java.lang.Float",
            FLOAT_SUID,
            SC_SERIALIZABLE,
            [("F", "value")],
            "java.lang.Number",
        )
        self.next_handle()
        self.f4(value)

    def write_boxed_bool(self, value: bool) -> None:
        self.u1(TC_OBJECT)
        self.write_class_desc(
            "java.lang.Boolean",
            BOOLEAN_SUID,
            SC_SERIALIZABLE,
            [("Z", "value")],
            None,
        )
        self.next_handle()
        self.u1(1 if value else 0)

    def write_value(self, typed: dict[str, Any]) -> None:
        kind = typed["type"]
        value = typed["value"]
        if kind == TYPE_INT:
            self.write_boxed_int(int(value))
        elif kind == TYPE_LONG:
            self.write_boxed_long(int(value))
        elif kind == TYPE_FLOAT:
            self.write_boxed_float(float(value))
        elif kind == TYPE_BOOL:
            self.write_boxed_bool(bool(value))
        elif kind in (TYPE_STRING, "json"):
            if kind == "json" and not isinstance(value, str):
                text = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
            else:
                text = str(value)
            raw = encode_modified_utf8(text)
            if len(raw) <= 65535:
                self.write_string(text)
            else:
                self.u1(TC_LONGSTRING)
                self.string_handles[text] = self.next_handle()
                self.i8(len(raw))
                self.write(raw)
        else:
            raise StreamError(f"unsupported value type {kind}")

    def write_hashmap(self, payload: dict[str, Any]) -> bytes:
        entries: dict[str, Any] = payload["entries"]
        order: list[str] = payload.get("order") or list(entries)
        load_factor = float(payload.get("loadFactor", 0.75))
        size = len(order)
        buckets = int(payload.get("buckets") or next_power_of_two(max(16, int(size / load_factor) + 1)))
        threshold = int(payload.get("threshold") or int(buckets * load_factor))

        self.u2(STREAM_MAGIC)
        self.u2(STREAM_VERSION)
        self.u1(TC_OBJECT)
        self.write_class_desc(
            "java.util.HashMap",
            HASHMAP_SUID,
            SC_SERIALIZABLE | SC_WRITE_METHOD,
            [("F", "loadFactor"), ("I", "threshold")],
            None,
        )
        self.next_handle()
        self.f4(load_factor)
        self.i4(threshold)
        self.u1(TC_BLOCKDATA)
        self.u1(8)
        self.i4(buckets)
        self.i4(size)
        for key in order:
            if key not in entries:
                raise StreamError(f"order key missing from entries: {key}")
            self.write_string(key)
            self.write_value(entries[key])
        self.u1(TC_ENDBLOCKDATA)
        return bytes(self.buf)


def next_power_of_two(n: int) -> int:
    p = 1
    while p < n:
        p <<= 1
    return p


def to_json_payload(hashmap: dict[str, Any]) -> dict[str, Any]:
    entries_out: dict[str, Any] = {}
    raw_entries: dict[str, Any] = hashmap["__entries__"]
    for key, value in raw_entries.items():
        if isinstance(value, tuple) and len(value) == 2:
            kind, inner = value
            entries_out[key] = {"type": kind, "value": inner}
            continue
        if isinstance(value, str):
            entries_out[key] = {"type": TYPE_STRING, "value": value}
            continue
        raise StreamError(f"unsupported value for {key}: {value!r}")
    return {
        "loadFactor": hashmap.get("loadFactor", 0.75),
        "threshold": hashmap.get("threshold", 0),
        "buckets": hashmap["__buckets__"],
        "order": hashmap["__order__"],
        "entries": entries_out,
    }


def parse_dat(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    reader = JavaReader(data)
    obj = reader.read_stream()
    if not isinstance(obj, dict) or obj.get("__class__") != "java.util.HashMap":
        raise StreamError("root object is not a HashMap")
    if reader.remaining() != 0:
        raise StreamError(f"{reader.remaining()} trailing bytes after HashMap")
    return to_json_payload(obj)


def capture_suids_from_file(path: Path) -> None:
    """Fill boxed-type SUIDs from the source file so pack matches this PGSharp build."""
    global INTEGER_SUID, BOOLEAN_SUID, FLOAT_SUID, LONG_SUID, NUMBER_SUID, HASHMAP_SUID
    suids: dict[str, int] = {}

    class Capture(JavaReader):
        def read_class_desc_body(self) -> dict[str, Any]:  # type: ignore[override]
            desc = super().read_class_desc_body()
            suids[desc["name"]] = desc["suid"]
            return desc

    cap = Capture(path.read_bytes())
    cap.read_stream()
    HASHMAP_SUID = suids.get("java.util.HashMap", HASHMAP_SUID)
    INTEGER_SUID = suids.get("java.lang.Integer", INTEGER_SUID)
    BOOLEAN_SUID = suids.get("java.lang.Boolean", BOOLEAN_SUID)
    FLOAT_SUID = suids.get("java.lang.Float", FLOAT_SUID)
    LONG_SUID = suids.get("java.lang.Long", LONG_SUID)
    NUMBER_SUID = suids.get("java.lang.Number", NUMBER_SUID)


def write_dat(payload: dict[str, Any], path: Path) -> None:
    writer = JavaWriter()
    path.write_bytes(writer.write_hashmap(payload))


def dump_feeds_json(feeds: list[dict[str, Any]]) -> str:
    return json.dumps(feeds, ensure_ascii=True, separators=(",", ":"))


def feeds_from_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    feeds = payload["entries"].get("hlfeeds")
    if not feeds:
        raise StreamError("hlfeeds key not found")
    value = feeds["value"]
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, list):
        raise StreamError("hlfeeds is not a JSON array")
    return value


def set_feeds(payload: dict[str, Any], feeds: list[dict[str, Any]]) -> None:
    payload["entries"]["hlfeeds"] = {"type": TYPE_STRING, "value": dump_feeds_json(feeds)}


def duplicate_basic_to_xxl(feeds: list[dict[str, Any]], size: int) -> list[dict[str, Any]]:
    basic = [f for f in feeds if str(f.get("name", "")).startswith("Basic ")]
    if not basic:
        raise StreamError("no feeds named 'Basic …' were found")
    wanted = {"Basic 0001", "Basic 0301", "Basic 0601", "Basic 0901"}
    found = {f.get("name") for f in basic}
    missing = wanted - found
    if missing:
        print("warning: expected Basic feeds missing:", ", ".join(sorted(missing)), file=sys.stderr)

    kept = [f for f in feeds if not str(f.get("name", "")).startswith("XXL ")]
    clones = []
    for src in basic:
        name = str(src.get("name", ""))
        suffix = name.split(" ", 1)[1] if " " in name else name
        clone = copy.deepcopy(src)
        clone["name"] = f"XXL {suffix}"
        clone["size"] = size
        clones.append(clone)

    kept_names = {f.get("name") for f in kept}
    return kept + [c for c in clones if c["name"] not in kept_names]


def cmd_extract(args: argparse.Namespace) -> int:
    src = Path(args.dat)
    payload = parse_dat(src)
    out = Path(args.output) if args.output else src.with_suffix(".json")
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    feeds_path = out.with_name(out.stem + ".feeds.json")
    try:
        feeds = feeds_from_payload(payload)
        feeds_path.write_text(json.dumps(feeds, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        names = [f.get("name") for f in feeds]
        print(f"wrote {out}")
        print(f"wrote {feeds_path} ({len(feeds)} feeds)")
        print("feed names:", ", ".join(str(n) for n in names))
    except StreamError as exc:
        print(f"wrote {out}")
        print(f"feeds not extracted: {exc}")
    return 0


def cmd_pack(args: argparse.Namespace) -> int:
    src = Path(args.json)
    payload = json.loads(src.read_text(encoding="utf-8"))
    feeds_path = Path(args.feeds) if args.feeds else src.with_name(src.stem + ".feeds.json")
    if feeds_path.exists():
        feeds = json.loads(feeds_path.read_text(encoding="utf-8"))
        set_feeds(payload, feeds)
        print(f"merged feeds from {feeds_path}")
    if args.suid_from:
        capture_suids_from_file(Path(args.suid_from))
    else:
        dat_guess = src.with_suffix(".dat")
        if dat_guess.exists():
            capture_suids_from_file(dat_guess)
    out = Path(args.output) if args.output else src.with_suffix(".dat")
    write_dat(payload, out)
    verify = parse_dat(out)
    src_feeds = feeds_from_payload(payload)
    out_feeds = feeds_from_payload(verify)
    if src_feeds != out_feeds:
        raise StreamError("round-trip feeds mismatch")
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


def cmd_add_xxl(args: argparse.Namespace) -> int:
    src = Path(args.dat)
    capture_suids_from_file(src)
    payload = parse_dat(src)
    feeds = feeds_from_payload(payload)
    updated = duplicate_basic_to_xxl(feeds, args.size)
    set_feeds(payload, updated)
    out = Path(args.output) if args.output else src.with_name(src.stem + ".xxl.dat")
    json_out = out.with_suffix(".json")
    feeds_out = out.with_name(out.stem + ".feeds.json")
    json_out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    feeds_out.write_text(json.dumps(updated, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_dat(payload, out)
    verify = parse_dat(out)
    if feeds_from_payload(verify) != updated:
        raise StreamError("round-trip feeds mismatch")
    names = [f.get("name") for f in updated]
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    print(f"wrote {json_out}")
    print(f"wrote {feeds_out}")
    print("feed names:", ", ".join(str(n) for n in names))
    print(f"XXL size field set to {args.size} (0=any, 1=XXS, 2=XS, 3=M, 4=XL, 5=XXL)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract and repack PGSharp PGSData.dat")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ex = sub.add_parser("extract", help="DAT -> JSON")
    p_ex.add_argument("dat")
    p_ex.add_argument("-o", "--output")
    p_ex.set_defaults(func=cmd_extract)

    p_pk = sub.add_parser("pack", help="JSON -> DAT")
    p_pk.add_argument("json")
    p_pk.add_argument("-o", "--output")
    p_pk.add_argument("--feeds", help="optional pretty feeds JSON to merge")
    p_pk.add_argument("--suid-from", help="original .dat used to copy class serialVersionUIDs")
    p_pk.set_defaults(func=cmd_pack)

    p_xx = sub.add_parser("add-xxl", help="clone Basic 0001–0901 feeds to XXL and write a new DAT")
    p_xx.add_argument("dat")
    p_xx.add_argument("-o", "--output")
    p_xx.add_argument("--size", type=int, default=SIZE_XXL, help="feed size enum (default 5 = XXL)")
    p_xx.set_defaults(func=cmd_add_xxl)

    args = parser.parse_args()
    try:
        return args.func(args)
    except StreamError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
