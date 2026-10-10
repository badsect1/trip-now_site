import os
import sys
import json
import shlex
import paramiko
from pathlib import Path

# Windows 콘솔 utf-8 출력 보장
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# 1. 경로 설정
current_dir = Path(__file__).resolve().parent
root_dir = current_dir.parent

# 2. .env 파서
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

# 환경변수 로드
SSH_HOST = os.environ.get('SSH_HOST', os.environ.get('FTP_SERVER', '145.79.25.99'))
SSH_PORT = int(os.environ.get('SSH_PORT', os.environ.get('FTP_PORT', 65002)))
SSH_USER = os.environ.get('SSH_USER', os.environ.get('FTP_USERNAME', 'u687833262'))
SSH_PASS = os.environ.get('SSH_PASS', os.environ.get('FTP_PASSWORD', ''))
WP_PATH = os.environ.get('REMOTE_WP_PATH', 'domains/trip-now.kr/public_html')
SITE_URL = os.environ.get('SITE_URL', 'https://trip-now.kr').rstrip('/')

if not SSH_PASS:
    print('❌ SSH_PASS 환경변수가 없습니다.')
    sys.exit(1)

# 3. 배포 대상 포스트 JSON 로드
pending_path = root_dir / 'data' / 'latest_pending_post.json'
if not pending_path.exists():
    print('❌ 배포할 latest_pending_post.json 파일이 없습니다.')
    sys.exit(1)

with open(pending_path, 'r', encoding='utf-8') as f:
    article = json.load(f)

title = article['title']
slug = article['slug']
category_id = article.get('category_id', 1)
tags = ','.join(article.get('tags', []))
content_html = article['content_html']
meta_desc = article.get('meta_description', '')
focus_kw = article.get('focus_keyword', '')

print(f"🚀 워드프레스 배포 시작: {title}")
print(f"📡 서버: {SSH_HOST}:{SSH_PORT} ({SSH_USER})")

# 4. SSH 연결
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASS, timeout=20)
    print("✅ SSH 연결 성공!")

    # 5. 본문 HTML 임시 파일 업로드 via SFTP
    sftp = ssh.open_sftp()
    remote_content_file = f"/tmp/wp_post_{slug}.html"
    with sftp.file(remote_content_file, "w") as rf:
        rf.write(content_html.strip())
    sftp.close()
    print(f"📄 원격 본문 임시 파일 업로드 완료: {remote_content_file}")

    # 6. WP-CLI 명령어 실행
    def run_cmd(cmd):
        full_cmd = f"export LC_ALL=en_US.UTF-8; export LANG=en_US.UTF-8; {cmd}"
        stdin, stdout, stderr = ssh.exec_command(full_cmd)
        return stdout.read().decode('utf-8', errors='replace') + stderr.read().decode('utf-8', errors='replace')

    WP = f"wp --path={WP_PATH} "

    # Yoast SEO 메타 데이터 JSON
    meta_dict = {
        "_yoast_wpseo_metadesc": meta_desc,
        "_yoast_wpseo_focuskw": focus_kw,
        "_yoast_wpseo_title": f"{title} | 테슬라 연대기"
    }
    meta_json_str = json.dumps(meta_dict, ensure_ascii=False)

    create_cmd = (
        f"{WP} post create {shlex.quote(remote_content_file)} "
        f"--post_title={shlex.quote(title)} "
        f"--post_name={shlex.quote(slug)} "
        f"--post_category={int(category_id)} "
        f"--tags_input={shlex.quote(tags)} "
        f"--post_status=publish "
        f"--meta_input={shlex.quote(meta_json_str)} "
        f"--porcelain"
    )

    out = run_cmd(create_cmd).strip()
    
    # post_id 파싱
    post_id = None
    for line in out.splitlines():
        line = line.strip()
        if line.isdigit():
            post_id = int(line)
            break

    if not post_id:
        print(f"❌ 포스트 생성 실패. WP-CLI 출력:\n{out}")
        run_cmd(f"rm -f {shlex.quote(remote_content_file)}")
        sys.exit(1)

    post_url = f"{SITE_URL}/{slug}/"
    print(f"🎉 워드프레스 발행 완료! (Post ID: {post_id})")
    print(f"🔗 발행 URL: {post_url}")

    # 캐시 비우기
    run_cmd(f"{WP} litespeed-purge all; {WP} cache flush")
    print("🧹 워드프레스 & 라이트스피드 캐시 초기화 완료")

    # 원격 임시 파일 정리
    run_cmd(f"rm -f {shlex.quote(remote_content_file)}")

    # 7. posts_history.json 업데이트
    history_path = root_dir / 'data' / 'posts_history.json'
    history = []
    if history_path.exists():
        try:
            with open(history_path, 'r', encoding='utf-8') as hf:
                history = json.load(hf)
        except Exception:
            history = []

    history_entry = {
        "id": post_id,
        "title": title,
        "slug": slug,
        "category_id": category_id,
        "category_name": article.get('category_name', ''),
        "url": post_url,
        "tags": article.get('tags', []),
        "published_at": article.get('created_at', ''),
        "date_formatted": article.get('date_formatted', '')
    }
    history.insert(0, history_entry)

    with open(history_path, 'w', encoding='utf-8') as hf:
        json.dump(history, hf, ensure_ascii=False, indent=2)

    print(f"📚 포스트 히스토리 기록 완료 (총 {len(history)}편 등록됨)")

    # latest_pending_post.json 정리
    try:
        pending_path.unlink()
    except Exception:
        pass

    ssh.close()
    print("✨ 모든 배포 작업이 성공적으로 종료되었습니다!")

except Exception as e:
    print(f"❌ 오류 발생: {e}")
    sys.exit(1)
