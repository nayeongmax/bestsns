import React from 'react';

/** 법적 거래 보관 기간 (전자상거래법 등 준수) */
export const TRADE_RETENTION_YEARS = 5;
export const DISPUTE_RETENTION_YEARS = 3;
export const LOG_RETENTION_MONTHS = 3;
/** 보관 대상: SNS활성화, 채널판매, N잡스토어, 누구나알바 거래내역 */

export const PROHIBITED_WORDS = ['계좌이체', '010', '입금', '전화번호', '핸드폰', '휴대폰'];

export const SNS_PLATFORMS = [
  { id: 'insta', name: '인스타그램', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/600px-Instagram_icon.png' },
  { id: 'youtube', name: '유튜브', icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>') },
  { id: 'facebook', name: '페이스북', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/600px-Facebook_Logo_%282019%29.png' },
  { id: 'naver', name: '네이버', icon: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Naver_Logotype.svg' },
  { id: 'threads', name: '쓰레드', icon: 'https://img.icons8.com/ios-filled/512/threads.png' },
  { id: 'tiktok', name: '틱톡', icon: 'https://img.icons8.com/ios-filled/512/tiktok.png' },
  { id: 'twitter', name: '트위터(X)', icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>') },
  { id: 'pinterest', name: '핀터레스트', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png' },
  { id: 'tumblr', name: '텀블러', icon: 'https://img.icons8.com/ios-filled/512/tumblr.png' },
  { id: 'daangn', name: '당근', icon: 'https://img.icons8.com/color/512/carrot--v1.png' },
  { id: 'kakaotalk', name: '카카오톡', icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5.5" fill="#FAE100"/><path fill="#391B1B" d="M12 4.8C7.58 4.8 4 7.72 4 11.3c0 2.28 1.43 4.27 3.6 5.5l-.76 2.83 3.3-2.17c.6.09 1.22.14 1.86.14 4.42 0 8-2.92 8-6.3S16.42 4.8 12 4.8z"/></svg>') },
  { id: 'appdownload', name: '앱다운로드', icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><linearGradient id="a" x1="35.524%" y1="104.619%" x2="64.476%" y2="-4.619%" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#00A0FF"/><stop offset="1" stop-color="#00A1FF"/></linearGradient><path fill="url(#a)" d="M32.2 0C19.4 0 9.1 10.9 9.1 24.3v463.4c0 13.4 10.3 24.3 23.1 24.3l2.3-.2 259.3-259.3v-6.1L34.5.2 32.2 0z"/><linearGradient id="b" x1="83.634%" y1="50%" x2="13.432%" y2="50%" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFE000"/><stop offset="1" stop-color="#FFBD00"/></linearGradient><path fill="url(#b)" d="M381.4 339.5l-86.4-86.4v-6.2l86.4-86.4 1.9 1.1 102.3 58.1c29.2 16.6 29.2 43.7 0 60.3l-102.3 58.1-1.9 1.4z"/><linearGradient id="c" x1="51.333%" y1="55.182%" x2="36.424%" y2="36.059%" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FF3A44"/><stop offset="1" stop-color="#C31162"/></linearGradient><path fill="url(#c)" d="M383.3 338.1L294 248.8 32.2 512c9.6 10.2 25.5 11.5 37.7 3.1l313.4-177z"/><linearGradient id="d" x1="38.429%" y1="63.769%" x2="53.466%" y2="44.507%" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#32A071"/><stop offset="1" stop-color="#2DA771"/></linearGradient><path fill="url(#d)" d="M383.3 159.5L69.9 1C57.7-7.4 41.8-6.1 32.2 4.1L294 243.4l89.3-83.9z"/></svg>') },
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

/** 에이전시형 수수료 체계 (플랫폼 기준) */
export const ADVERTISER_FEE_RATE = 0.25;        // 광고주 수수료 25%
export const FREELANCER_SETTLEMENT_FEE_RATE = 0.05;  // 프리랜서 정산 수수료 5%
export const FREELANCER_WITHHOLDING_RATE = 0.033;   // 프리랜서 원천징수 3.3%
export const PAYMENT_GATEWAY_FEE_RATE = 0.033;      // 결제수수료/결제망 수수료 3.3%
export const VAT_RATE = 0.1;                        // 부가세 10% (광고주 수수료에 대한)

/** 프리랜서 실지급액 = 계약금액 × (1 - 5% - 3.3% - 3.3%) = 88.4% */
export const FREELANCER_FEE_RATE = FREELANCER_SETTLEMENT_FEE_RATE + FREELANCER_WITHHOLDING_RATE + PAYMENT_GATEWAY_FEE_RATE;

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

/** grossAmount: 받는 대금, netAmount: 3.3% 제외 실지급 (수익통장 적립) */
export function addFreelancerEarning(userId: string, grossAmount: number, label: string): number {
  const netAmount = Math.round(grossAmount * (1 - FREELANCER_FEE_RATE));
  const cur = getFreelancerBalance(userId);
  const next = cur + Math.max(0, netAmount);
  setFreelancerBalance(userId, next);
  const entry: FreelancerEarningEntry = {
    id: `earn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'task',
    amount: grossAmount,
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

/** 출금 실패 시 수익통장에 금액 환급 (이미 net 금액이므로 수수료 없이 그대로 충전) */
export function refundFreelancerWithdrawal(userId: string, netAmount: number, label: string): number {
  const cur = getFreelancerBalance(userId);
  const next = cur + Math.max(0, netAmount);
  setFreelancerBalance(userId, next);
  const entry: FreelancerEarningEntry = {
    id: `refund_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'task',
    amount: netAmount,
    label,
    at: new Date().toISOString(),
  };
  const history = getFreelancerHistory(userId);
  localStorage.setItem(FREELANCER_HISTORY_KEY(userId), JSON.stringify([entry, ...history].slice(0, 100)));
  return next;
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

/** 새 작업번호 생성 (ALBA-00123 형식) */
export function generateProjectNo(): string {
  const tasks = getPartTimeTasks();
  let maxN = 0;
  for (const t of tasks) {
    const pn = t.projectNo;
    if (pn && /^ALBA-\d+$/.test(pn)) {
      const n = parseInt(pn.replace('ALBA-', ''), 10);
      if (n > maxN) maxN = n;
    }
  }
  return `ALBA-${String(maxN + 1).padStart(5, '0')}`;
}

/** 6일 경과 자동 승인: autoApproveAt 지난 선정자에게 대금 지급. 광고주 작업의 경우 workLinkSubmittedAt + 6일 후 미확인 시 자동 지급 */
export function processAutoApprovals(): boolean {
  const tasks = getPartTimeTasks();
  const now = Date.now();
  const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
  let changed = false;
  const next = tasks.map((t) => {
    const selectedWithLink = t.applicants.filter((a) => a.selected && ((a.workLinks?.length ?? 0) > 0 || !!(a.workLink || '').trim()));
    if (selectedWithLink.length === 0) return t;
    const updated = { ...t };
    for (const a of selectedWithLink) {
      if (t.paidUserIds?.includes(a.userId)) continue;
      let shouldPay = false;
      if (a.autoApproveAt) {
        const at = new Date(a.autoApproveAt).getTime();
        if (at <= now) shouldPay = true;
      } else if (t.applicantUserId && a.workLinkSubmittedAt) {
        const submittedAt = new Date(a.workLinkSubmittedAt).getTime();
        if (now >= submittedAt + sixDaysMs) shouldPay = true;
      }
      if (shouldPay) {
        addFreelancerEarning(a.userId, t.reward, t.title);
        updated.paidUserIds = [...(updated.paidUserIds || []), a.userId];
        const allSelected = updated.applicants.filter((ap) => ap.selected && ((ap.workLinks?.length ?? 0) > 0 || !!(ap.workLink || '').trim()));
        updated.pointPaid = allSelected.every((ap) => updated.paidUserIds?.includes(ap.userId));
        changed = true;
      }
    }
    return updated;
  });
  if (changed) setPartTimeTasks(next);
  return changed;
}

// ----- 누구나알바 작업의뢰 (광고주→운영진) -----
const PARTTIME_JOB_REQUESTS_KEY = 'parttime_job_requests_v1';
const PARTTIME_JOB_IMAGES_KEY = (id: string) => `parttime_job_images_v1_${id}`;

export function getPartTimeJobRequestImages(id: string): string[] {
  try {
    const raw = localStorage.getItem(PARTTIME_JOB_IMAGES_KEY(id));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function setPartTimeJobRequestImages(id: string, images: string[]): void {
  if (images.length === 0) localStorage.removeItem(PARTTIME_JOB_IMAGES_KEY(id));
  else localStorage.setItem(PARTTIME_JOB_IMAGES_KEY(id), JSON.stringify(images));
}

export function getPartTimeJobRequests(): PartTimeJobRequest[] {
  try {
    const raw = localStorage.getItem(PARTTIME_JOB_REQUESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((r: PartTimeJobRequest) => {
          const imgs = getPartTimeJobRequestImages(r.id);
          return imgs.length > 0 ? { ...r, exampleImages: imgs } : r;
        });
      }
    }
  } catch {}
  return [];
}

export function setPartTimeJobRequests(requests: PartTimeJobRequest[]): void {
  const toStore = requests.map((r) => {
    const { exampleImages, ...rest } = r;
    setPartTimeJobRequestImages(r.id, exampleImages ?? []);
    return rest;
  });
  localStorage.setItem(PARTTIME_JOB_REQUESTS_KEY, JSON.stringify(toStore));
}

/** 광고금액 기준 플랫폼 수수료: 광고주 수수료 25% + 부가세 10% */
export function calcJobRequestFee(adAmount: number): number {
  const baseFee = Math.round(adAmount * ADVERTISER_FEE_RATE); // 25%
  const vat = Math.round(baseFee * VAT_RATE); // 10%
  return baseFee + vat;
}

/** 광고주 총 결제금액: 광고금액 + 플랫폼수수료(25%+부가세10%) + 결제망수수료 3.3% */
export function calcAdvertiserTotalPayment(adAmount: number): number {
  const platformFee = calcJobRequestFee(adAmount);
  const beforePg = adAmount + platformFee;
  const pgFee = Math.round(beforePg * PAYMENT_GATEWAY_FEE_RATE);
  return beforePg + pgFee;
}

/** localStorage 용량 제한(약 5MB) 방지 - 증빙 이미지 강력 압축. 최대 480px, JPEG 0.45 → 약 30~80KB */
export function compressImageForStorage(dataUrl: string, maxSize = 480, quality = 0.45): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}
