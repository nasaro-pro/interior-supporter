#!/usr/bin/env python3
"""AI 작업 문서 생성기 — docs/00 헌법 전문 + 01~04 의 내 부분 + 계약 코드 + DB 스키마를 담당별 한 파일로 묶는다.

사용: python scripts/build-ai-docs.py      (저장소 최상위에서)
출력: ai/AI_작업문서_A_박예원.md, ai/AI_작업문서_B_류영걸.md, ai/AI_작업문서_C_이재서.md
원칙: 출력 파일은 직접 고치지 않는다. 원본(docs, contracts, migrations)을 고친 뒤 다시 생성한다. 실행: 통합 책임자(스타터 개정 때)
"""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = ROOT / "ai"

D01 = (DOCS / "01_제품정의_요구사항.md").read_text(encoding="utf-8")
D02 = (DOCS / "02_화면구조_뎁스_디자인.md").read_text(encoding="utf-8")
D03 = (DOCS / "03_아키텍처_데이터_보안.md").read_text(encoding="utf-8")
D00 = (DOCS / "00_헌법_공통규칙.md").read_text(encoding="utf-8")
D04 = (DOCS / "04_담당별_작업지시서.md").read_text(encoding="utf-8")
OWNERSHIP = json.loads((ROOT / "ownership.json").read_text(encoding="utf-8"))
PKG = (ROOT / "package.json").read_text(encoding="utf-8")
CONTRACTS = sorted((ROOT / "src/shared/contracts").glob("*.ts"))
MIG = {p.name: p.read_text(encoding="utf-8") for p in sorted((ROOT / "supabase/migrations").glob("*.sql"))}

PEOPLE = {
    "A": {"name": "박예원", "title": "공통 기반 · 프로젝트 관리 · 통합",
          "req": "4.1", "screens6": ["6.6", "6.7"], "flows": ["3.1", "3.2", "3.3"],
          "mig": ["20261006000100_a_foundation.sql", "20261006000900_a_grants_hardening.sql"],
          "sql_ref": []},
    "B": {"name": "류영걸", "title": "도안 · 자재 · 견적 · 확정 · 공통 파일 어댑터",
          "req": "4.2", "screens6": ["6.1", "6.5"], "flows": ["3.1", "3.3"],
          "mig": ["20261006000200_b_designs_materials_estimates.sql"],
          "sql_ref": []},
    "C": {"name": "이재서", "title": "고객 요청 · 현장 사진 · 일정",
          "req": "4.3", "screens6": ["6.2", "6.3", "6.4"], "flows": ["3.1", "3.3"],
          "mig": ["20261006000300_c_requests_photos_schedule.sql"],
          "sql_ref": []},
}


def section(md: str, number: str, level: int | None = None) -> str:
    """'## 3.' 또는 '### 6.1' 처럼 번호로 시작하는 절을 다음 같은/상위 수준 제목 전까지 잘라낸다.
    코드 블록 안의 '#' 줄은 제목으로 보지 않는다."""
    lines = md.splitlines()
    fence = False
    start = None
    lvl = None
    for i, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            fence = not fence
            continue
        if fence:
            continue
        m = re.match(r"^(#{2,4}) (\S+)", line)
        if not m:
            continue
        if start is None:
            tok = m.group(2).rstrip(".")
            if tok == number.rstrip("."):
                start, lvl = i, (len(m.group(1)) if level is None else level)
        elif len(m.group(1)) <= lvl:
            return "\n".join(lines[start:i]).rstrip() + "\n"
    if start is None:
        raise SystemExit(f"절을 찾지 못함: {number}")
    return "\n".join(lines[start:]).rstrip() + "\n"


def demote(text: str, by: int = 1) -> str:
    """제목 수준을 낮춘다. 코드 블록(``` ... ```) 안은 건드리지 않는다."""
    out, fence = [], False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            fence = not fence
        if not fence and re.match(r"^#{1,5} ", line):
            hashes = len(line) - len(line.lstrip("#"))
            line = "#" * min(hashes + by, 6) + line[hashes:]
        out.append(line)
    return "\n".join(out) + "\n"


