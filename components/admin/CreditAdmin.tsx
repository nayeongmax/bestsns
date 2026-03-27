/**
 * CreditAdmin — 크레딧 충전 신청 관리 탭
 *
 * 기능:
 *  - 전체 신청 목록을 날짜별로 그룹화, 날짜 좌우 네비게이션
 *  - 선택된 날짜의 신청 목록을 시간순(오름차순)으로 표시
 *  - 승인(→ 포인트 적립) / 거절 처리
 *  - 거절 시 메모 입력 가능
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { CreditApplication } from '../../creditApplicationDb';

// ── 환경변수에서 관리자 비밀번호 가져오기 ─────────────────────────
const ADMIN_KEY =
  (import.meta as any).env?.VITE_ADMIN_PANEL_PASSWORD ??
  (import.meta as any).env?.VITE_ADMIN_PASSWORD ??
  '';

const API_BASE = '/.netlify/functions/credit-admin';

// ── 날짜 문자열 포맷 (KST 기준 표시) ───────────────────────────────
function toDateStr(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}
function toTimeStr(iso: string): string {
  // UTC → KST (+9h) 변환
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(11, 19); // HH:MM:SS
}
function toKSTDateStr(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<CreditApplication['status'], string> = {
  pending: '대기',
  approved: '승인',
  rejected: '거절',
};
const STATUS_COLOR: Record<CreditApplication['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
};

const CreditAdmin: React.FC = () => {
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 날짜 네비게이션
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // 처리 중인 신청 ID
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<Record<string, boolean>>({});

  // 필터: 전체 / 대기만
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  // ── 데이터 로딩 ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE, {
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: CreditApplication[] = await res.json();
      setApplications(data);

      // 날짜 목록 추출 (KST 기준, 유니크, 내림차순)
      const dates = Array.from(
        new Set(data.map((a) => toKSTDateStr(a.created_at)))
      ).sort((a, b) => b.localeCompare(a));
      setAvailableDates(dates);

      // 오늘 또는 최신 날짜로 초기 선택
      if (dates.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        setSelectedDate(dates.includes(today) ? today : dates[0]);
      }
    } catch (e: any) {
      setError(e.message || '목록 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── 날짜 이동 ──────────────────────────────────────────────────
  const currentIdx = availableDates.indexOf(selectedDate);
  const goPrev = () => {
    if (currentIdx < availableDates.length - 1)
      setSelectedDate(availableDates[currentIdx + 1]);
  };
  const goNext = () => {
    if (currentIdx > 0) setSelectedDate(availableDates[currentIdx - 1]);
  };

  // ── 선택 날짜의 신청 목록 (시간순) ────────────────────────────
  const dayApps = applications
    .filter((a) => toKSTDateStr(a.created_at) === selectedDate)
    .filter((a) => (showPendingOnly ? a.status === 'pending' : true))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const todayCount = applications.filter(
    (a) => toKSTDateStr(a.created_at) === new Date().toISOString().slice(0, 10)
  ).length;

  // ── 승인 처리 ──────────────────────────────────────────────────
  const handleApprove = async (app: CreditApplication) => {
    if (!window.confirm(`[${app.user_nickname}] ${app.amount.toLocaleString()}원 충전을 승인하시겠습니까?`)) return;
    setProcessingId(app.id);
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY,
        },
        body: JSON.stringify({ action: 'approve', id: app.id, userId: app.user_id, amount: app.amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '승인 실패');
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id
            ? { ...a, status: 'approved', approved_at: new Date().toISOString() }
            : a
        )
      );
    } catch (e: any) {
      alert(`오류: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ── 거절 처리 ──────────────────────────────────────────────────
  const handleReject = async (app: CreditApplication) => {
    const note = rejectNote[app.id] || '';
    if (!window.confirm(`[${app.user_nickname}] 신청을 거절하시겠습니까?`)) return;
    setProcessingId(app.id);
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY,
        },
        body: JSON.stringify({ action: 'reject', id: app.id, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '거절 실패');
      setApplications((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, status: 'rejected', note } : a
        )
      );
      setRejectOpen((prev) => ({ ...prev, [app.id]: false }));
    } catch (e: any) {
      alert(`오류: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ── 렌더링 ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
          <p className="text-sm font-bold text-gray-400">신청 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-red-500 font-bold">⚠️ {error}</p>
        <button
          onClick={load}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-2xl text-sm font-black"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── 상단 요약 카드 ── */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 text-center">
          <p className="text-xs font-bold text-gray-400 mb-1">전체 신청</p>
          <p className="text-2xl font-black text-gray-900">{applications.length}</p>
        </div>
        <div className="bg-amber-50 rounded-[28px] p-5 shadow-sm border border-amber-100 text-center">
          <p className="text-xs font-bold text-amber-500 mb-1">승인 대기</p>
          <p className="text-2xl font-black text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-[28px] p-5 shadow-sm border border-gray-100 text-center">
          <p className="text-xs font-bold text-gray-400 mb-1">오늘 신청</p>
          <p className="text-2xl font-black text-gray-900">{todayCount}</p>
        </div>
      </div>

      {availableDates.length === 0 ? (
        <div className="bg-white rounded-[40px] p-16 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-gray-400 font-bold">신청 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
          {/* ── 날짜 네비게이터 ── */}
          <div className="border-b border-gray-100 p-4 md:p-6 flex items-center justify-between gap-4">
            <button
              onClick={goPrev}
              disabled={currentIdx >= availableDates.length - 1}
              className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600 font-black disabled:opacity-30 hover:bg-gray-200 transition-colors text-lg"
              title="이전 날짜"
            >
              ‹
            </button>

            <div className="flex-1 text-center">
              <p className="text-lg md:text-xl font-black text-gray-900">
                📅 {selectedDate}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {currentIdx + 1} / {availableDates.length}번째 날짜
              </p>
            </div>

            <button
              onClick={goNext}
              disabled={currentIdx <= 0}
              className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600 font-black disabled:opacity-30 hover:bg-gray-200 transition-colors text-lg"
              title="다음 날짜"
            >
              ›
            </button>
          </div>

          {/* ── 필터 + 새로고침 ── */}
          <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3 bg-gray-50 border-b border-gray-100">
            <div className="flex gap-2">
              <button
                onClick={() => setShowPendingOnly(false)}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${!showPendingOnly ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                전체 ({dayApps.length})
              </button>
              <button
                onClick={() => setShowPendingOnly(true)}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${showPendingOnly ? 'bg-amber-500 text-white' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                대기만
              </button>
            </div>
            <button
              onClick={load}
              className="px-4 py-1.5 rounded-xl text-xs font-black text-gray-500 hover:bg-gray-200 transition-colors"
            >
              ↻ 새로고침
            </button>
          </div>

          {/* ── 신청 목록 ── */}
          {dayApps.length === 0 ? (
            <div className="py-16 text-center text-gray-400 font-bold text-sm">
              해당 날짜에 신청 내역이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {/* 헤더 (데스크톱) */}
              <div className="hidden md:grid grid-cols-[80px_1fr_1fr_1fr_100px_180px] px-6 py-3 text-[11px] font-black text-gray-400 bg-gray-50">
                <span>시간</span>
                <span>신청자</span>
                <span>입금자명</span>
                <span>신청금액</span>
                <span>상태</span>
                <span className="text-right">액션</span>
              </div>

              {dayApps.map((app) => (
                <div key={app.id} className="px-4 md:px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  {/* 모바일 레이아웃 */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-500">
                          {toTimeStr(app.created_at)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${STATUS_COLOR[app.status]}`}>
                          {STATUS_LABEL[app.status]}
                        </span>
                      </div>
                      <span className="text-sm font-black text-gray-900">
                        {app.amount.toLocaleString()}원
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>👤 {app.user_nickname}</span>
                      <span>🏦 {app.depositor_name}</span>
                    </div>
                    <p className="text-[10px] text-gray-300 truncate">{app.id}</p>
                    {app.note && (
                      <p className="text-xs text-red-400">메모: {app.note}</p>
                    )}
                    {app.status === 'pending' && (
                      <div className="space-y-2 pt-1">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(app)}
                            disabled={processingId === app.id}
                            className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-colors disabled:opacity-50"
                          >
                            {processingId === app.id ? '처리 중...' : '✅ 승인'}
                          </button>
                          <button
                            onClick={() =>
                              setRejectOpen((prev) => ({ ...prev, [app.id]: !prev[app.id] }))
                            }
                            className="flex-1 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-black hover:bg-red-100 transition-colors"
                          >
                            ❌ 거절
                          </button>
                        </div>
                        {rejectOpen[app.id] && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="거절 사유 (선택)"
                              value={rejectNote[app.id] || ''}
                              onChange={(e) =>
                                setRejectNote((prev) => ({ ...prev, [app.id]: e.target.value }))
                              }
                              className="flex-1 px-3 py-1.5 text-xs border border-red-200 rounded-xl outline-none"
                            />
                            <button
                              onClick={() => handleReject(app)}
                              disabled={processingId === app.id}
                              className="px-4 py-1.5 bg-red-500 text-white rounded-xl text-xs font-black hover:bg-red-600 disabled:opacity-50"
                            >
                              확인
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {app.status === 'approved' && app.approved_at && (
                      <p className="text-[10px] text-emerald-500">
                        승인: {toKSTDateStr(app.approved_at)} {toTimeStr(app.approved_at)}
                      </p>
                    )}
                  </div>

                  {/* 데스크톱 레이아웃 */}
                  <div className="hidden md:grid grid-cols-[80px_1fr_1fr_1fr_100px_180px] items-center gap-2">
                    <span className="text-xs font-black text-gray-500 tabular-nums">
                      {toTimeStr(app.created_at)}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{app.user_nickname}</p>
                      <p className="text-[10px] text-gray-300 truncate max-w-[120px]">{app.id}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{app.depositor_name}</span>
                    <span className="text-sm font-black text-gray-900">
                      {app.amount.toLocaleString()}<span className="text-xs font-bold text-gray-400 ml-0.5">원</span>
                    </span>
                    <div>
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black ${STATUS_COLOR[app.status]}`}>
                        {STATUS_LABEL[app.status]}
                      </span>
                      {app.note && (
                        <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-[80px]">{app.note}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {app.status === 'pending' && (
                        <>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleApprove(app)}
                              disabled={processingId === app.id}
                              className="px-4 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-colors disabled:opacity-50"
                            >
                              {processingId === app.id ? '...' : '✅ 승인'}
                            </button>
                            <button
                              onClick={() =>
                                setRejectOpen((prev) => ({ ...prev, [app.id]: !prev[app.id] }))
                              }
                              className="px-3 py-1.5 bg-red-50 text-red-500 rounded-xl text-xs font-black hover:bg-red-100 transition-colors"
                            >
                              ❌
                            </button>
                          </div>
                          {rejectOpen[app.id] && (
                            <div className="flex gap-1.5 w-full">
                              <input
                                type="text"
                                placeholder="거절 사유"
                                value={rejectNote[app.id] || ''}
                                onChange={(e) =>
                                  setRejectNote((prev) => ({ ...prev, [app.id]: e.target.value }))
                                }
                                className="flex-1 px-2.5 py-1 text-[11px] border border-red-200 rounded-xl outline-none min-w-0"
                              />
                              <button
                                onClick={() => handleReject(app)}
                                disabled={processingId === app.id}
                                className="px-3 py-1 bg-red-500 text-white rounded-xl text-[11px] font-black hover:bg-red-600 disabled:opacity-50"
                              >
                                확인
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      {app.status === 'approved' && app.approved_at && (
                        <p className="text-[10px] text-emerald-500 text-right">
                          {toKSTDateStr(app.approved_at)}<br />{toTimeStr(app.approved_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreditAdmin;
