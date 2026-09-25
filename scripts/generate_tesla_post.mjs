import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. .env 파서
function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const eqIdx = trimmed.indexOf('=');
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}

loadEnv(path.join(rootDir, '.env'));
loadEnv(path.join(rootDir, '..', 'saehanccm.com(githup 자동포스팅중)', '.env'));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

// 2. 기존 포스트 히스토리 로드
const historyPath = path.join(rootDir, 'data', 'posts_history.json');
let history = [];
if (fs.existsSync(historyPath)) {
  try {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
  } catch (e) {
    history = [];
  }
}
const existingTitles = history.map(p => p.title).join(' | ');
console.log(`📊 현재까지 발행된 포스트 수: ${history.length}개`);

// 3. 토픽 풀 로드
const topicsPath = path.join(rootDir, 'data', 'topics_tesla.json');
const topicsData = JSON.parse(fs.readFileSync(topicsPath, 'utf-8'));

// 4. 실시간 Google News RSS 크롤링 (최신 테슬라 뉴스 헤드라인 수집)
async function fetchTeslaNews() {
  return new Promise((resolve) => {
    const feedUrl = 'https://news.google.com/rss/search?q=Tesla+OR+%ED%85%8C%EC%8A%AC%EB%9D%BC&hl=ko&gl=KR&ceid=KR:ko';
    https.get(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf-8');
        const titles = [];
        const matches = data.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>/g);
        for (const m of matches) {
          const cleanTitle = m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
          titles.push(cleanTitle);
          if (titles.length >= 10) break;
        }
        resolve(titles);
      });
    }).on('error', (err) => {
      console.warn('⚠️ RSS 수집 실패:', err.message);
      resolve([]);
    });
  });
}

// 명령행 인자에서 특정 카테고리 지정 가능 (예: --category=213)
const targetCategoryArg = process.argv.find(a => a.startsWith('--category='));
const targetCategoryId = targetCategoryArg ? parseInt(targetCategoryArg.split('=')[1], 10) : null;
if (targetCategoryId) {
  console.log(`🎯 지정된 타겟 카테고리 ID: ${targetCategoryId}`);
}

const liveNews = await fetchTeslaNews();
console.log(`📰 실시간 테슬라 뉴스 헤드라인 ${liveNews.length}건 수집 완료:`);
liveNews.slice(0, 3).forEach(n => console.log(`   - ${n}`));

// 오늘 날짜
const now = new Date();
const kstDate = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}).format(now);

const categoryHint = targetCategoryId 
  ? `[특별 지시]: 이번 칼럼은 반드시 카테고리 ID ${targetCategoryId} 에 해당하는 주제로 작성해야 합니다.`
  : `[특별 지시]: 5대 카테고리 중 아직 글이 적은 분야를 우선 선정하여 작성해주세요.`;