def retitle(text: str, num: str, level: int = 3) -> str:
    """절의 첫 제목을 '<level> <num> <원래 제목(번호 제거)>' 로 바꾸고, 하위 제목은 상대 수준을 유지한다."""
    lines = text.splitlines()
    first = lines[0]
    old_level = len(first) - len(first.lstrip("#"))
    title = re.sub(r"^#+\s+[0-9.]+\s*", "", first).strip()
    body = demote("\n".join(lines[1:]), level - old_level) if level != old_level else "\n".join(lines[1:]) + "\n"
    return f"{'#' * level} {num} {title}\n" + body


def person_chapter(key: str) -> str:
    """04 문서의 'A. ...' 장 전체."""
    m = re.search(rf"^## {key}\. .*$", D04, re.M)
    n = re.search(r"^## [A-Z]\. ", D04[m.end():], re.M)
    return D04[m.start(): m.end() + (n.start() if n else len(D04) - m.end())].rstrip() + "\n"


def screen_rows(key: str) -> str:
    sec = section(D02, "3")
    lines = sec.splitlines()
    keep = [l for l in lines if not l.startswith("| ") or l.startswith("| 화면 ID") or l.startswith("|---")
            or re.search(rf"\| {key} \|", l)]
    return "\n".join(keep) + "\n"


def sql_block(name: str) -> str:
    return f"#### `supabase/migrations/{name}`\n\n```sql\n{MIG[name].rstrip()}\n```\n"


def sql_tables_only(name: str) -> str:
    """다른 담당 마이그레이션은 테이블 정의(create table ...;)만 참고용으로."""
    tables = re.findall(r"(create table public\.\w+ \(.*?\n\);)", MIG[name], re.S)
    return f"#### 참고: `{name}` 의 테이블 정의 (읽기 전용 — 내 코드에서 쓰지 않음)\n\n```sql\n" + "\n\n".join(tables) + "\n```\n"


def files_table() -> str:
    m = re.search(r"(-- ENT-file.*?\n\);)", MIG["20261006000100_a_foundation.sql"], re.S)
    helpers = re.search(r"(create function private\.attach_file\(.*?end \$\$;)", MIG["20261006000100_a_foundation.sql"], re.S)
    vis = re.search(r"(create function private\.can_view_owner\(.*?end \$\$;\s*create function private\.can_view_file\(.*?end \$\$;)",
                    MIG["20261006000100_a_foundation.sql"], re.S)
    pol = re.search(r"(-- files \(INSERT.*?end\);)", MIG["20261006000100_a_foundation.sql"], re.S)
    parts = [x.group(1) for x in (m, helpers, vis, pol) if x]
    return "#### 공통 파일 테이블·연결 함수·열람 판정·정책 (`20261006000100_a_foundation.sql` 발췌 — 파일 어댑터가 쓰는 부분)\n\n```sql\n" + "\n\n".join(parts) + "\n```\n"


def contracts_block() -> str:
    out = []
    for p in CONTRACTS:
        out.append(f"#### `src/shared/contracts/{p.name}`\n\n```ts\n{p.read_text(encoding='utf-8').rstrip()}\n```\n")
    return "\n".join(out)


def reference_code() -> str:
    paths = ["src/shared/lib/supabase/server.ts", "src/shared/lib/supabase/browser.ts",
             "src/shared/lib/supabase/admin.ts", "src/shared/lib/logger.ts",
             "src/shared/lib/dates.ts", "src/shared/lib/money.ts", "src/shared/lib/utils.ts", "src/i18n/request.ts"]
    out = []
    for rel in paths:
        out.append(f"#### `{rel}` (스타터 고정 파일 · import 만)\n\n```ts\n{(ROOT / rel).read_text(encoding='utf-8').rstrip()}\n```\n")
    return "\n".join(out)


