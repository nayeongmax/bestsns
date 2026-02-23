import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { 
  UserProfile, SMMOrder, ChannelOrder, StoreOrder, EbookProduct, 
  ChannelProduct, SiteNotification, Notice, Post, Review, WishlistItem, Coupon, AutoCouponCampaign,
  SMMProvider, SMMProduct, NotificationType, GradeConfig
} from '@/types';
import { supabase } from './supabase';
import { fetchStoreProducts, fetchStoreOrders, fetchReviews, upsertStoreProducts, upsertStoreOrders, upsertReviews } from './storeDb';
import { fetchChannelProducts, fetchChannelOrders, upsertChannelProducts, upsertChannelOrders } from './channelDb';
import { fetchSmmOrders, fetchSmmProviders, fetchSmmProducts, upsertSmmOrders, upsertSmmProviders, upsertSmmProducts, deleteSmmProductsByIds } from './smmDb';
import { updateProfile, fetchProfileRow } from './profileDb';
import { fetchNotices, upsertNotices, fetchGradeConfigs, upsertGradeConfigs, fetchPosts, upsertPosts } from './siteDb';

/** Supabase profiles 행 → UserProfile 변환 (profileUtils 의존 제거로 Netlify 빌드 안정화) */
function profileRowToUserProfile(row: Record<string, unknown>): UserProfile {
  const id = String(row.id ?? '');
  const nickname = String((row.nickname ?? row.id ?? id) || 'Unknown');
  const profileImage = String(row.profile_image ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`);
  return {
    id,
    nickname,
    profileImage,
    role: (row.role as UserProfile['role']) ?? 'user',
    email: row.email != null ? String(row.email) : undefined,
    phone: row.phone != null ? String(row.phone) : undefined,
    points: Number(row.points ?? 0),
    manualGrade: row.manual_grade != null ? String(row.manual_grade) : undefined,
    coupons: Array.isArray(row.coupons) ? (row.coupons as UserProfile['coupons']) : (row.coupons as UserProfile['coupons']) ?? [],
    totalPurchaseAmount: Number(row.total_purchase_amount ?? 0),
    totalSalesAmount: Number(row.total_sales_amount ?? 0),
    freelancerEarnings: Number(row.total_freelancer_earnings ?? 0),
    joinDate: row.join_date != null ? String(row.join_date) : undefined,
    sellerStatus: (row.seller_status as UserProfile['sellerStatus']) ?? 'none',
    freelancerStatus: (row.freelancer_status as UserProfile['freelancerStatus']) ?? 'none',
    sellerApplication: (row.seller_application as UserProfile['sellerApplication']) ?? undefined,
    pendingApplication: (row.pending_application as UserProfile['pendingApplication']) ?? undefined,
    freelancerApplication: (row.freelancer_application as UserProfile['freelancerApplication']) ?? undefined,
    violationCount: Number(row.violation_count ?? 0),
  };
}

// Page and Component Imports (루트 기준 @/ 사용 - Netlify 빌드 시 해석 기준 오류 방지)
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LiveNotification from '@/components/LiveNotification';
import SNSActivation from '@/pages/SNSActivation';
import ChannelSales from '@/pages/ChannelSales';
import EbookSales from '@/pages/EbookSales';
import AIConsulting from '@/pages/AIConsulting';
import FreeBoard from '@/pages/FreeBoard';
import RevenueManagement from '@/pages/RevenueManagement';
import ProfitManagement from '@/pages/ProfitManagement';
import ChatPage from '@/pages/ChatPage';
import MyPage from '@/pages/MyPage';
import AdminPanel from '@/pages/AdminPanel';
import NotificationsPage from '@/pages/NotificationsPage';
import FreeBoardWrite from '@/pages/FreeBoardWrite';
import FreeBoardDetail from '@/pages/FreeBoardDetail';
import PointPayment from '@/pages/PointPayment';
import AlbaPaymentPage from '@/pages/AlbaPaymentPage';
import CouponBox from '@/pages/CouponBox';
import NoticePage from '@/pages/NoticePage';
import TermsPage from '@/pages/TermsPage';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import ReviewWritePage from '@/pages/ReviewWritePage';
import AuthPage from '@/pages/AuthPage';
import ChannelDetail from '@/pages/ChannelDetail';
import EbookDetail from '@/pages/EbookDetail';
import EbookRegistration from '@/pages/EbookRegistration';
import WishlistPage from '@/pages/WishlistPage';
import PartTimePage, { PartTimeTaskRegister } from '@/pages/PartTimePage';
import PartTimeTaskDetail from '@/pages/PartTimeTaskDetail';
import PartTimeJobRequestPage from '@/pages/PartTimeJobRequestPage';

/** pathname이 /ebooks일 때 항상 EbookSales만 렌더 (다른 라우트 간섭 방지) */
function ContainerRoutes(props: {
  ebooks: any[]; setEbooks: React.Dispatch<React.SetStateAction<any[]>>;
  user: UserProfile | null; wishlist: WishlistItem[]; wishlistToggle: (i: WishlistItem) => void;
  smmProducts: any[]; smmProviders: any[]; smmOrders: any[]; notices: any[]; setSmmOrders: React.Dispatch<React.SetStateAction<any[]>>; addNotif: (userId: string, type: NotificationType, title: string, body: string) => void; handleLogout: () => void;
  channels: any[]; setChannels: React.Dispatch<React.SetStateAction<any[]>>; reviews: any[]; members: UserProfile[]; setMembers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  storeOrders: any[]; channelOrders: any[]; posts: any[]; setPosts: React.Dispatch<React.SetStateAction<any[]>>; setReviews: React.Dispatch<React.SetStateAction<Review[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<SiteNotification[]>>; notifications: SiteNotification[]; setStoreOrders: React.Dispatch<React.SetStateAction<any[]>>; setChannelOrders: React.Dispatch<React.SetStateAction<any[]>>;
  handleGlobalUserUpdate: (u: UserProfile) => void; handleLoginSuccess: (u: UserProfile) => void;
  setSmmProviders: React.Dispatch<React.SetStateAction<any[]>>; setSmmProducts: React.Dispatch<React.SetStateAction<any[]>>; setNotices: React.Dispatch<React.SetStateAction<Notice[]>>;
  handleMassIssueCoupons: () => void;
  gradeConfigs: GradeConfig[]; setGradeConfigs: React.Dispatch<React.SetStateAction<GradeConfig[]>>;
  onRefreshMembers?: () => void;
  onRefetchProfile?: () => void;
  onDeleteSmmProducts?: (ids: string[]) => void;
}) {
  const location = useLocation();
  const pathname = location.pathname || '';
  if (pathname === '/ebooks') {
    return (
      <EbookSales
        ebooks={props.ebooks}
        setEbooks={props.setEbooks}
        user={props.user || { id: '', nickname: 'Guest', profileImage: '', role: 'user' }}
        wishlist={props.wishlist}
        onToggleWishlist={props.wishlistToggle}
        members={props.members}
        gradeConfigs={props.gradeConfigs}
      />
    );
  }
  return (
    <Routes>
      <Route path="/ebooks" element={<EbookSales ebooks={props.ebooks} setEbooks={props.setEbooks} user={props.user || { id: '', nickname: 'Guest', profileImage: '', role: 'user' }} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} members={props.members} gradeConfigs={props.gradeConfigs} />} />
      <Route path="/sns" element={<SNSActivation smmProducts={props.smmProducts} providers={props.smmProviders} user={props.user || { id: '', nickname: 'Guest', profileImage: '', role: 'user', points: 12500 }} notices={props.notices} onOrderComplete={(o) => { props.setSmmOrders(prev => [o, ...prev]); if (props.user) props.addNotif(props.user.id, 'sns_activation', '📈 SNS 활성화 주문 접수', `[${o.productName}] 주문이 접수되었습니다.`); }} onLogout={props.handleLogout} />} />
      <Route path="/channels" element={<ChannelSales channels={props.channels} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} />} />
      <Route path="/channels/:id" element={<ChannelDetail channels={props.channels} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} reviews={props.reviews} members={props.members} />} />
      <Route path="/ebooks/:id" element={props.user ? <EbookDetail ebooks={props.ebooks} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} user={props.user} reviews={props.reviews} storeOrders={props.storeOrders} members={props.members} gradeConfigs={props.gradeConfigs} /> : <Navigate to="/login" />} />
      <Route path="/ebooks/register" element={props.user ? <EbookRegistration user={props.user} setEbooks={props.setEbooks} /> : <Navigate to="/login" />} />
      <Route path="/part-time" element={<PartTimePage user={props.user} onUpdateUser={props.handleGlobalUserUpdate} />} />
      <Route path="/part-time/register" element={<PartTimeTaskRegister user={props.user} members={props.members} />} />
      <Route path="/part-time/request" element={props.user ? <PartTimeJobRequestPage user={props.user} addNotif={props.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/part-time/:taskId" element={<PartTimeTaskDetail user={props.user} members={props.members} onUpdateUser={props.handleGlobalUserUpdate} addNotif={props.addNotif} />} />
      <Route path="/ai" element={<AIConsulting user={props.user} />} />
      <Route path="/board" element={<FreeBoard posts={props.posts} notices={props.notices} members={props.members} gradeConfigs={props.gradeConfigs} />} />
      <Route path="/board/:id" element={props.user ? <FreeBoardDetail user={props.user} posts={props.posts} setPosts={props.setPosts} members={props.members} gradeConfigs={props.gradeConfigs} /> : <Navigate to="/login" />} />
      <Route path="/board/write" element={props.user ? <FreeBoardWrite user={props.user} posts={props.posts} setPosts={props.setPosts} /> : <Navigate to="/login" />} />
      <Route path="/revenue" element={props.user ? <RevenueManagement user={props.user} /> : <Navigate to="/login" />} />
      <Route path="/profit-mgmt" element={props.user ? <ProfitManagement user={props.user} storeOrders={props.storeOrders} /> : <Navigate to="/login" />} />
      <Route path="/chat" element={props.user ? <ChatPage user={props.user} members={props.members} addNotif={props.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/mypage" element={props.user ? <MyPage user={props.user} members={props.members} onUpdate={props.handleGlobalUserUpdate} ebooks={props.ebooks} setEbooks={props.setEbooks} channels={props.channels} smmOrders={props.smmOrders} channelOrders={props.channelOrders} storeOrders={props.storeOrders} onAddReview={(r)=>props.setReviews(prev=>[r,...prev])} onUpdateReview={(r)=>props.setReviews(prev=>prev.map(i=>i.id===r.id?r:i))} reviews={props.reviews} addNotif={props.addNotif} onRefetchProfile={props.onRefetchProfile} gradeConfigs={props.gradeConfigs} /> : <Navigate to="/login" />} />
      <Route path="/notifications" element={props.user ? <NotificationsPage notifications={props.notifications} setNotifications={props.setNotifications} user={props.user} /> : <Navigate to="/login" />} />
      <Route path="/wishlist" element={<WishlistPage wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} channels={props.channels} ebooks={props.ebooks} />} />
      <Route path="/coupons" element={props.user ? <CouponBox user={props.user} /> : <Navigate to="/login" />} />
      <Route path="/payment/point" element={props.user ? <PointPayment user={props.user} ebooks={props.ebooks} channels={props.channels} members={props.members} onUpdateUser={props.handleGlobalUserUpdate} addNotif={props.addNotif} setChannelOrders={props.setChannelOrders} setStoreOrders={props.setStoreOrders} /> : <Navigate to="/login" />} />
      <Route path="/payment/alba" element={props.user ? <AlbaPaymentPage user={props.user} addNotif={props.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/review/write" element={props.user ? <ReviewWritePage user={props.user} onAddReview={(r)=>props.setReviews(prev=>[r,...prev])} /> : <Navigate to="/login" />} />
      <Route path="/admin" element={props.user ? <AdminPanel user={props.user} ebooks={props.ebooks} setEbooks={props.setEbooks} channels={props.channels} setChannels={props.setChannels} setNotifications={props.setNotifications} smmProviders={props.smmProviders} setSmmProviders={props.setSmmProviders} smmProducts={props.smmProducts} setSmmProducts={props.setSmmProducts} onDeleteSmmProducts={props.onDeleteSmmProducts} smmOrders={props.smmOrders} members={props.members} setMembers={props.setMembers} channelOrders={props.channelOrders} storeOrders={props.storeOrders} onIssueCoupons={props.handleMassIssueCoupons} addNotif={props.addNotif} gradeConfigs={props.gradeConfigs} setGradeConfigs={props.setGradeConfigs} reviews={props.reviews} setReviews={props.setReviews} onUpdateUser={props.handleGlobalUserUpdate} onRefreshMembers={props.onRefreshMembers} /> : <Navigate to="/login" />} />
      <Route path="/notices" element={<NoticePage notices={props.notices} setNotices={props.setNotices} user={props.user || { id: '', nickname: 'Guest', role: 'user', profileImage: '', points: 0 }} />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/login" element={<AuthPage onLoginSuccess={props.handleLoginSuccess} />} />
      <Route path="/" element={<Navigate to="/sns" />} />
    </Routes>
  );
}

function safeStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const App: React.FC = () => {
  const location = useLocation();
  const [members, setMembers] = useState<UserProfile[]>(() => safeStorage('site_members_v2', []));
  const [user, setUser] = useState<UserProfile | null>(() => safeStorage<UserProfile | null>('user_profile_v2', null));
  const [notifications, setNotifications] = useState<SiteNotification[]>(() => safeStorage('site_notifications_v2', []));
  const [smmOrders, setSmmOrders] = useState<SMMOrder[]>(() => safeStorage('smm_orders_v2', []));
  const [smmProviders, setSmmProviders] = useState<SMMProvider[]>(() => safeStorage('site_smm_providers_v2', []));
  const [smmProducts, setSmmProducts] = useState<SMMProduct[]>(() => safeStorage('site_smm_products_v2', []));
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>(() => safeStorage('store_orders_v2', []));
  const [channelOrders, setChannelOrders] = useState<ChannelOrder[]>(() => safeStorage('channel_orders_v2', []));
  const [ebooks, setEbooks] = useState<EbookProduct[]>(() => safeStorage('site_ebooks_v2', []));
  const [channels, setChannels] = useState<ChannelProduct[]>(() => safeStorage('site_channels_v2', []));
  const [posts, setPosts] = useState<Post[]>(() => safeStorage('site_posts_v2', []));
  const [reviews, setReviews] = useState<Review[]>(() => safeStorage('site_reviews_v2', []));
  const [notices, setNotices] = useState<Notice[]>(() => safeStorage('site_notices_v2', []));
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [gradeConfigs, setGradeConfigs] = useState<GradeConfig[]>(() => {
    const saved = localStorage.getItem('grade_configs_v2');
    if (!saved) return [
      { id: 'g1', name: 'STANDARD', target: 'both', minSales: 0, minPurchase: 0, color: 'bg-gray-400', sortOrder: 0 },
      { id: 'g2', name: 'Prime', target: 'seller', minSales: 10000000, minPurchase: 0, color: 'bg-amber-500', sortOrder: 10 },
      { id: 'g3', name: 'MASTER', target: 'seller', minSales: 50000000, minPurchase: 0, color: 'bg-gray-900', sortOrder: 20 },
    ];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.map((g: any) => ({
        ...g,
        target: g.target || 'both',
        minPurchase: g.minPurchase ?? 0,
        sortOrder: g.sortOrder ?? 0,
      })) : parsed;
    } catch { return []; }
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const storeDbLoaded = useRef(false);

  useEffect(() => { localStorage.setItem('grade_configs_v2', JSON.stringify(gradeConfigs)); }, [gradeConfigs]);

  const channelDbLoaded = useRef(false);
  const smmDbLoaded = useRef(false);
  const siteDbLoaded = useRef(false);

  // N잡스토어 + 채널판매: Supabase 로드 (실패 시 1회 재시도 — 쿠키/캐시 삭제 후에도 상품이 보이도록)
  useEffect(() => {
    let cancelled = false;
    const load = async (isRetry: boolean) => {
      try {
        const [products, orders, reviewList, channelProducts, channelOrderList] = await Promise.all([
          fetchStoreProducts(),
          fetchStoreOrders(),
          fetchReviews(),
          fetchChannelProducts(),
          fetchChannelOrders(),
        ]);
        if (!cancelled) {
          setEbooks(products);
          setStoreOrders(orders);
          setReviews(reviewList);
          setChannels(channelProducts);
          setChannelOrders(channelOrderList);
          storeDbLoaded.current = true;
          channelDbLoaded.current = true;
        }
      } catch (e) {
        if (cancelled) return;
        console.warn(
          isRetry ? '스토어/채널 DB 재시도도 실패' : '스토어/채널 DB 로드 실패, 1.5초 후 재시도합니다.',
          e
        );
        if (!isRetry) {
          await new Promise((r) => setTimeout(r, 1500));
          if (!cancelled) load(true);
        } else {
          console.warn(
            '[Supabase] 배포 환경(Netlify 등)에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 설정되어 있는지 확인하세요. 설정 없으면 상품 목록이 비어 보입니다.'
          );
          storeDbLoaded.current = true;
          channelDbLoaded.current = true;
        }
      }
    };
    load(false);
    return () => { cancelled = true; };
  }, []);

  // SNS활성화: 주문/공급처/상품 Supabase 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [orders, providers, products] = await Promise.all([
          fetchSmmOrders(),
          fetchSmmProviders(),
          fetchSmmProducts(),
        ]);
        if (!cancelled) {
          setSmmOrders(orders);
          setSmmProviders(providers);
          setSmmProducts(products);
          smmDbLoaded.current = true;
        }
      } catch (e) {
        if (!cancelled) console.warn('SNS활성화 DB 로드 실패, localStorage 사용:', e);
        smmDbLoaded.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 공지/등급/게시글: Supabase 로드 (1·2·5단계 테이블)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [noticeList, gradeList, postList] = await Promise.all([
          fetchNotices(),
          fetchGradeConfigs(),
          fetchPosts(),
        ]);
        if (!cancelled) {
          setNotices(noticeList);
          setGradeConfigs(gradeList);
          setPosts(postList);
          siteDbLoaded.current = true;
        }
      } catch (e) {
        if (!cancelled) console.warn('공지/등급/게시글 DB 로드 실패, localStorage 사용:', e);
        siteDbLoaded.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // N잡스토어: 상품/주문/리뷰 변경 시 DB 저장
  useEffect(() => {
    if (!storeDbLoaded.current) return;
    upsertStoreProducts(ebooks).catch((e) => console.warn('store_products 저장:', e));
  }, [ebooks]);
  useEffect(() => {
    if (!storeDbLoaded.current) return;
    upsertStoreOrders(storeOrders).catch((e) => console.warn('store_orders 저장:', e));
  }, [storeOrders]);
  useEffect(() => {
    if (!storeDbLoaded.current) return;
    upsertReviews(reviews).catch((e) => console.warn('reviews 저장:', e));
  }, [reviews]);

  // 채널판매: 상품/주문 변경 시 DB 저장 (실패 시 알림 — RLS 또는 env 미설정 시 저장 안 됨)
  useEffect(() => {
    if (!channelDbLoaded.current) return;
    if (channels.length === 0) return;
    upsertChannelProducts(channels).catch((e) => {
      console.warn('channel_products 저장 실패:', e);
      alert('채널 상품이 DB에 저장되지 않았습니다. Supabase RLS 정책(supabase-rls-public-read-channel-store.sql) 적용 여부와 VITE_SUPABASE_URL·ANON_KEY 설정을 확인해 주세요.');
    });
  }, [channels]);
  useEffect(() => {
    if (!channelDbLoaded.current) return;
    upsertChannelOrders(channelOrders).catch((e) => console.warn('channel_orders 저장:', e));
  }, [channelOrders]);

  // SNS활성화: 주문/공급처/상품 변경 시 DB 저장
  useEffect(() => {
    if (!smmDbLoaded.current) return;
    upsertSmmOrders(smmOrders).catch((e) => console.warn('smm_orders 저장:', e));
  }, [smmOrders]);
  useEffect(() => {
    if (!smmDbLoaded.current) return;
    upsertSmmProviders(smmProviders).catch((e) => console.warn('smm_providers 저장:', e));
  }, [smmProviders]);
  useEffect(() => {
    if (!smmDbLoaded.current) return;
    upsertSmmProducts(smmProducts).catch((e) => console.warn('smm_products 저장:', e));
  }, [smmProducts]);

  // 공지/등급/게시글: 변경 시 DB 저장
  useEffect(() => {
    if (!siteDbLoaded.current) return;
    upsertNotices(notices).catch((e) => console.warn('site_notices 저장:', e));
  }, [notices]);
  useEffect(() => {
    if (!siteDbLoaded.current) return;
    upsertGradeConfigs(gradeConfigs).catch((e) => console.warn('grade_configs 저장:', e));
  }, [gradeConfigs]);
  useEffect(() => {
    if (!siteDbLoaded.current) return;
    upsertPosts(posts).catch((e) => console.warn('site_posts 저장:', e));
  }, [posts]);

  // 사이트 접속 로그: 로그인한 사용자 접속 시 기록 (2분당 1회 제한)
  const lastAccessLog = useRef<{ userId: string; at: number }>({ userId: '', at: 0 });
  useEffect(() => {
    if (!user?.id) return;
    const now = Date.now();
    if (lastAccessLog.current.userId === user.id && now - lastAccessLog.current.at < 120000) return;
    lastAccessLog.current = { userId: user.id, at: now };
    const id = `SAL_${now}_${Math.random().toString(36).slice(2, 9)}`;
    supabase.from('site_access_log').insert({ id, user_id: user.id, path: location.pathname || null }).then(() => {});
  }, [user?.id, location.pathname]);

  // 찜(user_wishlist) 로드 - 로그인 시, DB 실패/빈값이면 localStorage 복원
  useEffect(() => {
    if (!user?.id) return;
    const storageKey = `wishlist_v2_${user.id}`;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('user_wishlist').select('item_type, item_id').eq('user_id', user.id);
        if (cancelled) return;
        if (error) {
          const fallback = (() => {
            try {
              const raw = localStorage.getItem(storageKey);
              return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
            } catch { return []; }
          })();
          setWishlist(Array.isArray(fallback) ? fallback : []);
          return;
        }
        if (data && data.length > 0) {
          const items: WishlistItem[] = [];
          for (const row of data as { item_type: string; item_id: string }[]) {
            if (row.item_type === 'channel') {
              const ch = channels.find((c: ChannelProduct) => c.id === row.item_id);
              if (ch) items.push({ type: 'channel', data: ch });
            } else if (row.item_type === 'ebook') {
              const eb = ebooks.find((e: EbookProduct) => e.id === row.item_id);
              if (eb) items.push({ type: 'ebook', data: eb });
            }
          }
          setWishlist(items);
        } else {
          const fallback = (() => {
            try {
              const raw = localStorage.getItem(storageKey);
              return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
            } catch { return []; }
          })();
          setWishlist(Array.isArray(fallback) ? fallback : []);
        }
      } catch (_) {
        if (!cancelled) {
          try {
            const raw = localStorage.getItem(storageKey);
            const fallback = raw ? (JSON.parse(raw) as WishlistItem[]) : [];
            setWishlist(Array.isArray(fallback) ? fallback : []);
          } catch { setWishlist([]); }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, channels, ebooks]);

  // 알림(site_notifications) 로드 - 로그인 시, DB 빈값/에러면 기존(localStorage) 유지
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('site_notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (cancelled) return;
        if (error) return; // 에러 시 setNotifications 호출 안 함 → 기존 값 유지
        if (data && data.length > 0) {
          const list: SiteNotification[] = (data as any[]).map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            type: r.type,
            title: r.title,
            message: r.message,
            reason: r.reason,
            isRead: r.is_read ?? false,
            createdAt: r.created_at || new Date().toISOString(),
          }));
          setNotifications(list);
        }
        // data가 빈 배열이면 setNotifications 호출 안 함 → 기존 값 유지
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // 회원 목록 단일 소스: Supabase profiles에서 로드 (DEPLOY 가이드)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (cancelled) return;
        if (error) {
          console.warn('[Supabase] profiles 로드 실패 → RLS 또는 env 확인. 에러:', error.message);
          return;
        }
        if (data && data.length > 0) {
          const parsed = data
            .map((r: Record<string, unknown>) => profileRowToUserProfile(r))
            .filter((p: UserProfile) => p.id);
          setMembers(parsed);
        }
      } catch (e) {
        if (!cancelled) console.warn('profiles fetch 오류:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('site_members_v2', JSON.stringify(members));
    } catch {
      console.warn('회원 목록 저장 실패 (localStorage 용량 초과)');
    }
  }, [members]);

  // 회원 목록(DB) 로드 후 현재 로그인 유저의 포인트·수익을 DB 기준으로 동기화 (돈이 0으로 바뀌는 현상 방지)
  useEffect(() => {
    if (!user?.id || members.length === 0) return;
    const fromDb = members.find(m => m.id.toLowerCase() === user.id.toLowerCase());
    if (!fromDb) return;
    const same =
      (fromDb.points ?? 0) === (user.points ?? 0) &&
      (fromDb.totalPurchaseAmount ?? 0) === (user.totalPurchaseAmount ?? 0) &&
      (fromDb.totalSalesAmount ?? 0) === (user.totalSalesAmount ?? 0) &&
      (fromDb.freelancerEarnings ?? 0) === (user.freelancerEarnings ?? 0);
    if (!same) setUser(prev => prev ? { ...prev, points: fromDb.points, totalPurchaseAmount: fromDb.totalPurchaseAmount, totalSalesAmount: fromDb.totalSalesAmount, freelancerEarnings: fromDb.freelancerEarnings, coupons: fromDb.coupons ?? prev.coupons } : null);
  }, [members, user?.id, user?.points, user?.totalPurchaseAmount, user?.totalSalesAmount, user?.freelancerEarnings]);

  useEffect(() => {
    try {
      localStorage.setItem('user_profile_v2', JSON.stringify(user));
    } catch (err: unknown) {
      console.error('프로필 저장 실패 (localStorage 용량 초과 가능):', err);
      const isQuota = err instanceof DOMException && err.name === 'QuotaExceededError';
      const isStorage = err instanceof Error && (err.message?.includes('Storage') || err.message?.includes('setItem'));
      if (isQuota || isStorage) {
        alert('저장 공간이 부족합니다. 브라우저 캐시·데이터를 정리한 후 다시 시도해 주세요.');
      }
    }
  }, [user]);
  useEffect(() => { localStorage.setItem('site_notifications_v2', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('smm_orders_v2', JSON.stringify(smmOrders)); }, [smmOrders]);
  useEffect(() => { localStorage.setItem('store_orders_v2', JSON.stringify(storeOrders)); }, [storeOrders]);
  useEffect(() => { localStorage.setItem('channel_orders_v2', JSON.stringify(channelOrders)); }, [channelOrders]);
  useEffect(() => { localStorage.setItem('site_ebooks_v2', JSON.stringify(ebooks)); }, [ebooks]);
  useEffect(() => { localStorage.setItem('site_channels_v2', JSON.stringify(channels)); }, [channels]);
  useEffect(() => { localStorage.setItem('site_posts_v2', JSON.stringify(posts)); }, [posts]);
  useEffect(() => { localStorage.setItem('site_reviews_v2', JSON.stringify(reviews)); }, [reviews]);
  useEffect(() => { localStorage.setItem('site_notices_v2', JSON.stringify(notices)); }, [notices]);
  useEffect(() => { localStorage.setItem('site_smm_providers_v2', JSON.stringify(smmProviders)); }, [smmProviders]);
  useEffect(() => { localStorage.setItem('site_smm_products_v2', JSON.stringify(smmProducts)); }, [smmProducts]);

  /** 상품 인벤토리에서 삭제 시 DB에서 즉시 삭제 (새로고침 후에도 삭제 유지) */
  const handleDeleteSmmProducts = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    deleteSmmProductsByIds(ids).catch((e) => console.warn('smm_products 삭제 실패:', e));
    setSmmProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
  }, []);

  const handleGlobalUserUpdate = useCallback((updated: UserProfile) => {
    setUser(updated);
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
  }, []);

  /** 어드민 회원 탭에서 Supabase profiles 전체 재조회 (RLS 적용 후 회원 목록 전체 노출) */
  const refreshMembers = useCallback(() => {
    supabase.from('profiles').select('*').then(({ data, error }) => {
      if (error) {
        console.warn('[Supabase] 회원 목록 재조회 실패 → RLS 적용 여부 확인:', error.message);
        return;
      }
      if (data?.length) {
        const parsed = data.map((r: Record<string, unknown>) => profileRowToUserProfile(r)).filter((p: UserProfile) => p.id);
        setMembers(parsed);
      }
    });
  }, []);

  /** 마이페이지 진입 시 DB에서 포인트·수익 재조회 (쿠키 삭제 후 0으로 바뀌는 현상 방지) */
  const refetchCurrentUserProfile = useCallback(() => {
    if (!user?.id) return;
    fetchProfileRow(user.id).then((row) => {
      if (row) setUser(prev => prev ? { ...prev, ...profileRowToUserProfile(row) } : null);
    }).catch((e) => {
      console.warn('[Supabase] 프로필 재조회 실패(포인트/수익 0으로 보일 수 있음) → RLS 또는 supabase-rls-profiles-only.sql 적용:', e);
    });
  }, [user?.id]);

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        handleGlobalUserUpdate(e.detail);
      }
    };
    window.addEventListener('site-user-update', handleSync);
    return () => window.removeEventListener('site-user-update', handleSync);
  }, [handleGlobalUserUpdate]);

  const addNotif = useCallback((userId: string, type: NotificationType, title: string, message: string, reason?: string) => {
    const id = `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newNotif: SiteNotification = {
      id, userId, type, title, message, reason, isRead: false, createdAt: new Date().toISOString()
    };
    setNotifications(prev => [newNotif, ...prev]);
    supabase.from('site_notifications').insert({
      id, user_id: userId, type, title, message, reason: reason || null, is_read: false
    }).then(() => {});
  }, []);

  const handleMassIssueCoupons = useCallback((targetIds: string[], couponData: Omit<Coupon, 'id' | 'status'>) => {
    const now = Date.now();
    const targetIdsLower = targetIds.map(id => id.trim().toLowerCase());

    setMembers(prev => {
      const next = prev.map(m => {
        if (targetIdsLower.includes(m.id.trim().toLowerCase())) {
          const newCoupon: Coupon = { ...couponData, id: `CPN_${now}_${m.id}`, status: 'available' };
          addNotif(
            m.id,
            'coupon',
            '🎫 새로운 쿠폰이 도착했습니다!',
            `회원님께 [${couponData.title}] (${couponData.discountLabel}) 쿠폰이 발행되었습니다. 쿠폰함을 확인해 보세요!`
          );
          const updated = { ...m, coupons: [...(m.coupons || []), newCoupon] };
          updateProfile(m.id, { coupons: updated.coupons }).catch((e) => console.warn('쿠폰 발급 DB 반영 실패:', e));
          return updated;
        }
        return m;
      });
      if (user) {
        const updatedMe = next.find(m => m.id.trim().toLowerCase() === user.id.trim().toLowerCase());
        if (updatedMe) setUser({ ...updatedMe });
      }
      return next;
    });
  }, [user, addNotif]);

  const handleLoginSuccess = async (userData: UserProfile) => {
    const isAdminLogin = userData.role === 'admin' || userData.id?.toLowerCase() === 'admin';
    const existingMember = members.find(m => m.id.toLowerCase() === userData.id.toLowerCase());
    let targetProfile: UserProfile;
    if (existingMember) {
      // 이메일·닉네임·휴대폰은 방금 로그인한 userData 우선 (다른 계정 데이터가 섞여 보이는 것 방지)
      targetProfile = {
        ...existingMember,
        email: userData.email ?? existingMember.email,
        nickname: userData.nickname ?? existingMember.nickname,
        phone: userData.phone ?? existingMember.phone,
        profileImage: userData.profileImage ?? existingMember.profileImage,
        role: isAdminLogin ? 'admin' : existingMember.role
      };
    } else {
      const isAdmin = userData.id?.toLowerCase() === 'admin';
      targetProfile = {
        ...userData, nickname: isAdmin ? '마케터김' : userData.nickname,
        role: isAdmin ? 'admin' : 'user', sellerStatus: isAdmin ? 'approved' : 'none',
        points: userData.id?.toLowerCase() === 'test' ? 12500 : 0,
        joinDate: new Date().toISOString().split('T')[0], coupons: []
      };
      setMembers(prev => [...prev, targetProfile]);
    }
    // 돈·포인트는 항상 DB 기준으로 덮어쓰기 (쿠키 삭제 후 0으로 바뀌는 현상 방지)
    try {
      const dbRow = await fetchProfileRow(userData.id);
      if (dbRow) {
        const dbProfile = profileRowToUserProfile(dbRow);
        targetProfile = {
          ...targetProfile,
          points: dbProfile.points,
          totalPurchaseAmount: dbProfile.totalPurchaseAmount,
          totalSalesAmount: dbProfile.totalSalesAmount,
          freelancerEarnings: dbProfile.freelancerEarnings,
          coupons: dbProfile.coupons ?? targetProfile.coupons,
        };
      }
    } catch (_) { /* RLS 등으로 조회 실패 시 기본 targetProfile 유지 */ }
    setUser(targetProfile);
    // 로그인 직후 채널/스토어 재로드 (첫 로드는 세션 복구 전이라 빈 결과였을 수 있음, admin 로그인은 RLS public SELECT 필요)
    Promise.all([
      fetchChannelProducts(),
      fetchStoreProducts(),
      fetchReviews(),
      fetchChannelOrders(),
    ]).then(([channelProducts, products, reviewList, channelOrderList]) => {
      setChannels(channelProducts);
      setEbooks(products);
      setReviews(reviewList);
      setChannelOrders(channelOrderList);
    }).catch((e) => console.warn('로그인 후 채널/스토어 재로드 실패:', e));
  };

  const handleLogout = () => { setUser(null); setWishlist([]); };

  // 찜 localStorage 백업 (DB와 별도로 유지, 페이지 리셋 방지)
  useEffect(() => {
    if (!user?.id) return;
    try {
      localStorage.setItem('wishlist_v2_' + user.id, JSON.stringify(wishlist));
    } catch (_) {}
  }, [user?.id, wishlist]);

  const wishlistToggle = useCallback((item: WishlistItem) => {
    const itemId = item.data.id;
    const itemType = item.type;
    setWishlist(prev => {
      const exists = prev.some(w => w.data.id === itemId);
      const next = exists ? prev.filter(w => w.data.id !== itemId) : [...prev, item];
      if (user?.id) {
        if (exists) {
          supabase.from('user_wishlist').delete().eq('user_id', user.id).eq('item_type', itemType).eq('item_id', itemId).then(() => {});
        } else {
          supabase.from('user_wishlist').upsert({
            id: `WL_${user.id}_${itemType}_${itemId}`,
            user_id: user.id,
            item_type: itemType,
            item_id: itemId
          }, { onConflict: 'user_id,item_type,item_id' }).then(() => {});
        }
      }
      return next;
    });
  }, [user?.id]);

  const content = (
    <>
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Header user={user} wishlistCount={wishlist.length} notifications={notifications} unreadChatCount={0} onLogout={handleLogout} onOpenLoginModal={() => setShowAuthModal(true)} />
      <LiveNotification />
      <div className="container mx-auto py-10 px-4 flex-1">
        <ContainerRoutes
            ebooks={ebooks}
            setEbooks={setEbooks}
            user={user}
            wishlist={wishlist}
            wishlistToggle={wishlistToggle}
            smmProducts={smmProducts}
            smmProviders={smmProviders}
            smmOrders={smmOrders}
            notices={notices}
            setSmmOrders={setSmmOrders}
            addNotif={addNotif}
            handleLogout={handleLogout}
            channels={channels}
            setChannels={setChannels}
            reviews={reviews}
            members={members}
            setMembers={setMembers}
            storeOrders={storeOrders}
            channelOrders={channelOrders}
            posts={posts}
            setPosts={setPosts}
            setReviews={setReviews}
            setNotifications={setNotifications}
            notifications={notifications}
            setStoreOrders={setStoreOrders}
            setChannelOrders={setChannelOrders}
            handleGlobalUserUpdate={handleGlobalUserUpdate}
            handleLoginSuccess={handleLoginSuccess}
            setSmmProviders={setSmmProviders}
            setSmmProducts={setSmmProducts}
            onDeleteSmmProducts={handleDeleteSmmProducts}
            setNotices={setNotices}
            handleMassIssueCoupons={handleMassIssueCoupons}
            gradeConfigs={gradeConfigs}
            setGradeConfigs={setGradeConfigs}
            onRefreshMembers={refreshMembers}
            onRefetchProfile={refetchCurrentUserProfile}
          />
      </div>
      <Footer />
    </div>
    {showAuthModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowAuthModal(false)}>
        <div className="w-full max-w-[920px] max-md:max-w-[440px]" onClick={e => e.stopPropagation()}>
          <AuthPage
            onLoginSuccess={(u) => { handleLoginSuccess(u); setShowAuthModal(false); }}
            onClose={() => setShowAuthModal(false)}
          />
        </div>
      </div>
    )}
    </>
  );

  return content;
}

export default App;