const prompt = `
당신은 전기차 및 모빌리티 혁신의 선두주자 테슬라(Tesla)를 심층 분석하는 전문 매거진 "테슬라 연대기 (Tesla Chronicles)"의 수석 자동차 전문 테크 에디터입니다.
Google AdSense 심사 기준(독창성, 유용성, 전문성, 구조적 완성도 E-E-A-T)을 100% 통과할 수 있는 초고품질의 심층 분석 칼럼 아티클을 1편 작성해주세요.

[오늘 날짜]: ${kstDate}

[실시간 테슬라 관련 최신 뉴스 헤드라인 (참고 및 소재 발굴용)]:
${liveNews.join('\n') || '최신 기가팩토리, FSD V13, 모델 Y 주니퍼, 사이버캡 로보택시 동향'}

[기획 주제 데이터베이스 풀]:
${JSON.stringify(topicsData.inDepthThemes, null, 2)}

[기존에 이미 발행된 칼럼 제목들 (절대 동일하거나 유사한 제목/주제 중복 금지)]:
${existingTitles || '없음 (첫 번째 칼럼)'}

[카테고리 매핑]:
- 1: 테슬라 최신 뉴스 (tesla-news)
- 212: FSD & 자율주행 (fsd-autonomous)
- 213: 모델별 심층 가이드 (model-guide)
- 214: 배터리 & 슈퍼차저 (battery-charging)
- 215: 로보택시 & 미래 비전 (robotaxi-ai)

${categoryHint}

[필수 작성 및 형식 규격]:
1. 본문은 이미지를 전혀 사용하지 않습니다. 이미지 없이도 독자가 몰입하고 구글 평가단이 감탄할 수 있도록 풍부한 텍스트 서식, 통계 수치, 체계적 비교표, 인포 박스를 활용해야 합니다.
2. 본문 분량: **순수 한국어 텍스트 기준 공백 제외 2,500자 이상 (충분히 깊이 있는 전문 칼럼)**
3. 본문 필수 HTML 서식 구조:
   - 시작 부분: 반드시 <div class="tesla-summary-box"><div class="tesla-summary-title">⚡ 테슬라 연대기 핵심 브리핑</div><ul><li>핵심 요약 1</li><li>핵심 요약 2</li><li>핵심 요약 3</li><li>핵심 요약 4</li></ul></div>
   - 대주제는 <h2>, 소주제는 <h3> 태그 사용 (절대 <h1> 태그 사용 금지)
   - 기술 스펙, 가격 비교, 세대별 차이점 또는 경쟁차종 비교는 반드시 <div class="tesla-table-wrapper"><table>...</table></div> 구조로 세련되게 정리
   - 중요 쟁점이나 기술적 변곡점에는 <div class="tesla-callout"><strong>💡 핵심 인사이트:</strong> ...</div> 박스 삽입
   - 본문 후반부에 반드시 FAQ 섹션 포함:
     <h2>자주 묻는 질문 (FAQ)</h2>
     독자들이 가장 궁금해할 실질적인 질문 3~4개를 선정하여:
     <div class="tesla-faq-item"><div class="tesla-faq-q">Q. ...</div><div class="tesla-faq-a">A. ...</div></div>
   - 마무리: 향후 전망 및 관전 포인트 (결론)
4. 응답은 반드시 아래 순수 JSON 형식만 반환하세요. JSON 코드 블록(\`\`\`json) 외에 어떠한 인사말도 덧붙이지 마세요.

{
  "title": "[테슬라 연대기] 매력적이고 전문적인 칼럼 제목 (클릭률과 신뢰도를 모두 잡는 35~55자)",
  "slug": "영문-소문자-하이픈으로-이루어진-슬러그 (예: tesla-fsd-v13-neural-network-analysis)",
  "category_id": 카테고리ID숫자(1, 212, 213, 214, 215 중 1개),
  "category_name": "해당 카테고리명",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "focus_keyword": "핵심 포커스 키워드",
  "meta_description": "검색엔진 노출용 요약 메타 디스크립션 (한글 120~150자)",
  "content_html": "본문 HTML 전체 (상기 명시된 모든 서식 포함, 이미지 태그 <img> 일체 금지)"
}
`;

console.log('🤖 Google Gemini AI 모델(gemini-3.8-flash)에 칼럼 생성 요청 중...');

// 6. Gemini API 호출 (검증된 고성능 Flash 모델 순차 Fallback)
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash'
];

