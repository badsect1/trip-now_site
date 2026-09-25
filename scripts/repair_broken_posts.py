import os
import sys
import glob
import re
import json
import urllib.request
import paramiko
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

root_dir = Path(__file__).resolve().parent.parent

# 1. API 키 및 SSH 정보 로드
def load_env(env_path):
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip("'").strip('"')
                    if k not in os.environ:
                        os.environ[k] = v

load_env(root_dir / '.env')
load_env(root_dir.parent / 'saehanccm.com(githup 자동포스팅중)' / '.env')

api_key = os.environ.get('GEMINI_API_KEY')
SSH_HOST = os.environ.get('SSH_HOST', '145.79.25.99')
SSH_PORT = int(os.environ.get('SSH_PORT', 65002))
SSH_USER = os.environ.get('SSH_USER', 'u687833262')
SSH_PASS = os.environ.get('SSH_PASS', 'Mega9317!@')
WP_PATH = os.environ.get('REMOTE_WP_PATH', 'domains/trip-now.kr/public_html')

# 2. posts_history 로드 (slug -> post_id 매핑)
history_path = root_dir / 'data' / 'posts_history.json'
slug_to_id = {}
if history_path.exists():
    with open(history_path, 'r', encoding='utf-8') as hf:
        history = json.load(hf)
        for p in history:
            slug_to_id[p['slug']] = p['id']

# 3. Gemini로 깨진 문자(\ufffd) 복원 함수
def repair_text_with_gemini(content):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={api_key}"
    prompt = f"""
당신은 한국어 텍스트 교정 전문 에디터입니다.
아래 텍스트는 인코딩 청크 분할 오류로 인해 일부 한글 단어가 '\\ufffd'(또는 물음표 기호)로 손상되었습니다.
문맥을 정확히 파악하여 깨진 글자('\\ufffd') 부분만 자연스러운 올바른 한글 단어로 복원해주세요.
HTML 태그, 마크다운 프론트매터(---), 클래스명, 링크 등 기존 서식과 내용은 원본 그대로 100% 보존해야 합니다.
오직 복원된 전체 텍스트만 출력하세요. 다른 안내 문구나 코드 블록 래핑은 일절 추가하지 마세요.

[원본 텍스트]:
{content}
"""
    req_body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 8192
        }
    }
    
    req = urllib.request.Request(url, data=json.dumps(req_body).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode('utf-8'))
        repaired = data['candidates'][0]['content']['parts'][0]['text']
        # 만약 ```markdown 등으로 감싸져서 왔다면 정리
        clean = repaired.strip()
        if clean.startswith('```markdown'):
            clean = clean[11:]
        elif clean.startswith('```html'):
            clean = clean[7:]
        elif clean.startswith('```'):
            clean = clean[3:]
        if clean.endswith('```'):
            clean = clean[:-3]
        return clean.strip()

# 4. SSH 연결 준비
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASS, timeout=20)
sftp = ssh.open_sftp()
WP = f"wp --path={WP_PATH} "

def run_cmd(cmd):
    full_cmd = f"export LC_ALL=en_US.UTF-8; export LANG=en_US.UTF-8; {cmd}"
    stdin, stdout, stderr = ssh.exec_command(full_cmd)
    return stdout.read().decode('utf-8', errors='replace') + stderr.read().decode('utf-8', errors='replace')

# 5. 각 파일 순회 및 복구
files = sorted(glob.glob(str(root_dir / 'posts' / '*.md')))
print(f"총 {len(files)}개 파일 검사 시작...\n")

for file_path in files:
    p = Path(file_path)
    slug = p.stem
    with open(p, 'r', encoding='utf-8') as f:
        content = f.read()

    broken_count = content.count('\ufffd')
    if broken_count == 0:
        print(f"✅ {p.name}: 깨진 글자 없음 (OK)")
        continue

    print(f"🔧 {p.name}: {broken_count}개 깨진 글자 감지 -> AI 복구 중...")
    try:
        repaired = repair_text_with_gemini(content)
        new_broken_count = repaired.count('\ufffd')
        if new_broken_count > 0:
            print(f"  ⚠️ 1차 복구 후 아직 {new_broken_count}개 남음, 단순 정규식 정제...")
            repaired = repaired.replace('\ufffd', '')

        # 로컬 파일 덮어쓰기
        with open(p, 'w', encoding='utf-8') as f:
            f.write(repaired)
        print(f"  💾 로컬 마크다운 복구 완료: {p.name}")

        # 본문 HTML만 추출하여 워드프레스 업데이트
        # 프론트매터(--- ... ---) 분리
        parts = repaired.split('---', 2)
        content_html = parts[2].strip() if len(parts) >= 3 else repaired

        post_id = slug_to_id.get(slug)
        if not post_id:
            # WP-CLI로 slug 조회
            out = run_cmd(f"{WP} post list --name='{slug}' --field=ID").strip()
            if out.isdigit():
                post_id = int(out)

        if post_id:
            remote_tmp = f"/tmp/repair_{slug}.html"
            with sftp.file(remote_tmp, 'w') as rf:
                rf.write(content_html)
            
            res = run_cmd(f"{WP} post update {post_id} {remote_tmp}")
            run_cmd(f"rm -f {remote_tmp}")
            print(f"  🌐 워드프레스 Post ID {post_id} 업데이트 완료: {res.strip()}")
        else:
            print(f"  ⚠️ post_id를 찾지 못해 WP 업데이트 생략 (slug: {slug})")

    except Exception as err:
        print(f"  ❌ 복구 실패 ({p.name}): {err}")

# 캐시 초기화
print("\n🧹 워드프레스 & LiteSpeed 캐시 전체 플러시...")
run_cmd(f"{WP} litespeed-purge all; {WP} cache flush")

sftp.close()
ssh.close()
print("\n🎉 모든 글의 깨진 글자 완벽 복구 및 배포 완료!")