def constitution() -> str:
    """헌법 전문. 제목을 '헌법 N.' / '헌법 N.M' 으로 바꿔 이 파일의 장 번호와 섞이지 않게 한다."""
    body = D00.split("\n---\n", 1)[1]
    out, fence = [], False
    for line in body.splitlines():
        if line.lstrip().startswith("```"):
            fence = not fence
        if not fence:
            m = re.match(r"^(#{2,3}) (\d+(?:\.\d+)?)\.? (.*)$", line)
            if m:
                line = f"{'#' * (len(m.group(1)) + 1)} 헌법 {m.group(2)} {m.group(3)}"
            elif re.match(r"^## 부록", line):
                line = "#" + line.replace("## 부록", "## 헌법 부록", 1)
        out.append(line)
    return "\n".join(out).strip() + "\n"


def others_block(key: str) -> str:
    """나머지 두 명: 담당 요약 + 작업표 (만들지 말아야 할 것·연결 대상 파악용)."""
    parts = []
    for o in [k for k in PEOPLE if k != key]:
        ch = person_chapter(o)
        title = ch.splitlines()[0].lstrip("# ").strip()
        summary = re.search(r"#### 담당 요약\n(.*?)(?=\n#### |\n### )", ch, re.S)
        tasks = re.search(rf"### {o}-1\. 작업\n(.*?)(?=\n### |\Z)", ch, re.S)
        parts.append(f"### 2.{len(parts) + 3} {title} — 하는 일 (나는 만들지 않는다)\n\n"
                     + (summary.group(1).strip() if summary else "") + "\n\n#### 작업표\n\n"
                     + (tasks.group(1).strip() if tasks else "") + "\n")
    return "\n".join(parts)


def overview_table() -> str:
    sec = section(D04, "0")
    return sec.split("\n", 1)[1].strip() + "\n"


