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
import type { FreelancerEarningEntry } from '@/types';

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
    label: '출금',
    at: new Date().toISOString(),
  };
  const history = getFreelancerHistory(userId);
  localStorage.setItem(FREELANCER_HISTORY_KEY(userId), JSON.stringify([entry, ...history].slice(0, 100)));
  return { success: true, newBalance: next };
}
