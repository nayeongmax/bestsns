import React, { useState } from 'react';

/* ──────────────── 타입 ──────────────── */
interface ReportEntry {
  no: number;
  date: string;
  category: string;
  url: string;
  note: string;
}

interface ReportData {
  id: string;
  cafeName: string;
  keyword: string;
  service: string;
  postTarget: number;
  postDone: number;
  commentTarget: number;
  commentDone: number;
  startDate: string;
  endDate: string;
  entries: ReportEntry[];
  additionalServices: string[];
}

/* ──────────────── 샘플 보고서 데이터 ──────────────── */
const SAMPLE_REPORTS: ReportData[] = [
  {
    id: 'RPT-2026-001',
    cafeName: 'PREMIUM',
    keyword: '위너크',
    service: '카페 활성화',
    postTarget: 320,
    postDone: 320,
    commentTarget: 320,
    commentDone: 320,
    startDate: '2026-01-06',
    endDate: '2026-02-06',
    additionalServices: [
      '추가 게시글 120개 이상 (300,000원 상당)',
      '추가 댓글 100개 이상 (50,000원 상당)',
    ],
    entries: Array.from({ length: 39 }, (_, i) => ({
      no: i + 1,
      date: i < 18 ? '1/6' : i < 31 ? '1/7' : '1/8',
      category: '게시글',
      url: `https://cafe.naver.com/m/ac2897/${6811 + i}`,
      note: '',
    })),
  },
  {
    id: 'RPT-2026-002',
    cafeName: 'GOLD 패키지',
    keyword: '맛집탐방',
    service: '카페 활성화',
    postTarget: 200,
    postDone: 200,
    commentTarget: 150,
    commentDone: 150,
    startDate: '2026-01-15',
    endDate: '2026-02-15',
    additionalServices: [
      '추가 게시글 80개 이상 (200,000원 상당)',
    ],
    entries: Array.from({ length: 25 }, (_, i) => ({
      no: i + 1,
      date: i < 12 ? '1/15' : i < 20 ? '1/16' : '1/17',
      category: i % 3 === 0 ? '댓글' : '게시글',
      url: `https://cafe.naver.com/m/food123/${5000 + i}`,
      note: '',
    })),
  },
  {
    id: 'RPT-2026-003',
    cafeName: 'STANDARD',
    keyword: '뷰티리뷰',
    service: '블로그 체험단',
    postTarget: 30,
    postDone: 30,
    commentTarget: 0,
    commentDone: 0,
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    additionalServices: [],
    entries: Array.from({ length: 30 }, (_, i) => ({
      no: i + 1,
      date: `2/${(i % 28) + 1}`,
      category: '블로그 포스팅',
      url: `https://blog.naver.com/beauty_review/${8000 + i}`,
      note: i < 5 ? '상위 노출 확인' : '',
    })),
  },
];

