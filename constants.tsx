import React from 'react';

export const PROHIBITED_WORDS = ['계좌이체', '010', '입금', '전화번호', '핸드폰', '휴대폰'];

export const SNS_PLATFORMS = [
  { id: 'insta', name: '인스타그램', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/600px-Instagram_icon.png' },
  { id: 'youtube', name: '유튜브', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/512px-YouTube_full-color_icon_%282017%29.svg.png' },
  { id: 'facebook', name: '페이스북', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/600px-Facebook_Logo_%282019%29.png' },
  { id: 'naver', name: '네이버', icon: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Naver_Logotype.svg' },
  { id: 'threads', name: '쓰레드', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Threads_%28app%29_logo.svg/512px-Threads_%28app%29_logo.svg.png' },
  { id: 'tiktok', name: '틱톡', icon: 'https://img.icons8.com/ios-filled/512/tiktok.png' },
  { id: 'twitter', name: '트위터(X)', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/X_icon_2.svg/512px-X_icon_2.svg.png' },
  { id: 'pinterest', name: '핀터레스트', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png' },
  { id: 'tumblr', name: '텀블러', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Tumblr.svg/512px-Tumblr.svg.png' },
  { id: 'daangn', name: '당근', icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968841.png' },
  { id: 'kakaotalk', name: '카카오톡', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/KakaoTalk_logo.svg/512px-KakaoTalk_logo.svg.png' },
  { id: 'appdownload', name: '앱다운로드', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Google_Play_Arrow_logo.svg/512px-Google_Play_Arrow_logo.svg.png' },
];

export const EBOOK_CATEGORIES = ['전체', '부업·수익화', '투자·재테크', '창업·취업', '시험·자격증', '직무역량', '취미·라이프'];

export const MARKETING_CATEGORIES = {
  '블로그': ['전체', '블로그 대행', '블로그활성화'],
  '카페': ['전체', '카페 대행', '카페 활성화'],
  '체험단': ['전체', '블로그 체험단', '인스타그램 체험단', '유튜브 체험단'],
  '인스타그램': ['전체', '인스타그램 대행', '인스타그램 활성화'],
  '유튜브': ['전체', '유튜브 대행', '유튜브 활성화'],
  '기타채널': ['전체', '기타채널 대행', '기타채널 활성화'],
  '릴스쇼츠': ['전체', '릴스쇼츠 대행', '릴스쇼츠 활성화'],
  '제작상품': ['전체', '제작']
};

export const CHANNEL_CATEGORIES = [
  '게임', '비즈니스', '뷰티/패션', '음식/맛집', '정보/뉴스', '스포츠', '유머/엔터', '라이프스타일', '기타'
];

// ----- 프리랜서 수익통장 (누구나알바) -----
import type { FreelancerEarningEntry, PartTimeTask, PartTimeJobRequest } from '@/types';

const PARTTIME_TASKS_KEY = 'parttime_tasks_v1';

const FREELANCER_BALANCE_KEY = (userId: string) => `freelancer_earnings_v1_${userId}`;
const FREELANCER_HISTORY_KEY = (userId: string) => `freelancer_earnings_history_v1_${userId}`;

export const MIN_WITHDRAW_FREELANCER = 5000;

export function getFreelancerBalance(userId: string): number {
  try {
    const raw = localStorage.getItem(FREELANCER_BALANCE_KEY(userId));
    return raw ? Math.max(0, Number(raw)) : 0;
  } catch {
    return 0;
  }
}

function setFreelancerBalance(userId: string, amount: number): void {
  const value = Math.max(0, Math.round(amount));
  localStorage.setItem(FREELANCER_BALANCE_KEY(userId), String(value));
}

export function addFreelancerEarning(userId: string, amount: number, label: string): number {
  const cur = getFreelancerBalance(userId);
  const next = cur + Math.max(0, Math.round(amount));
  setFreelancerBalance(userId, next);
  const entry: FreelancerEarningEntry = {
    id: `earn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'task',
    amount,
    label,
    at: new Date().toISOString(),
  };
  const history = getFreelancerHistory(userId);
  localStorage.setItem(FREELANCER_HISTORY_KEY(userId), JSON.stringify([entry, ...history].slice(0, 100)));
  return next;
}

export function getFreelancerHistory(userId: string): FreelancerEarningEntry[] {
  try {
    const raw = localStorage.getItem(FREELANCER_HISTORY_KEY(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 프리랜서 출금 신청 한 건 (PortOne 계좌 입금 대상) */
export interface FreelancerWithdrawRequest {
  id: string;
  userId: string;
  nickname: string;
  amount: number;
  bankName: string;
  accountNo: string;
  ownerName: string;
  requestedAt: string;
  status: 'pending' | 'completed' | 'failed';
}

const FREELANCER_WITHDRAW_REQUESTS_KEY = 'freelancer_withdraw_requests_v1';

export function getFreelancerWithdrawRequests(): FreelancerWithdrawRequest[] {
  try {
    const raw = localStorage.getItem(FREELANCER_WITHDRAW_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addFreelancerWithdrawRequest(req: Omit<FreelancerWithdrawRequest, 'id' | 'requestedAt' | 'status'>): void {
  const list = getFreelancerWithdrawRequests();
  const entry: FreelancerWithdrawRequest = {
    ...req,
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };
  localStorage.setItem(FREELANCER_WITHDRAW_REQUESTS_KEY, JSON.stringify([entry, ...list]));
}

export function updateFreelancerWithdrawRequestStatus(
  id: string,
  status: 'pending' | 'completed' | 'failed'
): void {
  const list = getFreelancerWithdrawRequests().map((r) =>
    r.id === id ? { ...r, status } : r
  );
  localStorage.setItem(FREELANCER_WITHDRAW_REQUESTS_KEY, JSON.stringify(list));
}

export function withdrawFreelancerEarnings(userId: string, amount: number): { success: boolean; newBalance: number } {
  const cur = getFreelancerBalance(userId);
  if (amount < MIN_WITHDRAW_FREELANCER || amount > cur) {
    return { success: false, newBalance: cur };
  }
  const next = cur - amount;
  setFreelancerBalance(userId, next);
  const entry: FreelancerEarningEntry = {
    id: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'withdraw',
    amount: -amount,
    label: '출금 신청',
    at: new Date().toISOString(),
  };
  const history = getFreelancerHistory(userId);
  localStorage.setItem(FREELANCER_HISTORY_KEY(userId), JSON.stringify([entry, ...history].slice(0, 100)));
  return { success: true, newBalance: next };
}

// ----- 누구나알바 작업 목록 -----
const _now = new Date();
const _d = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const DEFAULT_PARTTIME_TASKS: PartTimeTask[] = [
  {
    id: 't1',
    title: '간단 설문 참여',
    description: '1분 소요 설문에 참여해 주세요.',
    category: '설문',
    reward: 300,
    sections: { 제목: '설문 제목', 내용: '아래 링크에서 설문 10문항에 답해 주세요.', 댓글: '없음', 키워드: '설문, 참여', 이미지: '없음' },
    applicationPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 1), end: _d(_now.getFullYear(), _now.getMonth() + 1, 15) },
    workPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 16), end: _d(_now.getFullYear(), _now.getMonth() + 1, 20) },
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    applicants: [],
    pointPaid: false,
    paidUserIds: [],
  },
  {
    id: 't2',
    title: 'SNS 공유 인증',
    description: '지정 포스트 공유 후 캡처 제출',
    category: 'SNS',
    reward: 500,
    sections: { 제목: '공유할 포스트 제목', 내용: '본문 그대로 공유해 주세요.', 댓글: '공유 인증 댓글 작성', 키워드: '#해시태그1 #해시태그2', 이미지: 'jpg, png (캡처본 제출)' },
    applicationPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 1), end: _d(_now.getFullYear(), _now.getMonth() + 1, 10) },
    workPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 11), end: _d(_now.getFullYear(), _now.getMonth() + 1, 15) },
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    applicants: [],
    pointPaid: false,
    paidUserIds: [],
  },
  {
    id: 't3',
    title: '카페 글 작성',
    description: '지정 네이버카페에 글을 작성해 주세요.',
    category: '네이버카페',
    reward: 600,
    sections: {
      제목: '예시: OO 사용 후기 남깁니다',
      내용: '최소 500자 이상 작성. 사용 경험, 장단점을 포함해 주세요.',
      댓글: '댓글 2건 이상 달아 주세요.',
      키워드: '키워드1, 키워드2, 키워드3 (본문에 자연스럽게 포함)',
      이미지: 'jpg 또는 gif 1장 이상 (본문 첨부)',
    },
    applicationPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 1), end: _d(_now.getFullYear(), _now.getMonth() + 1, 12) },
    workPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 13), end: _d(_now.getFullYear(), _now.getMonth() + 1, 18) },
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    applicants: [],
    pointPaid: false,
    paidUserIds: [],
  },
  {
    id: 't4',
    title: '리뷰 작성',
    description: '이용 후 리뷰 한 건 작성',
    category: '리뷰',
    reward: 400,
    sections: { 제목: '리뷰 제목 (자유)', 내용: '200자 이상 리뷰 내용', 댓글: '없음', 키워드: '없음', 이미지: '선택 (jpg)' },
    applicationPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 5), end: _d(_now.getFullYear(), _now.getMonth() + 1, 14) },
    workPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 15), end: _d(_now.getFullYear(), _now.getMonth() + 1, 19) },
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    applicants: [],
    pointPaid: false,
    paidUserIds: [],
  },
  {
    id: 't5',
    title: '콘텐츠 검수',
    description: '짧은 텍스트/이미지 검수',
    category: '검수',
    reward: 600,
    sections: { 제목: '검수 대상 제목', 내용: '오타, 어색한 표현 확인', 댓글: '수정 제안 댓글', 키워드: '없음', 이미지: '이미지 적합성 확인 (jpg, gif)' },
    applicationPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 1), end: _d(_now.getFullYear(), _now.getMonth() + 1, 8) },
    workPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 9), end: _d(_now.getFullYear(), _now.getMonth() + 1, 12) },
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    applicants: [],
    pointPaid: false,
    paidUserIds: [],
  },
  {
    id: 't6',
    title: '번역/교정 (1페이지)',
    description: 'A4 1페이지 분량 번역 또는 교정',
    category: '번역',
    reward: 1500,
    sections: { 제목: '원문 제목', 내용: '원문 내용 (번역 또는 교정)', 댓글: '없음', 키워드: '없음', 이미지: '없음' },
    applicationPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 1), end: _d(_now.getFullYear(), _now.getMonth() + 1, 20) },
    workPeriod: { start: _d(_now.getFullYear(), _now.getMonth() + 1, 21), end: _d(_now.getFullYear(), _now.getMonth() + 1, 25) },
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    applicants: [],
    pointPaid: false,
    paidUserIds: [],
  },
];

export function getPartTimeTasks(): PartTimeTask[] {
  try {
    const raw = localStorage.getItem(PARTTIME_TASKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_PARTTIME_TASKS.map((t) => ({ ...t, applicants: [...(t.applicants || [])], pointPaid: t.pointPaid ?? false, paidUserIds: t.paidUserIds || [] }));
}

export function setPartTimeTasks(tasks: PartTimeTask[]): void {
  localStorage.setItem(PARTTIME_TASKS_KEY, JSON.stringify(tasks));
}

// ----- 누구나알바 작업의뢰 (광고주→운영진) -----
const PARTTIME_JOB_REQUESTS_KEY = 'parttime_job_requests_v1';

export function getPartTimeJobRequests(): PartTimeJobRequest[] {
  try {
    const raw = localStorage.getItem(PARTTIME_JOB_REQUESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function setPartTimeJobRequests(requests: PartTimeJobRequest[]): void {
  localStorage.setItem(PARTTIME_JOB_REQUESTS_KEY, JSON.stringify(requests));
}

/** 광고금액 기준 수수료 계산: 15% + 부가세 10% */
export function calcJobRequestFee(adAmount: number): number {
  const baseFee = Math.round(adAmount * 0.15);
  const vat = Math.round(baseFee * 0.1);
  return baseFee + vat;
}
