import React, { useState, useEffect, useRef } from 'react';
import { strToU8, zipSync } from 'fflate';
import { UserProfile } from '@/types';
import RevenueManagement from './RevenueManagement';
import { supabase } from '../supabase';
import { upsertSmmOrders } from '../smmDb';
import { FranchisePlan, FranchiseProduct, fetchFranchisePlans, fetchFranchiseProducts, fetchFranchisePointsUsed } from '../franchiseDb';

type FranchiseTab = 'members' | 'subscription' | 'revenue' | 'manuscripts' | 'collector' | 'marketing';

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
      원고수집기 — 네이버 카페 크롤러
══════════════════════════════════════════════ */
interface CafeArticle {
  no: number;
  articleId: string | number;
  title: string;
  writer: string;
  date: string;
  commentCount: number;
  readCount: number;
  url: string;
  content?: string;
  comments: { content: string; writer: string; date: string }[];
}

interface ProcessedRow {
  title: string;
  rewrittenTitle: string;
  body: string;
  rewrittenBody: string;
  comments: string[];
  date: string;
  url: string;
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

const EMPTY_KW: ReplaceKw[] = Array.from({ length: 10 }, () => ({ from: '', to: '' }));
const DEFAULT_REWRITE_PROMPT = '원문을 완전히 다른 사람이 쓴 글처럼 리라이팅해줘.\n실제 사람이 쓰듯 ^^,ㅎㅎ,ㄹㄹ,~~,!!,... 이런식으로 1~2개 자연스럽게 적절히 섞어서 써줘.';
const DEFAULT_COMMENT_PROMPT = '아래 글에 어울리는 자연스러운 댓글을 1개만 만들어줘.\n실제 사람이 쓰듯 ^^,ㅎㅎ,ㄹㄹ,~~,!!,... 이런식으로 1~2개 자연스럽게 적절히 섞어서 써줘.';

const CollectorTab: React.FC = () => {
  const [crawlerTab, setCrawlerTab] = useState<CrawlerTab>('collect');

  /* ── 수집 설정 ── */
  const [cafeUrl,       setCafeUrl]       = useState('https://cafe.naver.com/');
  const [cafeId,        setCafeId]        = useState('');
  const [menuId,        setMenuId]        = useState('');
  const [startPage,     setStartPage]     = useState('1');
  const [startDate,     setStartDate]     = useState('');
  const [endDate,       setEndDate]       = useState('');
  const [maxArticles,   setMaxArticles]   = useState('10');
  const [maxComments,   setMaxComments]   = useState('3');
  const [aiRewrite,     setAiRewrite]     = useState(false);
  const [aiFillComment, setAiFillComment] = useState(false);
  const [naverCookie,   setNaverCookie]   = useState(() => localStorage.getItem('crawl_naver_cookie') || '');
  const [showCookie,    setShowCookie]    = useState(() => !!localStorage.getItem('crawl_naver_cookie'));

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
  const [aiExporting,     setAiExporting]     = useState(false);
  const [aiExportStatus,  setAiExportStatus]  = useState('');

  // keywords를 항상 최신값으로 유지하는 ref (stale closure 완전 방지)
  const keywordsRef = useRef<ReplaceKw[]>(keywords);
  keywordsRef.current = keywords;

  const hasAiKey = openaiKey.trim().length > 0;

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

  const handleCookieChange = (v: string) => {
    setNaverCookie(v);
    if (v.trim()) localStorage.setItem('crawl_naver_cookie', v.trim());
    else localStorage.removeItem('crawl_naver_cookie');
  };

  const resolvedCafeId = cafeId.trim() || parseCafeId(cafeUrl);

  /* ── 수집 ── */
  const BATCH_SIZE = 15; // 네이버 카페 1페이지 = 15개

  const doCollect = async (resume: boolean) => {
    if (!resolvedCafeId) { setStatus('카페 ID를 입력해주세요.'); return; }
    stopRef.current = false;
    setLoading(true);

    const total = parseInt(maxArticles) || 10;
    let currentPage = resume && nextPage ? nextPage : parseInt(startPage) || 1;
    let accumulated: CafeArticle[] = resume ? [...articles] : [];
    let remaining = resume ? Math.max(0, total - articles.length) : total;

    // 날짜 필터는 클라이언트에서 처리 — 릴레이에 날짜를 넘기면 페이지를 건너뛰어
    // 시작 페이지가 틀려지는 문제가 생기므로 릴레이는 순수 페이지 단위 수집만 담당
    const sDate = startDate.trim();
    const eDate = endDate.trim() || todayStr();

    const fetchBatch = async (page: number) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 52000);
      let res: Response;
      try {
        res = await fetch('/.netlify/functions/scrape-naver-cafe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cafeId: resolvedCafeId,
            menuId: menuId.trim(),
            startPage: page,
            maxArticles: BATCH_SIZE,
            maxComments: parseInt(maxComments) || 0,
            fetchComments: parseInt(maxComments) > 0,
            naverCookie: naverCookie.trim() || undefined,
          }),
          signal: ctrl.signal,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        throw new Error(msg.includes('abort') ? '릴레이 응답 대기 중 타임아웃' : `네트워크 오류: ${msg}`);
      } finally {
        clearTimeout(timer);
      }
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); }
      catch { throw new Error(`서버 응답 오류 (HTTP ${res.status})`); }
      if (data.status !== 'ok') throw new Error(data.message || '수집 실패');
      return data;
    };

    try {
      while (remaining > 0 && !stopRef.current) {
        setStatus(`수집 중... (${accumulated.length}/${total}개, 페이지 ${currentPage})`);

        // 실패 시 최대 2회 재시도
        let data: any = null;
        let lastErr = '';
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            data = await fetchBatch(currentPage);
            break;
          } catch (e: unknown) {
            lastErr = e instanceof Error ? e.message : '알 수 없는 오류';
            if (attempt < 2) {
              const delay = lastErr.includes('타임아웃') ? 5000 : 3000;
              setStatus(`재시도 중... (${attempt + 1}/2회, 페이지 ${currentPage})`);
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }
        if (!data) {
          setStatus(`수집 중단 — ${accumulated.length}개 수집됨 (오류: ${lastErr})`);
          setLoading(false);
          return;
        }

        const rawList: CafeArticle[] = data.articles || [];

        // 클라이언트 날짜 필터
        const newList = rawList.filter(a => {
          if (sDate && a.date < sDate) return false;
          if (eDate && a.date > eDate) return false;
          return true;
        });

        accumulated = [...accumulated, ...newList.map((a, i) => ({ ...a, no: accumulated.length + i + 1 }))];
        saveArticles(accumulated);

        if (newList.length > 0) {
          const last = newList[newList.length - 1];
          saveLastInfo({ writer: last.writer, date: last.date, page: data.nextPage || currentPage, savedAt: new Date().toLocaleString('ko-KR') });
        }

        remaining -= newList.length;

        // rawList에 startDate보다 오래된 글이 있으면 해당 날짜 경계에 도달한 것 → 중단
        const hitOldBoundary = sDate && rawList.some(a => a.date < sDate);
        if (hitOldBoundary || !data.nextPage || rawList.length === 0) {
          setNextPage(null);
          break;
        }
        currentPage = data.nextPage;
        setNextPage(data.nextPage);

        // 릴레이/네이버 요청 간격 (너무 빠르면 차단됨)
        await new Promise(r => setTimeout(r, 3000));
      }

      if (!stopRef.current) setStatus(`수집 완료 — ${accumulated.length}개 글`);
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

  const makeApply = (kws: ReplaceKw[]) => (text: string): string => {
    let result = (text ?? '').normalize('NFC');
    kws.forEach(kw => {
      const from = kw.from.trim().normalize('NFC');
      if (!from) return;
      try {
        const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), kw.to);
      } catch {
        result = result.split(from).join(kw.to);
      }
    });
    return result;
  };

  const applyKeywords = (text: string) => makeApply(keywordsRef.current)(text);

  /* ── GPT API 호출 헬퍼 ── */
  const callGpt = async (prompt: string, content: string): Promise<string> => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey.trim()}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `${prompt}\n\n${content}` }],
        max_tokens: 1000,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content?.trim() || '';
  };

  /* ── XLSX 빌더 (8컬럼: 구분|원본|리라이팅|댓글1|댓글2|댓글3|날짜|URL) ── */
  const buildXlsx = (rows: ProcessedRow[]) => {
    const esc = (s: string) => (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const strs: string[] = [];
    const strIdx = (v: string) => { const i = strs.indexOf(v); if (i >= 0) return i; strs.push(v); return strs.length - 1; };

    // 스타일 ID: 0=헤더, 1=라벨(굵게), 2=일반, 3=원본제목(연노랑), 4=댓글(연초록), 5=리라이팅(연보라)
    const styleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts>
<font><sz val="11"/><name val="맑은 고딕"/></font>
<font><b/><sz val="11"/><name val="맑은 고딕"/></font>
</fonts>
<fills>
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></fgColor></patternFill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></fgColor></patternFill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/></fgColor></patternFill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDE7F6"/></fgColor></patternFill>
</fills>
<borders><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
</styleSheet>`;

    const cell = (val: string, styleId: number, col: number, row: number) => {
      const addr = String.fromCharCode(65 + col) + (row + 1);
      const si = strIdx(val);
      return `<c r="${addr}" t="s" s="${styleId}"><v>${si}</v></c>`;
    };

    let rowsXml = '';
    const hdr = ['구분','원본','리라이팅','댓글1','댓글2','댓글3','날짜','URL'];
    rowsXml += `<row r="1" ht="20" customHeight="1">${hdr.map((h,c)=>cell(h,0,c,0)).join('')}</row>`;

    let rowIdx = 1;
    rows.forEach(r => {
      const c = r.comments;
      rowsXml += `<row r="${rowIdx+1}" ht="37.5" customHeight="1">${[
        cell('제목:',1,0,rowIdx),
        cell(r.title,3,1,rowIdx),
        cell(r.rewrittenTitle,5,2,rowIdx),
        cell(c[0]??'',4,3,rowIdx),
        cell(c[1]??'',4,4,rowIdx),
        cell(c[2]??'',4,5,rowIdx),
        cell(r.date,2,6,rowIdx),
        cell(r.url,2,7,rowIdx),
      ].join('')}</row>`;
      rowIdx++;
      rowsXml += `<row r="${rowIdx+1}" ht="135" customHeight="1">${[
        cell('내용:',1,0,rowIdx),
        cell(r.body,2,1,rowIdx),
        cell(r.rewrittenBody,5,2,rowIdx),
      ].join('')}</row>`;
      rowIdx++;
    });

    const colsXml = `<cols>
<col min="1" max="1" width="6" customWidth="1"/>
<col min="2" max="2" width="38" customWidth="1"/>
<col min="3" max="3" width="38" customWidth="1"/>
<col min="4" max="6" width="22" customWidth="1"/>
<col min="7" max="7" width="12" customWidth="1"/>
<col min="8" max="8" width="32" customWidth="1"/>
</cols>`;

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}<sheetData>${rowsXml}</sheetData></worksheet>`;

    const sharedStrXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strs.length}" uniqueCount="${strs.length}">
${strs.map(s=>`<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}
</sst>`;

    const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="수집결과" sheetId="1" r:id="rId1"/></sheets></workbook>`;

    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

    const zipped = zipSync({
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rels),
      'xl/workbook.xml': strToU8(wbXml),
      'xl/_rels/workbook.xml.rels': strToU8(wbRels),
      'xl/worksheets/sheet1.xml': strToU8(sheetXml),
      'xl/sharedStrings.xml': strToU8(sharedStrXml),
      'xl/styles.xml': strToU8(styleXml),
    });

    const blob = new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    const filename = `cafe_posts_${todayStr().replace(/\./g,'')}_${new Date().toTimeString().slice(0,5).replace(':','')}.xlsx`;
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    saveHistory([{
      id: Date.now().toString(),
      collectedAt: new Date().toLocaleString('ko-KR'),
      cafeUrl: cafeUrl.trim(),
      startDate: startDate.trim() || '-',
      endDate: endDate.trim() || todayStr(),
      count: articles.length,
      filename,
    }, ...history]);
  };

  /* ── 원문 CSV 저장 (치환 키워드 적용, 리라이팅 컬럼 비움) ── */
  const exportPlain = () => {
    // keywordsRef.current = 현재 렌더의 keywords (stale closure 없음)
    // localStorage = 탭 전환 후 재마운트 시에도 최신값 보장
    let kws: ReplaceKw[] = keywordsRef.current;
    try { const s = localStorage.getItem('crawl_keywords'); if (s) kws = JSON.parse(s); } catch {}
    const apply = makeApply(kws);
    const rows: ProcessedRow[] = articles.map(a => ({
      title: apply(a.title),
      rewrittenTitle: '',
      body: apply(a.content ?? ''),
      rewrittenBody: '',
      comments: (a.comments ?? []).slice(0, 3).map(c => apply(c.content)),
      date: a.date,
      url: a.url,
    }));
    buildXlsx(rows);
  };

  /* ── AI 리라이팅 + 댓글 생성 + 치환 후 CSV 저장 ── */
  const doAiExport = async () => {
    if (!hasAiKey) { alert('치환키워드 탭에서 OpenAI API 키를 먼저 입력해주세요.'); return; }
    setAiExporting(true);
    setAiExportStatus(`AI 처리 준비 중... (0/${articles.length})`);

    let kws: ReplaceKw[] = keywordsRef.current;
    try { const s = localStorage.getItem('crawl_keywords'); if (s) kws = JSON.parse(s); } catch {}
    const applyFresh = makeApply(kws);

    let done = 0;
    const processArticle = async (a: CafeArticle): Promise<ProcessedRow> => {
      const origTitle = applyFresh(a.title);
      const origBody  = applyFresh(a.content ?? '');
      let rewrittenTitle = '';
      let rewrittenBody  = '';
      const existing = (a.comments ?? []).slice(0, 3).map(c => applyFresh(c.content));
      const finalComments = [...existing];

      if (aiRewrite) {
        try { rewrittenTitle = await callGpt(rewritePrompt, `제목: ${a.title}`); } catch { rewrittenTitle = origTitle; }
        try { rewrittenBody  = await callGpt(rewritePrompt, `내용:\n${a.content ?? ''}`); } catch { rewrittenBody  = origBody; }
      }

      if (aiFillComment && finalComments.length < 2) {
        const needed = 2 - finalComments.length;
        for (let j = 0; j < needed; j++) {
          try {
            const c = await callGpt(commentPrompt, `제목: ${a.title}\n내용: ${a.content ?? ''}`);
            finalComments.push(c);
          } catch { break; }
        }
      }

      done++;
      setAiExportStatus(`AI 처리 중... (${done}/${articles.length})`);
      return { title: origTitle, rewrittenTitle, body: origBody, rewrittenBody, comments: finalComments, date: a.date, url: a.url };
    };

    try {
      const results: ProcessedRow[] = new Array(articles.length);
      let nextIdx = 0;
      const worker = async () => {
        while (nextIdx < articles.length) {
          const i = nextIdx++;
          results[i] = await processArticle(articles[i]);
        }
      };
      await Promise.all(Array.from({ length: 5 }, worker));
      buildXlsx(results);
      setAiExportStatus('완료!');
      setTimeout(() => setAiExportStatus(''), 2000);
    } catch (e: unknown) {
      alert(`AI 처리 오류: ${e instanceof Error ? e.message : '실패'}`);
    } finally {
      setAiExporting(false);
    }
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
              <input className={inputCls} type="number" min="1" max="500" value={maxArticles} onChange={e => setMaxArticles(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-0.5">댓글 수집 개수 (0~5):</label>
              <input className={inputCls} type="number" min="0" max="5" value={maxComments} onChange={e => setMaxComments(e.target.value)} />
            </div>

            {/* AI 설정 */}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-black text-gray-500 mb-1.5">■ AI 설정</p>
              {hasAiKey ? (
                <p className="text-[10px] text-green-600 font-bold mb-1.5">✅ GPT API 연결됨</p>
              ) : (
                <p className="text-[10px] text-orange-500 font-bold mb-1.5">⚠ 치환키워드 탭에서 API 키 입력 필요</p>
              )}
              <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1 cursor-pointer">
                <input type="checkbox" checked={aiRewrite} onChange={e => setAiRewrite(e.target.checked)} />
                AI 리라이팅 적용 (제목+내용)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1 cursor-pointer">
                <input type="checkbox" checked={aiFillComment} onChange={e => setAiFillComment(e.target.checked)} />
                댓글 부족 시 AI 댓글로 채우기
              </label>
              <p className="text-[10px] text-gray-400">※ AI 기능은 API 키 입력 후 저장 시 적용</p>
            </div>

            {/* 네이버 로그인 (비공개 카페) */}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-black text-gray-500 mb-1.5">■ 네이버 로그인 (비공개 카페)</p>
              <button type="button" onClick={openNaverLogin}
                className="w-full py-1.5 rounded text-xs font-black text-white bg-green-600 hover:bg-green-700 mb-1.5">
                🔐 네이버 로그인 팝업
              </button>

              {/* 쿠키 상태 표시 */}
              <div className={`text-[10px] font-bold px-2 py-1 rounded mb-1 ${naverCookie.trim() ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
                {naverCookie.trim()
                  ? '✅ 내 쿠키 사용 중 (서버 기본 쿠키 무시됨)'
                  : '⚪ 서버 기본 쿠키 사용 중'}
              </div>

              <button type="button" onClick={() => setShowCookie(v => !v)}
                className="text-[10px] text-blue-500 hover:underline font-bold">
                {showCookie ? '▲ 세션쿠키 숨기기' : '▼ 세션쿠키 직접 입력'}
              </button>
              {showCookie && (
                <div className="mt-1 space-y-1">
                  <p className="text-[10px] text-gray-400">
                    브라우저 개발자도구(F12) → Application → Cookies → cafe.naver.com<br/>
                    NID_AUT 와 NID_SES 값을 복사해서 붙여넣으세요
                  </p>
                  <textarea
                    className={`${inputCls} resize-none h-16 font-mono text-[10px]`}
                    value={naverCookie}
                    onChange={e => handleCookieChange(e.target.value)}
                    placeholder="NID_AUT=xxxxx; NID_SES=xxxxx"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="flex gap-1">
                    <button type="button"
                      onClick={() => { handleCookieChange(''); }}
                      className="flex-1 py-1 rounded text-[10px] font-bold text-white bg-red-400 hover:bg-red-500">
                      🗑 쿠키 삭제 (서버 기본으로 복귀)
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400">입력한 쿠키는 이 기기에 자동 저장됩니다</p>
                </div>
              )}
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
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-bold mb-2 bg-green-50 text-green-700">
                <span>🟢</span>
                <span>서버 릴레이 연결됨 — 한국(서울) 서버로 수집</span>
              </div>
            </div>


            {/* 수집 상태 표시 */}
            <div className={`mt-2 px-2 py-1.5 rounded text-xs font-bold leading-snug ${
              status.startsWith('오류') ? 'bg-red-50 text-red-700' :
              status.startsWith('수집 완료') ? 'bg-green-50 text-green-700' :
              status.startsWith('수집 중') ? 'bg-blue-50 text-blue-700' :
              'bg-gray-50 text-gray-400'
            }`}>
              {status}
            </div>

            {/* 치환 미리보기 */}
            {articles.length > 0 && keywords.some(k => k.from.trim()) && (() => {
              const preview = applyKeywords(articles[0].title);
              const changed = preview !== articles[0].title;
              return (
                <div className={`mt-2 px-2 py-1.5 rounded text-[10px] font-bold leading-snug border ${changed ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
                  {changed ? '✅ 치환 적용 됨:' : '⚠ 치환 미적용 (원문 단어 없음):'}
                  <span className="block mt-0.5 font-normal break-all">{preview}</span>
                </div>
              );
            })()}

            {/* 버튼들 */}
            <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
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
              <button type="button" onClick={exportPlain} disabled={articles.length === 0}
                className="w-full py-2 rounded font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
                💾 CSV 저장 (원문+치환)
              </button>
              <button type="button" onClick={doAiExport}
                disabled={articles.length === 0 || !hasAiKey || aiExporting}
                className="w-full py-2 rounded font-black text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {aiExporting ? (aiExportStatus || 'AI 처리 중...') : '🤖 AI 리라이팅 후 저장'}
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
              <p className="text-xs text-gray-400 font-bold">수집 완료 — {articles.length}개 글</p>
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
   구독관리
══════════════════════════════════════════════ */
const PLAN_COLORS = ['blue', 'purple', 'emerald', 'orange', 'pink'];

const SubscriptionTab: React.FC<{ user: UserProfile }> = ({ user }) => {
  const [plans, setPlans]           = useState<FranchisePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [activePlan, setActivePlan]   = useState<string | null>(null);
  const [activeUntil, setActiveUntil] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFranchisePlans().then(data => { if (!cancelled) setPlans(data); });
    const storageKey = `franchise_sub_${user.id}`;
    try {
      const s = localStorage.getItem(storageKey);
      if (s) {
        const d = JSON.parse(s);
        setActivePlan(d.plan ?? null);
        setActiveUntil(d.until ?? null);
      }
    } catch {}
    return () => { cancelled = true; };
  }, [user.id]);

  const activePlans = plans.filter(p => p.isActive);
  const isActive    = activePlan && activeUntil && new Date(activeUntil) > new Date();
  const planLabel   = activePlans.find(p => p.id === activePlan)?.name ?? null;

  const handleRequestPayment = () => {
    if (!selectedPlan) { alert('플랜을 선택해주세요.'); return; }
    const plan = activePlans.find(p => p.id === selectedPlan);
    if (plan?.paymentUrl) {
      const sep = plan.paymentUrl.includes('?') ? '&' : '?';
      window.open(plan.paymentUrl + sep + 'autoTrigger=1', '_blank', 'noopener,noreferrer');
    } else {
      alert(`결제 신청 안내\n\n카카오톡 채널 @bestsns 으로 문의해 주세요.\n아이디(${user.nickname})와 선택 플랜(${plan?.name ?? ''})을 함께 알려주세요.`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-gray-900">구독관리</h2>
        <p className="text-xs text-gray-400 font-bold mt-0.5">가맹점 구독료를 결제하고 모든 기능을 이용하세요</p>
      </div>

      {/* 현재 구독 상태 */}
      <div className={`rounded-2xl p-5 border-2 ${isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${isActive ? 'bg-emerald-100' : 'bg-gray-200'}`}>
            {isActive ? '✅' : '⏸'}
          </div>
          <div>
            <p className={`font-black text-base ${isActive ? 'text-emerald-800' : 'text-gray-600'}`}>
              {isActive ? `구독 중 — ${planLabel}` : '구독 없음'}
            </p>
            {isActive && activeUntil && (
              <p className="text-xs text-emerald-600 font-bold mt-0.5">
                {activeUntil.slice(0, 10)} 까지 이용 가능
              </p>
            )}
            {!isActive && (
              <p className="text-xs text-gray-400 font-bold mt-0.5">아래에서 플랜을 선택하고 결제를 신청하세요</p>
            )}
          </div>
        </div>
      </div>

      {/* 플랜 선택 */}
      {activePlans.length === 0 ? (
        <div className="py-10 text-center text-gray-300">
          <p className="font-black">등록된 플랜이 없습니다</p>
          <p className="text-xs mt-1">관리자에게 문의하세요</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4">
          {activePlans.map((plan, idx) => {
            const color      = PLAN_COLORS[idx % PLAN_COLORS.length];
            const isSelected = selectedPlan === plan.id;
            const isCurrent  = activePlan === plan.id && !!isActive;
            const colorSel: Record<string, string> = {
              blue:    isSelected ? 'border-blue-500 bg-blue-50'    : 'border-gray-200 bg-white hover:border-blue-300',
              purple:  isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300',
              emerald: isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-300',
              orange:  isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300',
              pink:    isSelected ? 'border-pink-500 bg-pink-50'    : 'border-gray-200 bg-white hover:border-pink-300',
            };
            const dotColor: Record<string, string> = {
              blue: 'bg-blue-600', purple: 'bg-purple-600', emerald: 'bg-emerald-600', orange: 'bg-orange-500', pink: 'bg-pink-500',
            };
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlan(plan.id)}
                className={`flex-1 text-left rounded-2xl border-2 p-5 transition-all ${colorSel[color]}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-900">{plan.name}</span>
                      {isCurrent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-black">현재 플랜</span>}
                    </div>
                    {plan.originalPrice && plan.originalPrice > plan.price && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-gray-400 font-bold line-through">{plan.originalPrice.toLocaleString()}원</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-black">{Math.round((1 - plan.price / plan.originalPrice) * 100)}% 할인</span>
                      </div>
                    )}
                    <p className="text-2xl font-black text-gray-900 mt-1">
                      {plan.price.toLocaleString()}
                      <span className="text-sm font-bold text-gray-400">원/{plan.period}</span>
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 ${isSelected ? `${dotColor[color]} border-transparent` : 'border-gray-300'}`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 font-bold">
                      <span className="text-emerald-500 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      )}

      {/* 결제 신청 버튼 */}
      <button
        type="button"
        onClick={handleRequestPayment}
        disabled={!selectedPlan}
        className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-base hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {selectedPlan
          ? `${activePlans.find(p => p.id === selectedPlan)?.name} 결제 신청하기`
          : '플랜을 선택하세요'}
      </button>

    </div>
  );
};

/* ══════════════════════════════════════════════
   마케팅상품 주문
══════════════════════════════════════════════ */
const MarketingTab: React.FC<{ user: UserProfile }> = ({ user }) => {
  const [products, setProducts]   = useState<FranchiseProduct[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<FranchiseProduct | null>(null);
  const [link, setLink]           = useState('');
  const [quantity, setQuantity]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('전체');

  // 포인트
  const [totalPoints, setTotalPoints]   = useState<number | null>(null); // null = 무제한
  const [usedPoints, setUsedPoints]     = useState(0);
  const [pointsLoading, setPointsLoading] = useState(true);

  useEffect(() => {
    fetchFranchiseProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  // 구독 플랜 → 포인트 총량 + 사용량
  useEffect(() => {
    let cancelled = false;
    const sub = (() => {
      try { return JSON.parse(localStorage.getItem(`franchise_sub_${user.id}`) ?? '{}'); } catch { return {}; }
    })();
    const planId = sub?.plan as string | undefined;
    if (!planId) { setPointsLoading(false); return; }

    Promise.all([
      fetchFranchisePlans(),
      fetchFranchisePointsUsed(user.id),
    ]).then(([plans, used]) => {
      if (cancelled) return;
      const plan = plans.find(p => p.id === planId);
      setTotalPoints(plan ? (plan.points ?? null) : 0);
      setUsedPoints(used);
    }).catch(() => {}).finally(() => { if (!cancelled) setPointsLoading(false); });
    return () => { cancelled = true; };
  }, [user.id]);

  const remaining = totalPoints === null ? null : Math.max(0, totalPoints - usedPoints);

  const categories = ['전체', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  const visible    = filterCategory === '전체' ? products : products.filter(p => p.category === filterCategory);

  const handleOrder = async () => {
    if (!selected || !link.trim() || !quantity) return;
    const qty = Number(quantity);
    if (isNaN(qty) || qty < selected.minQuantity || qty > selected.maxQuantity) {
      alert(`수량은 ${selected.minQuantity.toLocaleString()} ~ ${selected.maxQuantity.toLocaleString()} 사이여야 합니다.`);
      return;
    }
    const cost = selected.price * qty;
    if (cost > 0 && remaining !== null && cost > remaining) {
      alert(`포인트가 부족합니다.\n필요: ${cost.toLocaleString()}P / 잔여: ${remaining.toLocaleString()}P`);
      return;
    }
    setSubmitting(true);
    try {
      const orderId = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await upsertSmmOrders([{
        id: orderId,
        userId: user.id,
        userNickname: user.nickname,
        orderTime: new Date().toISOString(),
        platform: selected.category || '가맹점',
        productName: selected.name,
        link: link.trim(),
        quantity: qty,
        initialCount: 0,
        remains: qty,
        providerName: '가맹점주문',
        costPrice: 0,
        sellingPrice: cost,
        profit: 0,
        status: 'pending',
        externalOrderId: '',
      }]);
      setUsedPoints(prev => prev + cost);
      setSuccessMsg(`[${selected.name}] 주문이 접수되었습니다. 관리자 확인 후 진행됩니다.`);
      setSelected(null);
      setLink('');
      setQuantity('');
    } catch {
      alert('주문 접수에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-gray-400 font-bold">상품 불러오는 중...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-gray-900">마케팅상품 주문</h2>
          <p className="text-xs text-gray-400 font-bold mt-0.5">운영자가 등록한 마케팅 프로그램 상품을 주문하세요. 접수 후 관리자 확인을 거쳐 진행됩니다.</p>
        </div>
        {/* 포인트 잔액 */}
        {!pointsLoading && (
          <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-5 py-3 min-w-[180px] text-right shrink-0">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wide">잔여 포인트</p>
            <p className="text-xl font-black text-indigo-700 mt-0.5">
              {remaining === null ? '무제한' : `${remaining.toLocaleString()}P`}
            </p>
            {totalPoints !== null && (
              <p className="text-[10px] text-indigo-300 font-bold mt-0.5">
                사용 {usedPoints.toLocaleString()}P / 총 {totalPoints.toLocaleString()}P
              </p>
            )}
          </div>
        )}
      </div>

      {successMsg && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4">
          <span className="text-2xl shrink-0">✅</span>
          <div>
            <p className="font-black text-emerald-800 text-sm">{successMsg}</p>
            <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs text-emerald-600 font-bold hover:underline mt-1">닫기</button>
          </div>
        </div>
      )}

      {/* 카테고리 필터 */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button key={c} type="button" onClick={() => setFilterCategory(c)}
              className={`px-3 py-1 rounded-full text-xs font-black transition-colors ${filterCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* 상품 그리드 */}
      {visible.length === 0 ? (
        <div className="py-16 text-center text-gray-300">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-black">등록된 상품이 없습니다</p>
          <p className="text-xs mt-1">운영자가 상품을 등록하면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map(product => (
            <button
              key={product.id}
              type="button"
              onClick={() => { setSelected(product); setLink(''); setQuantity(String(product.minQuantity)); setSuccessMsg(null); }}
              className={`text-left rounded-2xl border-2 p-4 transition-all hover:shadow-md ${selected?.id === product.id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-200'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                {product.category && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-600">{product.category}</span>}
                <div className="ml-auto shrink-0 text-right">
                  {product.originalPrice && product.originalPrice > product.price ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 font-bold line-through">{product.originalPrice.toLocaleString()}P</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-black">{Math.round((1 - product.price / product.originalPrice) * 100)}%</span>
                    </div>
                  ) : null}
                  <p className="text-xs font-black text-indigo-600">{product.price.toLocaleString()}P</p>
                  {product.price > 0 && remaining !== null && product.price > remaining && (
                    <p className="text-[9px] text-red-400 font-bold mt-0.5">포인트 부족</p>
                  )}
                </div>
              </div>
              <p className="font-black text-gray-900 text-sm leading-snug">{product.name}</p>
              {product.description && <p className="text-[11px] text-gray-400 mt-1 font-bold line-clamp-2">{product.description}</p>}
              <p className="text-[10px] text-gray-300 mt-1">최소 {product.minQuantity.toLocaleString()} ~ 최대 {product.maxQuantity.toLocaleString()}</p>
            </button>
          ))}
        </div>
      )}

      {/* 주문 폼 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-black text-gray-900">주문 접수</h3>
                <button type="button" onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 font-black text-lg leading-none">✕</button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selected.category && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-600">{selected.category}</span>}
                <span className="text-sm font-black text-gray-800">{selected.name}</span>
              </div>
              {selected.description && <p className="text-xs text-gray-400 mt-1">{selected.description}</p>}
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">대상 링크 <span className="text-red-500">*</span></label>
              <input
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 outline-none text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">
                수량 <span className="text-red-500">*</span>
                <span className="text-gray-300 ml-1 font-bold">({selected.minQuantity.toLocaleString()} ~ {selected.maxQuantity.toLocaleString()})</span>
              </label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min={selected.minQuantity}
                max={selected.maxQuantity}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 outline-none text-sm font-bold"
              />
            </div>

            {quantity && !isNaN(Number(quantity)) && Number(quantity) > 0 && (
              <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                remaining !== null && selected.price * Number(quantity) > remaining
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-indigo-50'
              }`}>
                <span className="text-xs font-black text-indigo-600">차감 포인트</span>
                <div className="text-right">
                  <span className="font-black text-indigo-800">{(selected.price * Number(quantity)).toLocaleString()}P</span>
                  {remaining !== null && (
                    <p className="text-[10px] text-indigo-400 font-bold">
                      주문 후 잔여: {Math.max(0, remaining - selected.price * Number(quantity)).toLocaleString()}P
                    </p>
                  )}
                  {remaining !== null && selected.price * Number(quantity) > remaining && (
                    <p className="text-[10px] text-red-500 font-black">포인트 부족</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setSelected(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-black text-sm hover:bg-gray-200 transition-colors">
                취소
              </button>
              <button
                type="button"
                onClick={handleOrder}
                disabled={submitting || !link.trim() || !quantity}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? '접수 중...' : '주문 접수'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   가맹점 현황 (어드민 전용)
══════════════════════════════════════════════ */
const MembersTab: React.FC<{ members: UserProfile[]; onUpdateUser?: (u: UserProfile) => void }> = ({ members, onUpdateUser }) => {
  const [search, setSearch]           = useState('');
  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState(members);
  const [errMsg, setErrMsg]           = useState<string | null>(null);
  useEffect(() => { setLocalMembers(members); }, [members]);

  const toggleFranchise = async (member: UserProfile) => {
    if (togglingId) return;
    setTogglingId(member.id);
    setErrMsg(null);
    const newVal  = !member.isFranchise;
    const updated = { ...member, isFranchise: newVal };

    // 낙관적 업데이트 — 즉시 UI 반영
    setLocalMembers(prev => prev.map(m => m.id === member.id ? updated : m));
    if (onUpdateUser) onUpdateUser(updated);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_franchise: newVal })
        .eq('id', member.id);

      if (error) {
        // 롤백
        setLocalMembers(prev => prev.map(m => m.id === member.id ? member : m));
        if (onUpdateUser) onUpdateUser(member);
        setErrMsg(`저장 실패: ${error.message} — Supabase profiles 테이블에 is_franchise (boolean) 컬럼이 필요합니다.`);
      }
    } catch (e) {
      setLocalMembers(prev => prev.map(m => m.id === member.id ? member : m));
      if (onUpdateUser) onUpdateUser(member);
      setErrMsg('네트워크 오류로 저장에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  const franchiseMembers = localMembers.filter(m => m.isFranchise);
  const visible = localMembers.filter(m => !search || m.nickname.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">가맹점 파트너 관리</h2>
          <p className="text-xs text-gray-400 font-bold mt-0.5">현재 {franchiseMembers.length}개 가맹점 활성 · 선택된 회원은 가맹점패널에 접근할 수 있습니다</p>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임·ID 검색..."
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-blue-400 w-48" />
      </div>

      {errMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-bold text-red-700 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{errMsg}</span>
        </div>
      )}

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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img src={member.profileImage} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-100 shrink-0" />
                      <span className="font-black text-gray-900 whitespace-nowrap">{member.nickname}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-[11px]">{member.id}</td>
                  <td className="px-4 py-3 text-gray-500">{member.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : member.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={togglingId === member.id || member.role === 'admin'}
                      onClick={() => toggleFranchise(member)}
                      className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all disabled:opacity-40 ${member.isFranchise ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                    >
                      {togglingId === member.id ? '저장 중...' : member.isFranchise ? '✓ 가맹점' : '가맹점 선택'}
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-gray-300 font-bold">검색 결과 없음</td></tr>
              )}
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
const PROTECTED_TABS: FranchiseTab[] = ['revenue', 'manuscripts', 'collector', 'marketing'];

const FranchisePanel: React.FC<Props> = ({ user, members, onUpdateUser }) => {
  const isAdmin   = user.role === 'admin' || user.role === 'manager';
  const canAccess = isAdmin || !!user.isFranchise;

  const defaultTab: FranchiseTab = isAdmin ? 'members' : 'subscription';
  const [activeTab, setActiveTab] = useState<FranchiseTab>(defaultTab);
  const [showSubModal, setShowSubModal] = useState(false);

  // 창 닫힐 때 원고시트 localStorage + Supabase 즉시 저장
  // sendBeacon은 iframe이 아닌 최상위 페이지(부모)에서 호출해야 브라우저 종료 시 전달 보장
  useEffect(() => {
    const handleBeforeUnload = () => {
      const iframe = document.querySelector('iframe[title="원고시트"]') as HTMLIFrameElement | null;
      const iWin = iframe?.contentWindow as any;
      (iWin?.flushLocalSave as (() => void) | undefined)?.();
      // 부모 창에서 sendBeacon 호출 (iframe 내부보다 훨씬 안정적)
      const beaconData = (iWin?.getBeaconData as (() => string | null) | undefined)?.();
      const userId = iWin?.USER_ID as string | undefined;
      if (beaconData && userId) {
        try {
          navigator.sendBeacon(
            `/api/sheet-sync?userId=${encodeURIComponent(userId)}`,
            new Blob([beaconData], { type: 'application/json' })
          );
        } catch(e) {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="text-5xl mb-4">🔐</div>
        <h2 className="text-lg font-black text-gray-800 mb-2">접근 권한이 없습니다</h2>
        <p className="text-sm text-gray-400 font-bold">가맹점 패널은 가맹점 파트너만 접근할 수 있습니다.</p>
      </div>
    );
  }

  const checkHasActiveSub = () => {
    if (isAdmin) return true;
    try {
      const s = localStorage.getItem(`franchise_sub_${user.id}`);
      if (s) {
        const d = JSON.parse(s);
        return !!(d.plan && d.until && new Date(d.until) > new Date());
      }
    } catch {}
    return false;
  };

  const handleTabClick = (tabId: FranchiseTab) => {
    if (!isAdmin && PROTECTED_TABS.includes(tabId) && !checkHasActiveSub()) {
      setShowSubModal(true);
      setActiveTab('subscription');
      return;
    }
    setActiveTab(tabId);
  };

  const tabs: { id: FranchiseTab; label: string; icon: string; adminOnly?: boolean }[] = [
    ...(isAdmin ? [{ id: 'members' as FranchiseTab, label: '가맹점 현황', icon: '🏢', adminOnly: true }] : []),
    { id: 'subscription', label: '구독관리',    icon: '💳' },
    { id: 'revenue',      label: '매출관리',    icon: '📊' },
    { id: 'manuscripts',  label: '원고시트',    icon: '📝' },
    { id: 'collector',    label: '원고수집프로그램',  icon: '🔍' },
    { id: 'marketing',    label: '마케팅프로그램',  icon: '📣' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-0 md:py-6">
      <div className="flex overflow-x-auto no-scrollbar border-b border-gray-200 bg-white sticky top-14 xl:top-20 z-10">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => handleTabClick(tab.id)}
            className={`flex items-center gap-1.5 px-4 md:px-6 py-3.5 font-black text-sm whitespace-nowrap border-b-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.adminOnly && <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full leading-none">관리자</span>}
          </button>
        ))}
      </div>
      <div className={activeTab === 'manuscripts' ? 'px-0' : 'px-3 md:px-4 pt-4 md:pt-6'}>
        {activeTab === 'members'      && isAdmin && <MembersTab members={members} onUpdateUser={onUpdateUser} />}
        {activeTab === 'subscription'              && <SubscriptionTab user={user} />}
        {activeTab === 'revenue'                   && <RevenueManagement user={user} />}
        {/* iframe은 항상 마운트 유지 — DOM에서 제거되면 beforeunload가 발화하지 않아 편집 내용이 손실됨 */}
        <div style={{ display: activeTab === 'manuscripts' ? 'block' : 'none' }}>
          <ManuscriptSheet userId={user.id} />
        </div>
        {activeTab === 'collector'                 && <CollectorTab />}
        {activeTab === 'marketing'                 && <MarketingTab user={user} />}
      </div>

      {showSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl p-7 w-full max-w-xs shadow-2xl text-center space-y-4">
            <div className="text-4xl">🔐</div>
            <div>
              <h3 className="font-black text-gray-900 text-lg">구독이 필요합니다</h3>
              <p className="text-sm text-gray-500 font-bold mt-1">
                구독 후 이용해주시기 바랍니다.<br />구독관리 페이지에서 플랜을 선택하세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSubModal(false)}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-colors"
            >
              구독관리로 이동
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FranchisePanel;
