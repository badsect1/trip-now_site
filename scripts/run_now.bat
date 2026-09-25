@echo off
chcp 65001 > nul
echo [1/2] 테슬라 최신 뉴스 및 칼럼 AI 생성 시작...
node scripts/generate_tesla_post.mjs
if %errorlevel% neq 0 (
    echo [ERROR] 글 생성 중 오류가 발생했습니다.
    pause
    exit /b %errorlevel%
)

echo [2/2] 워드프레스(trip-now.kr) 자동 발행 시작...
python scripts/publish_to_wp.py
if %errorlevel% neq 0 (
    echo [ERROR] 워드프레스 발행 중 오류가 발생했습니다.
    pause
    exit /b %errorlevel%
)

echo.
echo ==============================================
echo [SUCCESS] 테슬라 연대기 포스팅이 성공적으로 완료되었습니다!
echo ==============================================
pause
