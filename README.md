# ⚡ 테슬라 연대기 (Tesla Chronicles) - trip-now.kr

> **테슬라(Tesla) 자동차 최신 뉴스 및 전기차·자율주행 심층 분석 자동 포스팅 시스템**  
> Google AdSense 승인 기준(E-E-A-T, 충분한 본문 분량, 구조적 완성도, 독창성)을 완벽하게 만족하는 무인 포스팅 파이프라인

---

## 🌟 사이트 정보
- **도메인**: [https://trip-now.kr](https://trip-now.kr)
- **사이트명**: 테슬라 연대기 (Tesla Chronicles)
- **슬로건**: 테슬라 최신 뉴스 및 전기차·자율주행 심층 분석 | Tesla Chronicles
- **호스팅 환경**: Hostinger Cloud Linux (PHP 8.3 / MariaDB / LiteSpeed Cache / Astra Theme)

---

## 💎 애드센스 승인 최적화 핵심 설계

### 1. 이미지 없이도 가독성과 체류시간을 극대화한 서식
- ⚡ **핵심 브리핑 박스 (`.tesla-summary-box`)**: 바쁜 독자와 AI 검색 봇을 위한 4줄 요약
- 📊 **반응형 스펙 및 비교 테이블 (`.tesla-table-wrapper`)**: 하드웨어 세대별/트림별 정밀 비교표
- 💡 **전문가 인사이트 콜아웃 (`.tesla-callout`)**: 핵심 기술 변곡점 및 규제 포인트
- ❓ **FAQ 아코디언 카드 (`.tesla-faq-item`)**: 구글 리치 스니펫 대응 3~4개 Q&A
- 📝 **풍부한 본문 분량**: 1편당 순수 텍스트 공백 제외 2,500자 ~ 3,500자 이상의 고밀도 칼럼

### 2. 애드센스 필수 4대 신뢰성 페이지 구축 완료
- [사이트 소개 (About Us)](https://trip-now.kr/about/)
- [개인정보처리방침 (Privacy Policy)](https://trip-now.kr/privacy-policy-2/) (구글 애드센스 쿠키 및 데이터 처리 조항 완비)
- [면책조항 (Disclaimer)](https://trip-now.kr/disclaimer/) (독립 미디어 고지 및 투자 비권유 안내)
- [문의하기 (Contact Us)](https://trip-now.kr/contact/)

### 3. 테슬라 맞춤 5대 전문 카테고리 구성
1. **테슬라 최신 뉴스** (`/category/tesla-news/`) - 신차 출시, 기가팩토리, 실적 발표
2. **FSD & 자율주행** (`/category/fsd-autonomous/`) - FSD V12/V13 신경망, 오토파일럿, AI 비전
3. **모델별 심층 가이드** (`/category/model-guide/`) - 모델 Y 주니퍼, 모델 3 하이랜드, 사이버트럭
4. **배터리 & 슈퍼차저** (`/category/battery-charging/`) - 4680 배터리, LFP, 슈퍼차저 V4, NACS
5. **로보택시 & 미래 비전** (`/category/robotaxi-ai/`) - 사이버캡, 옵티머스 휴머노이드 로봇

---

## 📂 프로젝트 구조

```text
trip-now.kr(테슬라연대기)/
├── .github/
│   └── workflows/
│       └── daily-tesla-post.yml  # GitHub Actions 스케줄러 (매일 오전 8:30 KST 자동 실행)
├── scripts/
│   ├── generate_tesla_post.mjs   # 실시간 뉴스 수집 + Gemini AI 심층 칼럼 생성
│   ├── publish_to_wp.py         # WP-CLI (SSH) 원격 워드프레스 즉시 발행 & 캐시 플러시
│   └── run_now.bat              # 윈도우 원클릭 즉시 실행 배치 파일
├── data/
│   ├── topics_tesla.json        # 테슬라 전문 토픽 풀 & 카테고리 매핑
│   └── posts_history.json       # 발행된 글 히스토리 (중복 생성 방지용)
├── posts/                       # 발행된 글 마크다운(.md) 백업 저장소
├── .env                         # 로컬 실행용 환경설정 (Git 제외)
├── .env.example                 # 환경설정 템플릿
├── package.json                 # Node.js 설정
└── README.md                    # 본 설명서
```

---

## 🚀 GitHub Actions 자동 포스팅 설정 가이드

### 1단계: GitHub 새 저장소 생성 및 푸시
```bash
git init
git add .
git commit -m "feat: 테슬라 연대기 자동 포스팅 시스템 구축"
git branch -M main
git remote add origin https://github.com/<당신의_깃허브_아이디>/<저장소_이름>.git
git push -u origin main
```

### 2단계: GitHub Secrets 등록
GitHub 저장소의 `Settings` > `Secrets and variables` > `Actions` > `New repository secret`에서 아래 항목들을 추가합니다:

| Secret 이름 | 값 | 설명 |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `AQ.Ab8RN6...` | Google Gemini API 키 |
| `SSH_HOST` | `145.79.25.99` | Hostinger 서버 IP |
| `SSH_PORT` | `65002` | Hostinger SSH 포트 |
| `SSH_USER` | `u687833262` | Hostinger SSH 사용자명 |
| `SSH_PASS` | `Mega9317!@` | Hostinger SSH 비밀번호 |

### 3단계: 자동 실행 확인
- **자동 스케줄**: 매일 한국 시간 오전 8시 30분(UTC 23:30)에 GitHub Actions가 자동으로 최신 뉴스를 감지하여 글을 발행하고 리포지토리에 커밋합니다.
- **수동 즉시 실행**: GitHub 웹 콘솔의 `Actions` 탭 > `Daily Auto Tesla Chronicles Post` 워크플로우 클릭 > `Run workflow` 버튼 클릭으로 언제든 즉시 1편을 추가 발행할 수 있습니다.

---

## 💻 로컬에서 즉시 1편 포스팅하기

컴퓨터에서 바로 새 글을 작성하여 사이트에 올리고 싶을 때는:
1. `scripts/run_now.bat`을 더블 클릭하거나,
2. 터미널에서 다음 명령어를 실행합니다:
```bash
npm run post
```
