#!/usr/bin/env node
// init-env.mjs — .env.example → .env.local (없을 때만). 값은 직접 채운다. .env.local 은 제출·공유하지 않는다.
import { copyFileSync, existsSync } from 'node:fs';

if (existsSync('.env.local')) console.log('.env.local 이 이미 있습니다 (덮어쓰지 않음).');
else {
  copyFileSync('.env.example', '.env.local');
  console.log('.env.local 을 만들었습니다. 값(URL·키·REF)을 채우세요.');
}