/* ──────────────── 컴포넌트 ──────────────── */
const WorkReport: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [searchCode, setSearchCode] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  const handleSearch = () => {
    const found = SAMPLE_REPORTS.find(r => r.id === searchCode.trim());
    if (found) {
      setSelectedReport(found);
    } else {
      alert('보고서를 찾을 수 없습니다. 코드를 확인해 주세요.\n\n데모 보고서 코드: RPT-2026-001, RPT-2026-002, RPT-2026-003');
    }
  };

  const progressPercent = selectedReport
    ? Math.round((selectedReport.postDone / selectedReport.postTarget) * 100)
    : 0;

  const commentPercent = selectedReport && selectedReport.commentTarget > 0
    ? Math.round((selectedReport.commentDone / selectedReport.commentTarget) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFDF7] via-[#FFF8EC] to-white">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/marketing" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-xs">B</div>
            <span className="font-black text-sm">
              <span className="text-amber-600">THE BEST</span> 마케팅
            </span>
          </a>
          <a href="/marketing" className="text-sm text-gray-500 hover:text-amber-500 transition-colors">← 메인으로</a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* 타이틀 */}
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold mb-4">WORK REPORT</span>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
            작업 <span className="text-amber-500">결과 보고서</span>
          </h1>
          <p className="text-gray-500">광고주님의 작업 진행 상황과 결과를 실시간으로 확인하세요</p>
        </div>

        {/* 검색 */}
        <div className="max-w-lg mx-auto mb-10">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchCode}
              onChange={e => setSearchCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="보고서 코드 입력 (예: RPT-2026-001)"
              className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
            />
            <button onClick={handleSearch} className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-amber-500/20 transition-all text-sm">
              조회
            </button>
          </div>
          <div className="mt-3 text-center">
            <button onClick={() => { setShowDemo(!showDemo); }} className="text-sm text-amber-600 hover:text-amber-700 font-medium">
              {showDemo ? '닫기' : '📋 데모 보고서 목록 보기'}
            </button>
          </div>

          {showDemo && (
            <div className="mt-4 space-y-2">
              {SAMPLE_REPORTS.map(r => (
                <button key={r.id} onClick={() => { setSelectedReport(r); setSearchCode(r.id); }}
                  className="w-full text-left px-5 py-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-amber-500">{r.id}</span>
                      <div className="font-bold text-gray-900 text-sm mt-0.5">{r.cafeName} — {r.service}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{r.startDate} ~ {r.endDate}</div>
                    </div>
                    <span className="text-gray-400 group-hover:text-amber-500 transition-colors">→</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 보고서 뷰 */}
        {selectedReport && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* 보고서 헤더 */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black mb-1">카페활성화 작업보고서 (고객보관용)</h2>
                    <p className="text-amber-100 text-sm">Report ID: {selectedReport.id}</p>
                  </div>
                  <button onClick={() => window.print()} className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-medium hover:bg-white/30 transition-colors backdrop-blur-sm print:hidden">
                    🖨️ 인쇄
                  </button>
                </div>
              </div>

              {/* 요약 정보 */}
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-amber-50 rounded-xl p-4">
                    <div className="text-xs text-amber-600 font-semibold mb-1">카페 명</div>
                    <div className="font-bold text-gray-900">{selectedReport.cafeName}</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <div className="text-xs text-amber-600 font-semibold mb-1">위너크</div>
                    <div className="font-bold text-gray-900">{selectedReport.keyword}</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <div className="text-xs text-amber-600 font-semibold mb-1">THE BEST 카페 C팀</div>
                    <div className="text-xs text-gray-600">
                      <div>작업시작일: {selectedReport.startDate}</div>
                      <div>작업종료일: {selectedReport.endDate}</div>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <div className="text-xs text-amber-600 font-semibold mb-1">서비스</div>
                    <div className="font-bold text-gray-900">{selectedReport.service}</div>
                  </div>
                </div>

                {/* 진행률 바 */}
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">게시글 진행률</span>
                      <span className="text-sm font-bold text-amber-600">{selectedReport.postDone}/{selectedReport.postTarget}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className="text-right text-xs text-amber-600 font-bold mt-1">{progressPercent}% 완료</div>
                  </div>
                  {selectedReport.commentTarget > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-gray-700">댓글 진행률</span>
                        <span className="text-sm font-bold text-amber-600">{selectedReport.commentDone}/{selectedReport.commentTarget}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-1000" style={{ width: `${commentPercent}%` }} />
                      </div>
                      <div className="text-right text-xs text-emerald-600 font-bold mt-1">{commentPercent}% 완료</div>
                    </div>
                  )}
                </div>

                {/* 추가 서비스 */}
                {selectedReport.additionalServices.length > 0 && (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                    <div className="text-xs font-bold text-emerald-700 mb-2">🎁 추가 제공 서비스</div>
                    <ul className="space-y-1">
                      {selectedReport.additionalServices.map((s, i) => (
                        <li key={i} className="text-sm text-emerald-800 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* 작업 목록 테이블 */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  작업 상세 내역
                  <span className="text-sm text-gray-400 font-normal ml-2">총 {selectedReport.entries.length}건</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs">
                      <th className="text-center px-4 py-3 font-semibold w-16">순번</th>
                      <th className="text-center px-4 py-3 font-semibold w-20">날짜</th>
                      <th className="text-center px-4 py-3 font-semibold w-24">분류</th>
                      <th className="text-left px-4 py-3 font-semibold">URL</th>
                      <th className="text-center px-4 py-3 font-semibold w-20">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReport.entries.map((entry) => (
                      <tr key={entry.no} className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors">
                        <td className="text-center px-4 py-2.5 text-gray-400">{entry.no}</td>
                        <td className="text-center px-4 py-2.5 text-gray-600">{entry.date}</td>
                        <td className="text-center px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${entry.category === '게시글' ? 'bg-blue-100 text-blue-700' : entry.category === '댓글' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                            {entry.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline text-xs break-all">
                            {entry.url}
                          </a>
                        </td>
                        <td className="text-center px-4 py-2.5 text-gray-400 text-xs">{entry.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 작업 통계 요약 */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                <div className="text-3xl font-black text-amber-500 mb-1">{selectedReport.entries.length}</div>
                <div className="text-sm text-gray-500">총 작업 건수</div>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                <div className="text-3xl font-black text-emerald-500 mb-1">{progressPercent}%</div>
                <div className="text-sm text-gray-500">작업 완료율</div>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
                <div className="text-3xl font-black text-blue-500 mb-1">
                  {Math.ceil((new Date(selectedReport.endDate).getTime() - new Date(selectedReport.startDate).getTime()) / (1000 * 60 * 60 * 24))}일
                </div>
                <div className="text-sm text-gray-500">작업 기간</div>
              </div>
            </div>
          </div>
        )}

        {/* 보고서 미선택 상태 */}
        {!selectedReport && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">보고서를 조회해 주세요</h3>
            <p className="text-gray-500 text-sm mb-6">보고서 코드를 입력하거나 데모 보고서를 선택하세요</p>
            <button onClick={() => setShowDemo(true)} className="px-6 py-3 bg-amber-100 text-amber-700 rounded-xl font-semibold hover:bg-amber-200 transition-colors">
              데모 보고서 보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkReport;
