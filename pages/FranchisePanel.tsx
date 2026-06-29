import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '@/types';
import RevenueManagement from './RevenueManagement';
import { supabase } from '../supabase';

type FranchiseTab = 'members' | 'revenue' | 'manuscripts' | 'convert' | 'collector';

interface Props {
  user: UserProfile;
  members: UserProfile[];
  onUpdateUser?: (u: UserProfile) => void;
}

/* ══════════════════════════════════════════════
   원고시트 — SNS 수집 시트 (iframe 임베드)
══════════════════════════════════════════════ */
const ManuscriptSheet: React.FC<{ userId: string }> = ({ userId }) => {
  const src = `/sheet.html?userId=${encodeURIComponent(userId)}`;
  return (
    <iframe
      src={src}
      style={{ width: '100%', height: 'calc(100vh - 120px)', border: 'none', display: 'block' }}
      title="원고시트"
      allow="clipboard-read; clipboard-write"
    />
  );
};

/* ══════════════════════════════════════════════
   원고시트변환
══════════════════════════════════════════════ */
function convertManuscript(input: string, platform: string): string {
  const lines = input.trim().split('\n');
  const hashLines = lines.filter(l => l.trim().startsWith('#'));
  const bodyLines = lines.filter(l => !l.trim().startsWith('#'));
  const body = bodyLines.join('\n'), tags = hashLines.join(' ');
  switch (platform) {
    case '인스타그램': return body.split(/\n{2,}/).filter(Boolean).map(p => p.trim()).join('\n.\n') + (tags ? `\n.\n\n${tags}` : '');
    case '카카오채널': return body.replace(/\n{3,}/g, '\n\n').trim();
    case '네이버블로그': return body.split(/\n{2,}/).filter(Boolean).map(p => p.trim()).join('\n\n');
    case '유튜브': return `📌 영상 설명\n\n${body.trim()}${tags ? `\n\n${tags}` : ''}`;
    default: return input;
  }
}
const PLATFORM_TIPS: Record<string, string> = {
  '인스타그램': '단락 사이에 마침표(.) 줄 추가 · 해시태그 하단 분리',
  '카카오채널': '3줄 이상 공백 → 2줄로 정리',
  '네이버블로그': '단락 간 2줄 공백으로 정리',
  '유튜브': '영상 설명 헤더 · 해시태그 섹션 자동 추가',
};
const ConvertTab: React.FC = () => {
  const [platform, setPlatform] = useState('인스타그램');
  const [input, setInput]       = useState('');
  const [output, setOutput]     = useState('');
  const [copied, setCopied]     = useState(false);
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-black text-gray-900">원고시트변환</h2>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setOutput(''); }}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 bg-white">
          {['인스타그램','카카오채널','네이버블로그','유튜브'].map(p => <option key={p}>{p}</option>)}
        </select>
        <span className="text-xs text-gray-400 font-bold">{PLATFORM_TIPS[platform]}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase mb-2">원본 내용</label>
          <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={'원고 내용을 붙여넣으세요...\n#해시태그는 # 로 시작하는 줄에 입력'}
            className="w-full h-72 px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-blue-400 resize-none" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-black text-gray-400 uppercase">{platform} 변환 결과</label>
            {output && <button type="button" onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className={`text-xs font-black ${copied ? 'text-emerald-500' : 'text-blue-600 hover:text-blue-700'}`}>{copied ? '✓ 복사됨' : '복사'}</button>}
          </div>
          <textarea value={output} readOnly placeholder="변환 버튼을 누르면 결과가 표시됩니다..."
            className="w-full h-72 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-sm font-medium resize-none focus:outline-none" />
        </div>
      </div>
      <button type="button" onClick={() => setOutput(convertManuscript(input, platform))} disabled={!input.trim()}
        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        🔄 변환하기
      </button>
    </div>
  );
};

/* ══════════════════════════════════════════════
   원고수집기 — 네이버 카페 크롤러
══════════════════════════════════════════════ */
interface CafeArticle {
  no: number;
  articleId: string | number;
  title: string;
  content: string;
  writer: string;
  date: string;
  commentCount: number;
  readCount: number;
  url: string;
  comments: { content: string; writer: string; date: string }[];
}

interface CrawlHistoryEntry {
  id: string;
  collectedAt: string;
  cafeUrl: string;
  startDate: string;
  endDate: string;
  count: number;
  filename: string;
}

interface ReplaceKw { from: string; to: string; }

type CrawlerTab = 'collect' | 'replace' | 'history';