def build(key: str) -> str:
    pp = PEOPLE[key]
    own = OWNERSHIP[key]
    today = date.today().isoformat()
    parts: list[str] = []
    parts.append(f"""# AI 작업 문서 — {key} {pp['name']} ({pp['title']})

> 생성: {today} · 생성기 `scripts/build-ai-docs.py` · 원본: `docs/00~04`, `src/shared/contracts/*.ts`, `supabase/migrations/*.sql`, `ownership.json`
> **이 파일 하나에 {key} 담당 작업에 필요한 모든 기준이 들어 있다** — 헌법 전문(1장), 나머지 두 명이 하는 일과 연결(2장), 내 요구사항·화면·DB·작업표.
> 이 문서와 다른 자료(팀 기준서 2종, 예전 대화, 일반 관행)가 충돌하면 이 문서를 따른다. 이 파일은 직접 고치지 않는다.
> 작업 방식: 내 컴퓨터의 스타터 폴더에서 혼자 작업한다(GitHub·원격 저장소 없음). 끝나면 `npm run submit -- --owner {key}` 로 제출본을 만들어 통합 책임자(소용우)에게 보낸다.

## 0. 이 문서의 사용 규칙

### 0.1 이 문서를 읽는 작업자(사람 또는 AI)가 지켜야 할 것
1. 작업 단위는 **TASK 하나**다(11장). 요청이 TASK 번호로 오면 그 TASK 의 요구사항(6장)·화면(7장)·데이터(10장)·검증 ID(11장)·연결(2장)을 모두 확인하고 시작한다.
2. 결과물은 **파일 경로와 전체 내용**으로 낸다. 경로는 9.1 의 내 소유 경로 안이어야 한다. 남의 기능은 STUB(헌법 5.7)만 만든다. 스타터 고정 파일(헌법 3.3)은 고치지 않는다.
3. DB 는 10장의 마이그레이션이 완성본이다. 테이블·컬럼·RPC·오류 메시지·열거형 값을 새로 지어내지 않는다.
4. 새 패키지 설치, `package.json`·설정·계약·마이그레이션 변경, `npx shadcn init` 은 하지 않는다. 필요하면 CR(헌법 5.9)로 적는다.
5. 문서에 답이 없으면 추측해서 만들지 않는다. "결정 필요"로 적고 가능한 해석 2가지와 영향을 쓴다.
6. 매 결과 끝에 아래 **보고 형식**을 붙인다.
7. 본문의 "01 문서 3장", "03 문서 5.1", "헌법 5.7" 같은 참조는 원본 문서 위치다. 이 파일에서의 위치는 0.3 을 본다.

### 0.2 보고 형식 (매 TASK 결과 끝)
```
- TASK / REQ / 화면 ID / 검증 ID:
- 만든·바꾼 파일 (경로):
- STUB 으로 만든 파일 (첫 줄 // STUB({key}): 병합 시 폐기 — 계약: integration.ts):
- 남과의 연결에 쓴 계약 (이름):
- 실행할 명령: npm run format && npm run check  (DB 를 바꿨다면 npm run db:test) · npm run check:ownership -- --owner {key}
- 직접 확인할 시나리오(역할별):
- 확인 못 한 것 · 결정 필요 · CR:
```

### 0.3 원본 문서 위치 → 이 파일 위치
| 원본 | 이 파일 |
|---|---|
| 00 헌법 N장 / N.M | 1장의 "헌법 N" / "헌법 N.M" (번호 그대로) |
| 04 문서 0장 · 다른 두 명의 장 · 내 장의 '연결' | 2장 |
| 01 문서 1장 / 2장 / 3장 / 4장 / 5장 / 7장 | 3장 / 4장 / 5장 / 6장 / 6.9 / 5.9 |
| 02 문서 1~8장 | 7장 (7.1~7.8, 핵심 화면 세부는 7.6.x) |
| 03 문서 1장 / 2.1 / 2.2 / 3.x / 4.1 / 4.2~4.4 / 5.1 / 6장 / 7장 / 9.1 | 8.1 / 8.2 / 8.3 / 8.4.x / 10.1 / 8.5~8.7 / 8.8 / 8.9 / 8.10 / 8.11 |
| 04 문서 내 장 | 11장 |

### 0.4 목차
0 사용 규칙 · 1 헌법(전문) · 2 나와 다른 두 명 — 역할·연결 · 3 제품 · 4 용어 · 5 정책·권한·결정 대장 · 6 내 요구사항 · 7 내 화면·디자인 · 8 아키텍처·흐름 · 9 계약 코드·내 소유 경로 · 10 내 데이터베이스 · 11 내 작업·검증표

---
""")
    # 1 헌법
    parts.append("## 1. 헌법 (전문 — 모든 규칙의 원문, 이 파일에서 가장 우선)\n\n" + constitution())
    # 2 연결
    mine = person_chapter(key)
    link = re.search(r"#### 다른 두 명이 하는 일과 연결.*?\n(.*?)(?=\n### )", mine, re.S)
    parts.append("## 2. 나와 다른 두 명 — 역할 · 연결\n\n### 2.1 세 명 한눈에 보기\n\n" + overview_table()
                 + "\n### 2.2 내가 주고받는 것 (" + key + " 기준)\n\n" + (link.group(1).strip() if link else "") + "\n\n"
                 + others_block(key))
    # 3 제품
    parts.append("## 3. 제품\n\n" + demote(section(D01, "1").split("\n", 1)[1]))
    # 4 용어
    parts.append("## 4. 용어\n\n" + section(D01, "2").split("\n", 1)[1])
    # 5 정책
    parts.append("## 5. 정책 · 권한 · 결정 대장\n\n" + demote(section(D01, "3").split("\n", 1)[1])
                 + "\n" + "### 5.9 통합 결정 대장\n\n" + demote(section(D01, "7").split("\n", 1)[1]))
    # 6 요구사항
    req_intro = section(D01, "4").split("### 4.1")[0].split("\n", 1)[1]
    parts.append("## 6. 내 요구사항\n\n" + req_intro + "\n" + retitle(section(D01, pp["req"]), "6.1", 3)
                 + "\n### 6.9 비기능 요구사항 (전원 공통)\n\n" + section(D01, "5").split("\n", 1)[1])
    # 7 화면
    s7 = [retitle(section(D02, "1"), "7.1", 3),
          retitle(section(D02, "2"), "7.2", 3),
          retitle(screen_rows(key), "7.3", 3).replace("화면 레지스트리 (요약", "내 화면 레지스트리 (요약", 1),
          retitle(section(D02, "4"), "7.4", 3),
          retitle(section(D02, "5"), "7.5", 3)]
    for i, n in enumerate(pp["screens6"], 1):
        s7.append(retitle(section(D02, n), f"7.6.{i}", 4))
    s7.append(retitle(section(D02, "7"), "7.7", 3))
    s7.append(retitle(section(D02, "8"), "7.8", 3))
    parts.append("## 7. 내 화면 · 디자인 시스템\n\n" + "\n".join(s7))
    # 8 아키텍처
    s8 = [retitle(section(D03, "1"), "8.1", 3),
          retitle(section(D03, "2.1"), "8.2", 3),
          retitle(section(D03, "2.2"), "8.3", 3)]
    for i, n in enumerate(pp["flows"], 1):
        s8.append(retitle(section(D03, n), f"8.4.{i}", 4))
    s8 += [retitle(section(D03, "4.2"), "8.5", 3),
           retitle(section(D03, "4.3"), "8.6", 3),
           retitle(section(D03, "4.4"), "8.7", 3),
           retitle(section(D03, "5.1"), "8.8", 3),
           retitle(section(D03, "6"), "8.9", 3),
           retitle(section(D03, "7"), "8.10", 3),
           retitle(section(D03, "9.1"), "8.11 팀 기준서 대응 —", 3)]
    parts.append("## 8. 아키텍처 · 흐름\n\n" + "\n".join(s8))
    # 9 계약
    parts.append("## 9. 계약 코드 · 내 소유 경로\n\n### 9.1 내 소유 경로 (이 밖의 파일은 만들거나 고치지 않는다 — STUB 제외)\n\n"
                 + "\n".join(f"- `{g}`" for g in own)
                 + "\n\n스타터 고정 파일(누구도 수정 금지, 새 파일 추가는 소유자만): "
                 + ", ".join(f"`{g}`" for g in OWNERSHIP["frozen"]) + "\n\n"
                 + "### 9.2 계약 코드 (원문 그대로 — 이름·시그니처를 바꾸지 않는다)\n\n" + contracts_block()
                 + "\n### 9.3 기준 코드 (스타터에 이미 있음)\n\n" + reference_code())
    # 10 DB
    db = ["## 10. 내 데이터베이스 (완성본 — 수정 금지, 새 마이그레이션은 CR)\n",
          retitle(section(D03, "4.1"), "10.1 전체", 3),
          "### 10.2 내 마이그레이션 전문\n"]
    for name in pp["mig"]:
        db.append(sql_block(name))
    if key in ("B", "C"):
        db.append(files_table())
    for name in pp["sql_ref"]:
        db.append(sql_tables_only(name))
    parts.append("\n".join(db))
    # 11 작업·검증
    parts.append("## 11. 내 작업 · 검증표\n\n" + demote(person_chapter(key), 1))
    return "\n".join(parts)

def strip_sub_numbers(text: str) -> str:
    """가져온 절의 하위 제목(####~)에 남은 원본 번호를 지운다. 이 파일이 새로 붙인 7.6.x·8.4.x 는 유지."""
    out, fence = [], False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            fence = not fence
        m = re.match(r"^(#{4,6}) (\d+(?:\.\d+)*\.?) (.*)$", line)
        if not fence and m and not re.match(r"^(7\.6|8\.4)\.\d", m.group(2)):
            line = f"{m.group(1)} {m.group(3)}"
        out.append(line)
    return "\n".join(out) + "\n"


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for key, pp in PEOPLE.items():
        text = strip_sub_numbers(build(key))
        path = OUT / f"AI_작업문서_{key}_{pp['name']}.md"
        path.write_text(text, encoding="utf-8")
        print(f"{path.relative_to(ROOT)}  {len(text):,} chars")


if __name__ == "__main__":
    main()