async function callSingleGemini(modelName, promptText) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [{
      parts: [{ text: promptText }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: "application/json"
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          const json = JSON.parse(body);
          if (json.error) {
            reject(new Error(`[${modelName}] ${json.error.message || 'Gemini API Error'}`));
            return;
          }
          if (!json.candidates || !json.candidates[0]?.content?.parts?.[0]?.text) {
            reject(new Error(`[${modelName}] Invalid response structure`));
            return;
          }
          const text = json.candidates[0].content.parts[0].text;
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

async function callGeminiWithFallback(promptText) {
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🤖 [시도 ${attempt}/3] Gemini AI 모델(${model})에 생성 요청 중...`);
        const result = await callSingleGemini(model, promptText);
        return result;
      } catch (err) {
        lastError = err;
        console.warn(`   ⚠️ ${model} 시도 실패: ${err.message}`);
        // 짧은 대기 후 재시도
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastError;
}

try {
  const rawResponse = await callGeminiWithFallback(prompt);
  
  // JSON 파싱 (코드 블록 정리)
  let cleanJson = rawResponse.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.slice(7);
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.slice(3);
  }
  if (cleanJson.endsWith('```')) {
    cleanJson = cleanJson.slice(0, -3);
  }
  cleanJson = cleanJson.trim();

  // 최외곽 중괄호 매칭을 통한 안전한 JSON 추출
  function extractBalancedJson(text) {
    const firstBrace = text.indexOf('{');
    if (firstBrace === -1) throw new Error('No JSON object found');
    
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = firstBrace; i < text.length; i++) {
      const char = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            return text.substring(firstBrace, i + 1);
          }
        }
      }
    }
    // 매칭 실패 시 첫 번째 {부터 마지막 }까지
    const lastBrace = text.lastIndexOf('}');
    return text.substring(firstBrace, lastBrace + 1);
  }

  let article;
  try {
    const balancedJson = extractBalancedJson(cleanJson);
    article = JSON.parse(balancedJson);
  } catch (parseErr) {
    console.warn('⚠️ 표준 JSON.parse 실패, 정규식 추출기로 안전 복구 시도...');
    try {
      const titleMatch = cleanJson.match(/"title"\s*:\s*"([^"]+)"/);
      const slugMatch = cleanJson.match(/"slug"\s*:\s*"([^"]+)"/);
      const catIdMatch = cleanJson.match(/"category_id"\s*:\s*(\d+)/);
      const catNameMatch = cleanJson.match(/"category_name"\s*:\s*"([^"]+)"/);
      const focusMatch = cleanJson.match(/"focus_keyword"\s*:\s*"([^"]+)"/);
      const metaMatch = cleanJson.match(/"meta_description"\s*:\s*"([^"]+)"/);
      
      // content_html은 "content_html"\s*:\s*" 부터 뒤쪽의 "\s*} 까지 매칭
      const contentMatch = cleanJson.match(/"content_html"\s*:\s*"([\s\S]*?)"\s*\}/);

      if (titleMatch && slugMatch && contentMatch) {
        article = {
          title: titleMatch[1],
          slug: slugMatch[1],
          category_id: catIdMatch ? parseInt(catIdMatch[1], 10) : 1,
          category_name: catNameMatch ? catNameMatch[1] : '테슬라 최신 뉴스',
          tags: ["테슬라", "전기차", "자율주행", "모빌리티"],
          focus_keyword: focusMatch ? focusMatch[1] : '테슬라',
          meta_description: metaMatch ? metaMatch[1] : '',
          content_html: contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
        };
        console.log('✅ 정규식 기반 안전 복구 성공!');
      } else {
        throw new Error('정규식 추출 실패');
      }
    } catch (fallbackErr) {
      fs.writeFileSync(path.join(rootDir, 'debug_raw_gemini.txt'), cleanJson, 'utf-8');
      console.error('⚠️ JSON 파싱 및 복구 실패:', parseErr.message);
      throw parseErr;
    }
  }
  article.created_at = new Date().toISOString();
  article.date_formatted = kstDate;

  // 자동 목차(TOC) 생성 및 앵커 태그 주입
  function injectTableOfContents(html) {
    let headingIndex = 0;
    const tocItems = [];

    const modifiedHtml = html.replace(/<(h[23])([^>]*)>(.*?)<\/\1>/gi, (match, tag, attrs, text) => {
      headingIndex++;
      const cleanText = text.replace(/<[^>]+>/g, '').trim();
      const anchorId = `toc-heading-${headingIndex}`;
      const levelClass = tag.toLowerCase() === 'h3' ? 'toc-h3' : 'toc-h2';
      tocItems.push(`<li class="${levelClass}"><a href="#${anchorId}">${cleanText}</a></li>`);
      return `<${tag}${attrs} id="${anchorId}">${text}</${tag}>`;
    });

    if (tocItems.length < 2) {
      return html;
    }

    const tocBox = `
<div class="tesla-toc-box">
  <div class="tesla-toc-title">📑 목차 (Table of Contents)</div>
  <ul class="tesla-toc-list">
    ${tocItems.join('\n    ')}
  </ul>
</div>`;

    if (modifiedHtml.includes('</div>')) {
      const summaryEnd = modifiedHtml.indexOf('</div>');
      return modifiedHtml.slice(0, summaryEnd + 6) + '\n' + tocBox + '\n' + modifiedHtml.slice(summaryEnd + 6);
    }
    return tocBox + '\n' + modifiedHtml;
  }

  // 목차 주입 적용
  article.content_html = injectTableOfContents(article.content_html);

  console.log(`\n✅ 칼럼 생성 완료!`);
  console.log(`📌 제목: ${article.title}`);
  console.log(`📁 카테고리: [${article.category_id}] ${article.category_name}`);
  console.log(`🔗 슬러그: ${article.slug}`);
  console.log(`🎯 포커스 키워드: ${article.focus_keyword}`);
  console.log(`📝 본문 길이: 약 ${article.content_html.length}자 (HTML 포함)`);

  // posts 디렉토리 저장
  const postsDir = path.join(rootDir, 'posts');
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }

  const postMdPath = path.join(postsDir, `${article.slug}.md`);
  const mdContent = `---
title: "${article.title.replace(/"/g, '\\"')}"
date: "${article.created_at}"
category: "${article.category_name}"
category_id: ${article.category_id}
slug: "${article.slug}"
tags: ${JSON.stringify(article.tags)}
focus_keyword: "${article.focus_keyword}"
meta_description: "${article.meta_description.replace(/"/g, '\\"')}"
---

${article.content_html}
`;
  fs.writeFileSync(postMdPath, mdContent, 'utf-8');
  console.log(`💾 마크다운 저장: ${postMdPath}`);

  // 배포용 pending json 저장
  const pendingPath = path.join(rootDir, 'data', 'latest_pending_post.json');
  fs.writeFileSync(pendingPath, JSON.stringify(article, null, 2), 'utf-8');
  console.log(`🚀 배포 대기 파일 저장 완료: ${pendingPath}`);

} catch (err) {
  console.error('❌ 포스트 생성 실패:', err);
  process.exit(1);
}