function parseCafeId(input: string): string {
  try {
    const u = new URL(input.includes('://') ? input : `https://${input}`);
    const club = u.searchParams.get('clubid');
    if (club) return club;
    if (/^\d+$/.test(input.trim())) return input.trim();
    return '';
  } catch {
    return /^\d+$/.test(input.trim()) ? input.trim() : '';
  }
}

function buildNaverCookie(aut: string, ses: string): string {
  const parts: string[] = [];
  const a = aut.trim();
  const s = ses.trim();
  if (a) parts.push(a.startsWith('NID_AUT=') ? a : `NID_AUT=${a}`);
  if (s) parts.push(s.startsWith('NID_SES=') ? s : `NID_SES=${s}`);
  return parts.join('; ');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

const EMPTY_KW: ReplaceKw[] = Array.from({ length: 10 }, () => ({ from: '', to: '' }));
const DEFAULT_REWRITE_PROMPT = '원문을 완전히 다른 사람이 쓴 글처럼 리라이팅해줘.\n실제 사람이 쓰듯 ^^,ㅎㅎ,ㄹㄹ,~~,!!,... 이런식으로 1~2개 자연스럽게 적절히 섞어서 써줘.';
const DEFAULT_COMMENT_PROMPT = '아래 글에 어울리는 자연스러운 댓글을 1개만 만들어줘.\n실제 사람이 쓰듯 ^^,ㅎㅎ,ㄹㄹ,~~,!!,... 이런식으로 1~2개 자연스럽게 적절히 섞어서 써줘.';

const RELAY_URL = 'http://localhost:3333';

async function checkRelay(): Promise<boolean> {
  try {
    const res = await fetch(`${RELAY_URL}/ping`, { signal: AbortSignal.timeout(1000) });
    const j = await res.json();
    return j?.ok === true;
  } catch { return false; }
}

const CollectorTab: React.FC = () => {
  const [crawlerTab, setCrawlerTab] = useState<CrawlerTab>('collect');
  const [relayOk, setRelayOk] = useState<boolean | null>(null);

  useEffect(() => {
    checkRelay().then(setRelayOk);
    const t = setInterval(() => checkRelay().then(setRelayOk), 5000);
    return () => clearInterval(t);
  }, []);

  /* ── 수집 설정 ── */
  const [cafeUrl,       setCafeUrl]       = useState('https://cafe.naver.com/');
  const [cafeId,        setCafeId]        = useState('');
  const [menuId,        setMenuId]        = useState('');
  const [startPage,     setStartPage]     = useState('1');
  const [startDate,     setStartDate]     = useState('');
  const [endDate,       setEndDate]       = useState('');
  const [maxArticles,   setMaxArticles]   = useState('50');
  const [maxComments,   setMaxComments]   = useState('3');
  const [aiRewrite,     setAiRewrite]     = useState(false);
  const [aiFillComment, setAiFillComment] = useState(false);
  const [naverCookie,   setNaverCookie]   = useState('');
  const [naverSes,      setNaverSes]      = useState('');
  const [showCookie,    setShowCookie]    = useState(false);

  /* ── 수집 상태 ── */
  const [loading,  setLoading]  = useState(false);
  const stopRef = useRef(false);
  const [status,   setStatus]   = useState('대기 중...');
  const [nextPage, setNextPage] = useState<number | null>(null);

  /* ── 결과 ── */
  const [articles, setArticles] = useState<CafeArticle[]>(() => {
    try { const s = localStorage.getItem('cafe_crawl_articles'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastInfo, setLastInfo] = useState<{ writer: string; date: string; page: number; savedAt: string } | null>(() => {
    try { const s = localStorage.getItem('cafe_crawl_lastinfo'); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  /* ── 치환 키워드 ── */
  const [openaiKey,       setOpenaiKey]       = useState(() => localStorage.getItem('crawl_openai_key') || '');
  const [showKey,         setShowKey]         = useState(false);
  const [testTitle,       setTestTitle]       = useState('코타키나발루 맛집 추천해주세요');
  const [rewritePrompt,   setRewritePrompt]   = useState(() => localStorage.getItem('crawl_rewrite_prompt') || DEFAULT_REWRITE_PROMPT);
  const [commentPrompt,   setCommentPrompt]   = useState(() => localStorage.getItem('crawl_comment_prompt') || DEFAULT_COMMENT_PROMPT);
  const [keywords,        setKeywords]        = useState<ReplaceKw[]>(() => {
    try { const s = localStorage.getItem('crawl_keywords'); return s ? JSON.parse(s) : EMPTY_KW; } catch { return EMPTY_KW; }
  });
  const [rewriteLoading,  setRewriteLoading]  = useState(false);
  const [rewriteResult,   setRewriteResult]   = useState('');

  /* ── 수집 이력 ── */
  const [history, setHistory] = useState<CrawlHistoryEntry[]>(() => {
    try { const s = localStorage.getItem('cafe_crawl_history'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  /* ── helpers ── */
  const saveArticles = (list: CafeArticle[]) => {
    setArticles(list);
    try { localStorage.setItem('cafe_crawl_articles', JSON.stringify(list)); } catch {}
  };
  const saveLastInfo = (info: typeof lastInfo) => {
    setLastInfo(info);
    try { localStorage.setItem('cafe_crawl_lastinfo', JSON.stringify(info)); } catch {}
  };
  const saveHistory = (list: CrawlHistoryEntry[]) => {
    setHistory(list);
    try { localStorage.setItem('cafe_crawl_history', JSON.stringify(list)); } catch {}
  };
  const saveKeywords = (kws: ReplaceKw[]) => {
    setKeywords(kws);
    try { localStorage.setItem('crawl_keywords', JSON.stringify(kws)); } catch {}
  };

  const resolvedCafeId = cafeId.trim() || parseCafeId(cafeUrl);

  /* ── 수집 ── */
  const doCollect = async (resume: boolean) => {
    if (!resolvedCafeId) { setStatus('카페 ID를 입력해주세요.'); return; }
    stopRef.current = false;
    setLoading(true);
    const page = resume && nextPage ? nextPage : parseInt(startPage) || 1;
    setStatus(`수집 중... (페이지 ${page})`);
    try {
      const live = relayOk ?? await checkRelay();
      setRelayOk(live);
      const endpoint = live
        ? `${RELAY_URL}/scrape-naver-cafe`
        : '/.netlify/functions/scrape-naver-cafe';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeId: resolvedCafeId,
          cafeUrl: cafeUrl.trim(),
          menuId: menuId.trim(),
          startPage: page,
          startDate: startDate.trim() || undefined,
          endDate: endDate.trim() || todayStr(),
          maxArticles: parseInt(maxArticles) || 10,
          maxComments: parseInt(maxComments) || 0,
          fetchComments: parseInt(maxComments) > 0,
          naverCookie: buildNaverCookie(naverCookie, naverSes) || undefined,
        }),
      });
      const data = await res.json();
      if (data.status !== 'ok') {
        const msg = data.message || '수집 실패';
        const hint = data.hint ? `\n💡 ${data.hint}` : '';
        throw new Error(msg + hint);
      }
      // API 성공이지만 날짜 필터로 0개인 경우 (status=ok, articles=[])
      if (data.articles?.length === 0 && data.message) {
        setStatus(`ℹ️ ${data.message}`);
        setLoading(false);
        return;
      }
      const newList: CafeArticle[] = data.articles || [];
      const merged = resume
        ? [...articles, ...newList.map((a, i) => ({ ...a, no: articles.length + i + 1 }))]
        : newList;
      saveArticles(merged);
      setNextPage(data.nextPage || null);
      if (newList.length > 0) {
        const last = newList[newList.length - 1];
        saveLastInfo({ writer: last.writer, date: last.date, page: data.nextPage || page, savedAt: new Date().toLocaleString('ko-KR') });
      }
      setStatus(`수집 완료 — ${merged.length}개 글`);
    } catch (e: unknown) {
      setStatus(`오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const stop = () => { stopRef.current = true; setLoading(false); setStatus('중지됨'); };

  const toggleSelect = (no: number) => setSelected(prev => {
    const next = new Set(prev); next.has(no) ? next.delete(no) : next.add(no); return next;
  });
  const toggleAll = () => {
    if (selected.size === articles.length) setSelected(new Set());
    else setSelected(new Set(articles.map(a => a.no)));
  };
  const deleteSelected = () => {
    saveArticles(articles.filter(a => !selected.has(a.no)).map((a, i) => ({ ...a, no: i + 1 })));
    setSelected(new Set());
  };

  const applyKeywords = (text: string) => {
    let result = text;
    keywords.forEach(kw => { if (kw.from.trim()) result = result.split(kw.from).join(kw.to); });
    return result;
  };

  const exportCsv = (rewritten = false) => {
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const cell = (v: string, mergeDown = 0, bg = '') =>
      `<Cell${mergeDown ? ` ss:MergeDown="${mergeDown}"` : ''}${bg ? ` ss:StyleID="${bg}"` : ''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;

    const headerRow = `<Row>
      ${cell('리라이팅',0,'hdr')}${cell('구분',0,'hdr')}${cell('원본',0,'hdr')}${cell('댓글1',0,'hdr')}${cell('댓글2',0,'hdr')}${cell('댓글3',0,'hdr')}${cell('날짜',0,'hdr')}${cell('URL',0,'hdr')}
    </Row>`;

    const articleRows = articles.map(a => {
      const title = rewritten ? applyKeywords(a.title) : a.title;
      const c1 = a.comments[0]?.content ?? '';
      const c2 = a.comments[1]?.content ?? '';
      const c3 = a.comments[2]?.content ?? '';
      // 제목 행: 리라이팅 열은 MergeDown=1 로 2행 병합
      const row1 = `<Row>${cell('',1)}${cell('제목:')}${cell(title)}${cell(c1)}${cell(c2)}${cell(c3)}${cell(a.date)}${cell(a.url)}</Row>`;
      // 내용 행: 실제 본문 내용 삽입
      const bodyText = rewritten ? applyKeywords(a.content ?? '') : (a.content ?? '');
      const row2 = `<Row><Cell ss:Index="2"/>${cell('내용:')}${cell(bodyText)}${cell('')}${cell('')}${cell('')}${cell('')}${cell('')}</Row>`;
      // 구분 빈 행 (ss:Height로 높이 지정해야 Excel이 빈 행으로 인식)
      const row3 = `<Row ss:Height="14"><Cell ss:Index="1"><Data ss:Type="String"> </Data></Cell></Row>`;
      return row1 + '\n' + row2 + '\n' + row3;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
 <Styles>
  <Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#4472C4" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="수집결과">
  <Table ss:DefaultColumnWidth="120">
   <Column ss:Width="200"/>
   <Column ss:Width="50"/>
   <Column ss:Width="300"/>
   <Column ss:Width="180"/>
   <Column ss:Width="180"/>
   <Column ss:Width="180"/>
   <Column ss:Width="90"/>
   <Column ss:Width="250"/>
   ${headerRow}
   ${articleRows}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `cafe_posts_${todayStr().replace(/\./g, '')}_${new Date().toTimeString().slice(0,5).replace(':','')}.xls`;
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    const entry: CrawlHistoryEntry = {
      id: Date.now().toString(),
      collectedAt: new Date().toLocaleString('ko-KR'),
      cafeUrl: cafeUrl.trim(),
      startDate: startDate.trim() || '-',
      endDate: endDate.trim() || todayStr(),
      count: articles.length,
      filename,
    };
    saveHistory([entry, ...history]);
  };

  /* ── 리라이팅 테스트 ── */
  const testRewrite = async () => {
    if (!openaiKey.trim()) { alert('OpenAI API 키를 먼저 입력해주세요.'); return; }
    setRewriteLoading(true);
    setRewriteResult('');
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey.trim()}` },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: `${rewritePrompt}\n\n제목: ${testTitle}` }],
          max_tokens: 500,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setRewriteResult(data.choices?.[0]?.message?.content || '');
    } catch (e: unknown) {
      setRewriteResult(`오류: ${e instanceof Error ? e.message : '실패'}`);
    } finally {
      setRewriteLoading(false);
    }
  };

  const openNaverLogin = () => {
    const popup = window.open('https://nid.naver.com/nidlogin.login', 'naver_login', 'width=500,height=600,scrollbars=yes');
    if (!popup) alert('팝업이 차단되었습니다. 브라우저에서 팝업 허용 후 다시 시도해주세요.');
  };

  const inputCls = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400 bg-white';

  const CrawlerTabBtn: React.FC<{ id: CrawlerTab; label: string }> = ({ id, label }) => (
    <button type="button" onClick={() => setCrawlerTab(id)}
      className={`px-4 py-2 text-xs font-black border-b-2 transition-all whitespace-nowrap ${crawlerTab === id ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 bg-gray-50'}`}>
      {label}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* ── 내부 탭 ── */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <CrawlerTabBtn id="collect" label="글 수집" />
        <CrawlerTabBtn id="replace" label="치환 키워드" />
        <CrawlerTabBtn id="history" label="수집 이력" />
      </div>

      {/* ════ 글 수집 탭 ════ */}
      {crawlerTab === 'collect' && (
        <div className="flex">
          {/* 왼쪽 설정 — 스크롤 없이 전체 표시 */}
          <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-black text-gray-500 mb-3">설정</p>

            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-0.5">카페 URL:</label>
              <input className={inputCls} value={cafeUrl} onChange={e => setCafeUrl(e.target.value)} placeholder="https://cafe.naver.com/..." autoComplete="off" />
            </div>
            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-0.5">카페 ID:</label>
              <input className={inputCls} value={cafeId} onChange={e => setCafeId(e.target.value)} placeholder="31559350" autoComplete="off" />
              {!cafeId.trim() && resolvedCafeId && <p className="text-[10px] text-blue-500 mt-0.5">자동감지: {resolvedCafeId}</p>}
            </div>
            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-0.5">카테고리 ID (전체글이면 비워두세요):</label>
              <input className={inputCls} value={menuId} onChange={e => setMenuId(e.target.value)} placeholder="121" autoComplete="off" />
            </div>
            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-0.5">시작 페이지 번호:</label>
              <input className={inputCls} type="number" min="1" value={startPage} onChange={e => setStartPage(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-0.5">시작일 (YYYY.MM.DD):</label>
              <input className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="2025.06.01" autoComplete="off" spellCheck={false} />
            </div>
            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-0.5">종료일 (YYYY.MM.DD, 비우면 오늘):</label>
              <input className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} placeholder={todayStr()} autoComplete="off" spellCheck={false} />
            </div>
            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-0.5">최대 수집 글 수:</label>
              <input className={inputCls} type="number" min="1" value={maxArticles} onChange={e => setMaxArticles(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-0.5">댓글 수집 개수 (0~5):</label>
              <input className={inputCls} type="number" min="0" max="5" value={maxComments} onChange={e => setMaxComments(e.target.value)} />
            </div>

            {/* AI 설정 */}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-black text-gray-500 mb-1.5">■ AI 설정</p>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1 cursor-pointer">
                <input type="checkbox" checked={aiRewrite} onChange={e => setAiRewrite(e.target.checked)} />
                AI 리라이팅 적용 (제목+내용)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1 cursor-pointer">
                <input type="checkbox" checked={aiFillComment} onChange={e => setAiFillComment(e.target.checked)} />
                댓글 부족 시 AI 댓글로 채우기
              </label>
              <p className="text-[10px] text-gray-400">※ API 키·프롬프트는 치환키워드 탭에서</p>
            </div>

            {/* 네이버 쿠키 인증 — 필수 */}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-black text-red-500 mb-1">⚠ 쿠키 인증 필요 (2개 모두)</p>
              <p className="text-[10px] text-gray-500 mb-1.5 leading-relaxed">
                ① <button type="button" onClick={openNaverLogin} className="text-blue-500 underline font-bold">네이버 로그인 팝업</button> 으로 로그인<br/>
                ② F12 → Application → Cookies → cafe.naver.com<br/>
                ③ NID_AUT <b>와</b> NID_SES 값 <b>둘 다</b> 복사
              </p>
              <label className="block text-[10px] font-bold text-gray-500 mb-0.5">NID_AUT:</label>
              <input className={inputCls} value={naverCookie} onChange={e => setNaverCookie(e.target.value)}
                placeholder="값만 붙여넣기 (NID_AUT= 제외 가능)" autoComplete="off"
                style={{ borderColor: naverCookie.trim() ? '#22c55e' : '#fca5a5' }} />
              <label className="block text-[10px] font-bold text-gray-500 mt-1.5 mb-0.5">NID_SES:</label>
              <input className={inputCls} value={naverSes} onChange={e => setNaverSes(e.target.value)}
                placeholder="값만 붙여넣기 (NID_SES= 제외 가능)" autoComplete="off"
                style={{ borderColor: naverSes.trim() ? '#22c55e' : '#fca5a5' }} />
              {naverCookie.trim() && naverSes.trim()
                ? <p className="text-[10px] text-green-600 font-bold mt-0.5">✓ 쿠키 2개 입력됨 — 수집 가능</p>
                : <p className="text-[10px] text-orange-500 font-bold mt-0.5">NID_AUT, NID_SES 모두 입력해야 수집됩니다</p>
              }
            </div>

            {/* 마지막 수집 정보 */}
            {lastInfo && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-[11px] text-blue-600 font-bold leading-relaxed">
                  마지막 수집:<br />{lastInfo.writer}...<br />
                  날짜: {lastInfo.date}<br />
                  페이지: {lastInfo.page}<br />
                  저장: {lastInfo.savedAt}
                </p>
              </div>
            )}

            {/* 릴레이 상태 */}
            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-bold mb-2 ${relayOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                <span>{relayOk ? '🟢' : '🔴'}</span>
                {relayOk
                  ? '로컬 릴레이 연결됨 — 한국 IP로 수집'
                  : relayOk === null
                    ? '릴레이 확인 중...'
                    : <span>로컬 릴레이 꺼져 있음 — <span className="underline cursor-pointer" onClick={() => { navigator.clipboard?.writeText('node local-relay.js'); }}>PC에서 node local-relay.js 실행 필요</span></span>
                }
              </div>
            </div>

            {/* 버튼들 */}
            <div className="space-y-1.5">
              <button type="button" onClick={() => doCollect(false)} disabled={loading}
                className="w-full py-2 rounded font-black text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? '수집 중...' : '▶ 수집 시작'}
              </button>
              <button type="button" onClick={() => doCollect(true)} disabled={loading || !nextPage}
                className="w-full py-2 rounded font-black text-sm text-white bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed">
                ▶ 이어서 수집
              </button>
              <button type="button" onClick={stop} disabled={!loading}
                className="w-full py-2 rounded font-black text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed">
                ■ 중지
              </button>
              <button type="button" onClick={deleteSelected} disabled={selected.size === 0}
                className="w-full py-2 rounded font-black text-sm text-white bg-orange-400 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed">
                × 선택글 삭제
              </button>
              <button type="button" onClick={() => window.open('https://sheets.new', '_blank')}
                className="w-full py-2 rounded font-black text-sm text-white bg-blue-500 hover:bg-blue-600">
                구글 시트로 열기
              </button>
              <button type="button" onClick={() => exportCsv(false)} disabled={articles.length === 0}
                className="w-full py-2 rounded font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
                💾 CSV 저장 (원문만)
              </button>
              <button type="button" onClick={() => exportCsv(true)} disabled={articles.length === 0}
                className="w-full py-2 rounded font-black text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed">
                🤖 리라이팅 후 저장
              </button>
            </div>
          </div>

          {/* 오른쪽 결과 */}
          <div className="flex-1 flex flex-col min-h-[600px]">
            <div className="px-3 py-2 border-b border-gray-200 bg-white shrink-0">
              <p className="text-xs text-gray-500 font-bold">수집 결과 (✓ 열 클릭 → 선택 후 삭제)</p>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th className="w-8 border border-gray-200 px-2 py-2 text-center cursor-pointer select-none hover:bg-gray-100" onClick={toggleAll}>✓</th>
                    <th className="w-12 border border-gray-200 px-2 py-2 text-center font-black text-gray-500">번호</th>
                    <th className="w-24 border border-gray-200 px-2 py-2 text-center font-black text-gray-500">날짜</th>
                    <th className="border border-gray-200 px-2 py-2 text-left font-black text-gray-500">제목</th>
                    <th className="w-16 border border-gray-200 px-2 py-2 text-center font-black text-gray-500">댓글수</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-bold">수집된 글이 없습니다</td></tr>
                  ) : articles.map(a => (
                    <tr key={a.no} className={`hover:bg-blue-50 transition-colors ${selected.has(a.no) ? 'bg-blue-50' : ''}`}>
                      <td className="border border-gray-100 px-2 py-1.5 text-center cursor-pointer" onClick={() => toggleSelect(a.no)}>
                        {selected.has(a.no) ? <span className="text-blue-600 font-black">✓</span> : ''}
                      </td>
                      <td className="border border-gray-100 px-2 py-1.5 text-center text-gray-400">{a.no}</td>
                      <td className="border border-gray-100 px-2 py-1.5 text-center text-gray-500 whitespace-nowrap">{a.date}</td>
                      <td className="border border-gray-100 px-2 py-1.5">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-blue-600 hover:underline">{a.title}</a>
                        {a.comments.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {a.comments.map((c, i) => (
                              <p key={i} className="text-[10px] text-gray-400 pl-2 border-l-2 border-gray-200">{c.writer}: {c.content}</p>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="border border-gray-100 px-2 py-1.5 text-center text-gray-500">{a.commentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-1.5 border-t border-gray-200 bg-gray-50 shrink-0">
              <p className="text-xs font-bold" style={{ color: status.startsWith('오류') ? '#ef4444' : '#9ca3af' }}>{status}</p>
            </div>
          </div>
        </div>
      )}

      {/* ════ 치환 키워드 탭 ════ */}
      {crawlerTab === 'replace' && (
        <div className="p-4 space-y-5 max-w-2xl">
          {/* AI 설정 */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <p className="text-xs font-black text-gray-600 mb-2">■ AI 설정 (API 키 · 프롬프트)</p>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs font-bold text-gray-600 whitespace-nowrap">OpenAI API 키:</label>
              <input
                type={showKey ? 'text' : 'password'}
                value={openaiKey}
                onChange={e => { setOpenaiKey(e.target.value); localStorage.setItem('crawl_openai_key', e.target.value); }}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400 bg-white"
                placeholder="sk-..."
                autoComplete="off"
              />
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={showKey} onChange={e => setShowKey(e.target.checked)} />
                키 보기
              </label>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs font-bold text-gray-600 whitespace-nowrap">테스트 제목:</label>
              <input
                value={testTitle}
                onChange={e => setTestTitle(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400 bg-white"
              />
              <button type="button" onClick={testRewrite} disabled={rewriteLoading}
                className="px-3 py-1 rounded text-xs font-black text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 whitespace-nowrap">
                {rewriteLoading ? '테스트 중...' : '리라이팅 테스트'}
              </button>
            </div>
            {rewriteResult && (
              <div className="bg-white border border-gray-200 rounded p-2 text-xs text-gray-700 whitespace-pre-wrap mb-2">{rewriteResult}</div>
            )}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-600 mb-1">리라이팅 프롬프트 (제목+내용):</label>
              <textarea
                value={rewritePrompt}
                onChange={e => { setRewritePrompt(e.target.value); localStorage.setItem('crawl_rewrite_prompt', e.target.value); }}
                rows={4}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400 bg-white resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">AI 댓글 프롬프트 (댓글 부족 시 생성):</label>
              <textarea
                value={commentPrompt}
                onChange={e => { setCommentPrompt(e.target.value); localStorage.setItem('crawl_comment_prompt', e.target.value); }}
                rows={4}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400 bg-white resize-none"
              />
            </div>
          </div>

          {/* 치환 키워드 */}
          <div>
            <p className="text-xs font-black text-gray-600 mb-1">치환 키워드 설정 (제목/본문/댓글에서 자동 교체)</p>
            <p className="text-[11px] text-gray-400 mb-1">※ 원본 단어를 수정 단어로 자동 교체해서 CSV 저장합니다.</p>
            <p className="text-[11px] text-blue-500 mb-3">예) 원본: 하말 → 수정: 키나발루</p>
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_24px_1fr] gap-2 text-[11px] font-black text-gray-400 px-1 mb-1">
                <span>원본 단어</span><span></span><span>수정 단어</span>
              </div>
              {keywords.map((kw, i) => (
                <div key={i} className="grid grid-cols-[1fr_24px_1fr] gap-2 items-center">
                  <input value={kw.from} onChange={e => { const next = [...keywords]; next[i] = { ...next[i], from: e.target.value }; saveKeywords(next); }}
                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400 bg-white" autoComplete="off" />
                  <span className="text-center text-gray-400 font-bold text-sm">→</span>
                  <input value={kw.to} onChange={e => { const next = [...keywords]; next[i] = { ...next[i], to: e.target.value }; saveKeywords(next); }}
                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-400 bg-white" autoComplete="off" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => saveKeywords(EMPTY_KW)}
                className="px-6 py-1.5 rounded border border-gray-300 text-xs font-black text-gray-600 hover:bg-gray-100">
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ 수집 이력 탭 ════ */}
      {crawlerTab === 'history' && (
        <div className="p-0">
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-black text-gray-500">수집 이력</p>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {['수집일시', '카페URL', '시작일', '종료일', '수집글수', '파일'].map(h => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left font-black text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-300 font-bold">수집 이력이 없습니다</td></tr>
                ) : history.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-100 px-3 py-2 text-gray-600 whitespace-nowrap">{h.collectedAt}</td>
                    <td className="border border-gray-100 px-3 py-2 text-blue-500 max-w-[180px] truncate">
                      <span title={h.cafeUrl}>{h.cafeUrl}</span>
                    </td>
                    <td className="border border-gray-100 px-3 py-2 text-gray-500 whitespace-nowrap">{h.startDate}</td>
                    <td className="border border-gray-100 px-3 py-2 text-gray-500 whitespace-nowrap">{h.endDate}</td>
                    <td className="border border-gray-100 px-3 py-2 text-center text-gray-700 font-bold">{h.count}</td>
                    <td className="border border-gray-100 px-3 py-2 text-gray-500">{h.filename}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100">
              <button type="button" onClick={() => saveHistory([])} className="text-xs text-red-400 hover:text-red-600 font-bold">이력 전체 삭제</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   가맹점 현황 (어드민)
══════════════════════════════════════════════ */
const MembersTab: React.FC<{ members: UserProfile[]; onUpdateUser?: (u: UserProfile) => void }> = ({ members, onUpdateUser }) => {
  const [search, setSearch]       = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState(members);
  useEffect(() => { setLocalMembers(members); }, [members]);

  const toggleFranchise = async (member: UserProfile) => {
    setTogglingId(member.id);
    try {
      const newVal = !member.isFranchise;
      const { error } = await supabase.from('profiles').update({ is_franchise: newVal, updated_at: new Date().toISOString() }).eq('id', member.id);
      if (!error) {
        const updated = { ...member, isFranchise: newVal };
        setLocalMembers(prev => prev.map(m => m.id === member.id ? updated : m));
        if (onUpdateUser) onUpdateUser(updated);
      }
    } finally { setTogglingId(null); }
  };

  const franchiseMembers = localMembers.filter(m => m.isFranchise);
  const visible = localMembers.filter(m => !search || m.nickname.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">가맹점 파트너 관리</h2>
          <p className="text-xs text-gray-400 font-bold mt-0.5">현재 {franchiseMembers.length}개 가맹점 활성 · 가맹점으로 선택된 회원은 가맹점패널에 접근할 수 있습니다</p>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임·ID 검색..."
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 w-48" />
      </div>
      {franchiseMembers.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-black text-blue-700 mb-2">✓ 활성 가맹점</p>
          <div className="flex flex-wrap gap-2">
            {franchiseMembers.map(m => (
              <div key={m.id} className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-full px-3 py-1">
                <img src={m.profileImage} alt="" className="w-4 h-4 rounded-full object-cover" />
                <span className="text-xs font-black text-blue-800">{m.nickname}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['회원','ID','이메일','등급','가맹점 여부'].map(h => <th key={h} className="px-4 py-3 text-left font-black text-gray-400 uppercase whitespace-nowrap text-[11px]">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.slice(0, 100).map(member => (
                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><img src={member.profileImage} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-100 shrink-0" /><span className="font-black text-gray-900 whitespace-nowrap">{member.nickname}</span></div></td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{member.id}</td>
                  <td className="px-4 py-3 text-gray-500">{member.email || '-'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : member.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{member.role}</span></td>
                  <td className="px-4 py-3"><button type="button" disabled={togglingId === member.id || member.role === 'admin'} onClick={() => toggleFranchise(member)}
                    className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all disabled:opacity-40 ${member.isFranchise ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    {togglingId === member.id ? '...' : member.isFranchise ? '✓ 가맹점' : '가맹점 선택'}
                  </button></td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-gray-300 font-bold">검색 결과 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════ */
const FranchisePanel: React.FC<Props> = ({ user, members, onUpdateUser }) => {
  const isAdmin   = user.role === 'admin' || user.id.toLowerCase() === 'admin';
  const canAccess = isAdmin || !!user.isFranchise;
  const [activeTab, setActiveTab] = useState<FranchiseTab>(isAdmin ? 'members' : 'revenue');

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="text-5xl mb-4">🔐</div>
        <h2 className="text-lg font-black text-gray-800 mb-2">접근 권한이 없습니다</h2>
        <p className="text-sm text-gray-400 font-bold">가맹점 패널은 가맹점 파트너만 접근할 수 있습니다.</p>
      </div>
    );
  }

  const tabs: { id: FranchiseTab; label: string; icon: string; adminOnly?: boolean }[] = [
    ...(isAdmin ? [{ id: 'members' as FranchiseTab, label: '가맹점 현황', icon: '🏢', adminOnly: true }] : []),
    { id: 'revenue',     label: '매출관리',    icon: '📊' },
    { id: 'manuscripts', label: '원고시트',     icon: '📝' },
    { id: 'convert',     label: '원고시트변환', icon: '🔄' },
    { id: 'collector',   label: '원고수집기',   icon: '🔍' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-0 md:py-6">
      <div className="flex overflow-x-auto no-scrollbar border-b border-gray-200 bg-white sticky top-14 xl:top-20 z-10">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 md:px-6 py-3.5 font-black text-sm whitespace-nowrap border-b-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.adminOnly && <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full leading-none">관리자</span>}
          </button>
        ))}
      </div>
      <div className={activeTab === 'manuscripts' ? 'px-0' : 'px-3 md:px-4 pt-4 md:pt-6'}>
        {activeTab === 'members'     && isAdmin && <MembersTab members={members} onUpdateUser={onUpdateUser} />}
        {activeTab === 'revenue'     && <RevenueManagement user={user} />}
        {activeTab === 'manuscripts' && <ManuscriptSheet userId={user.id} />}
        {activeTab === 'convert'     && <ConvertTab />}
        {activeTab === 'collector'   && <CollectorTab />}
      </div>
    </div>
  );
};

export default FranchisePanel;
