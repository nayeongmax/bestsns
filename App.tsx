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
import {
  fetchSmmOrders, fetchSmmProviders, fetchSmmProducts,
  upsertSmmOrders, upsertSmmProviders, upsertSmmProducts, deleteSmmProductsByIds,
  fetchSmmOrdersAdmin, fetchSmmProvidersAdmin,
  upsertSmmOrdersAdmin, upsertSmmProvidersAdmin, upsertSmmProductsAdmin, deleteSmmProductsByIdsAdmin,
} from './smmDb';
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
    pointBonusPercent: row.point_bonus_percent != null ? Number(row.point_bonus_percent) : 0,
    pointBonusActive: row.point_bonus_active != null ? Boolean(row.point_bonus_active) : false,
    pointBonusExpiryDays: row.point_bonus_expiry_days != null ? Number(row.point_bonus_expiry_days) : null,
    pointBonusStartDate: row.point_bonus_start_date != null ? String(row.point_bonus_start_date) : null,
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
import CreditApplication from '@/pages/CreditApplication';
import MarketingVoucherPage from '@/pages/MarketingVoucherPage';
import AlbaPaymentPage from '@/pages/AlbaPaymentPage';
import CouponBox from '@/pages/CouponBox';
import NoticePage from '@/pages/NoticePage';
import TermsPage from '@/pages/TermsPage';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import MarketingConsentPage from '@/pages/MarketingConsentPage';
import ReviewWritePage from '@/pages/ReviewWritePage';
import AuthPage from '@/pages/AuthPage';
import ChannelDetail from '@/pages/ChannelDetail';
import EbookDetail from '@/pages/EbookDetail';
import EbookRegistration from '@/pages/EbookRegistration';
import WishlistPage from '@/pages/WishlistPage';
import PartTimePage, { PartTimeTaskRegister } from '@/pages/PartTimePage';
import PartTimeTaskDetail from '@/pages/PartTimeTaskDetail';
import PartTimeJobRequestPage from '@/pages/PartTimeJobRequestPage';
import SlotGameLanding from '@/pages/SlotGameLanding';

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
  onlineUserIds?: Set<string>;
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
      <Route path="/channels/:id" element={<ChannelDetail channels={props.channels} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} reviews={props.reviews} members={props.members} user={props.user ?? undefined} addNotif={props.user ? props.addNotif : undefined} onChannelOrderCreated={props.user ? (o) => props.setChannelOrders(prev => [o, ...prev]) : undefined} />} />
      <Route path="/ebooks/:id" element={props.user ? <EbookDetail ebooks={props.ebooks} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} user={props.user} reviews={props.reviews} storeOrders={props.storeOrders} members={props.members} gradeConfigs={props.gradeConfigs} addNotif={props.addNotif} onStoreOrderCreated={(o) => props.setStoreOrders(prev => [o, ...prev])} /> : <Navigate to="/login" />} />
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
      <Route path="/chat" element={props.user ? <ChatPage user={props.user} members={props.members} addNotif={props.addNotif} onlineUserIds={props.onlineUserIds} /> : <Navigate to="/login" />} />
      <Route path="/mypage" element={props.user ? <MyPage user={props.user} members={props.members} onUpdate={props.handleGlobalUserUpdate} ebooks={props.ebooks} setEbooks={props.setEbooks} channels={props.channels} smmOrders={props.smmOrders} channelOrders={props.channelOrders} storeOrders={props.storeOrders} setStoreOrders={props.setStoreOrders} setChannelOrders={props.setChannelOrders} onAddReview={(r)=>props.setReviews(prev=>[r,...prev])} onUpdateReview={(r)=>props.setReviews(prev=>prev.map(i=>i.id===r.id?r:i))} reviews={props.reviews} addNotif={props.addNotif} onRefetchProfile={props.onRefetchProfile} gradeConfigs={props.gradeConfigs} /> : <Navigate to="/login" />} />
      <Route path="/notifications" element={props.user ? <NotificationsPage notifications={props.notifications} setNotifications={props.setNotifications} user={props.user} /> : <Navigate to="/login" />} />
      <Route path="/wishlist" element={<WishlistPage wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} channels={props.channels} ebooks={props.ebooks} />} />
      <Route path="/coupons" element={props.user ? <CouponBox user={props.user} /> : <Navigate to="/login" />} />
      <Route path="/payment/point" element={props.user ? <PointPayment user={props.user} ebooks={props.ebooks} channels={props.channels} members={props.members} onUpdateUser={props.handleGlobalUserUpdate} addNotif={props.addNotif} setChannelOrders={props.setChannelOrders} setStoreOrders={props.setStoreOrders} /> : <Navigate to="/login" />} />
      <Route path="/credit/apply" element={props.user ? <CreditApplication user={props.user} ebooks={props.ebooks} /> : <Navigate to="/login" />} />
      <Route path="/store/marketing-voucher" element={props.user ? <MarketingVoucherPage user={props.user} onUpdateUser={props.handleGlobalUserUpdate} addNotif={props.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/payment/alba" element={props.user ? <AlbaPaymentPage user={props.user} members={props.members} addNotif={props.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/review/write" element={props.user ? <ReviewWritePage user={props.user} onAddReview={(r)=>props.setReviews(prev=>[r,...prev])} /> : <Navigate to="/login" />} />
      <Route path="/admin" element={props.user ? <AdminPanel user={props.user} ebooks={props.ebooks} setEbooks={props.setEbooks} channels={props.channels} setChannels={props.setChannels} setNotifications={props.setNotifications} smmProviders={props.smmProviders} setSmmProviders={props.setSmmProviders} smmProducts={props.smmProducts} setSmmProducts={props.setSmmProducts} onDeleteSmmProducts={props.onDeleteSmmProducts} smmOrders={props.smmOrders} setSmmOrders={props.setSmmOrders} members={props.members} setMembers={props.setMembers} channelOrders={props.channelOrders} setChannelOrders={props.setChannelOrders} storeOrders={props.storeOrders} onIssueCoupons={props.handleMassIssueCoupons} addNotif={props.addNotif} gradeConfigs={props.gradeConfigs} setGradeConfigs={props.setGradeConfigs} reviews={props.reviews} setReviews={props.setReviews} onUpdateUser={props.handleGlobalUserUpdate} onRefreshMembers={props.onRefreshMembers} /> : <Navigate to="/login" />} />
      <Route path="/notices" element={<NoticePage notices={props.notices} setNotices={props.setNotices} user={props.user || { id: '', nickname: 'Guest', role: 'user', profileImage: '', points: 0 }} />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/marketing-consent" element={<MarketingConsentPage />} />
      <Route path="/slot" element={<SlotGameLanding />} />
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

  const [unreadChatCount, setUnreadChatCount] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('unread_chat_count') || '0', 10) || 0; } catch { return 0; }
  });
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const storeDbLoaded = useRef(false);

  useEffect(() => { localStorage.setItem('grade_configs_v2', JSON.stringify(gradeConfigs)); }, [gradeConfigs]);

  const channelDbLoaded = useRef(false);
  const smmDbLoaded = useRef(false);
  const siteDbLoaded = useRef(false);
  // write effect에서 최신 user를 참조하기 위한 ref (의존성 배열에 추가 시 무한 루프 방지)
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

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
          // Supabase에 thumbnail이 없는 경우 localStorage 데이터로 보완 (upsert 실패로 누락된 경우 복구)
          const localEbooks = safeStorage<EbookProduct[]>('site_ebooks_v2', []);
          const mergedProducts = products.map(p => {
            if (p.thumbnail) return p;
            const local = localEbooks.find(e => e.id === p.id);
            return {
              ...p,
              thumbnail: local?.thumbnail || '',
              attachedImages: p.attachedImages?.length ? p.attachedImages : (local?.attachedImages || []),
            };
          });
          setEbooks(mergedProducts);
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
  // - 어드민: smm-admin Netlify 함수(service_role)로 전체 데이터 로드
  // - 일반 사용자: Supabase anon key로 본인 주문만 로드 (RLS 적용)
  useEffect(() => {
    let cancelled = false;
    const isAdmin = user?.role === 'admin';
    (async () => {
      try {
        const [orders, providers, products] = await Promise.all([
          isAdmin ? fetchSmmOrdersAdmin() : fetchSmmOrders(),
          isAdmin ? fetchSmmProvidersAdmin() : Promise.resolve([] as SMMProvider[]),
          fetchSmmProducts(),
        ]);
        if (!cancelled) {
          setSmmOrders(orders);
          // Supabase가 빈 배열을 반환하면 localStorage 데이터를 유지 (덮어쓰기 방지)
          // → 새로고침 시 Supabase write 실패로 DB가 비어 있어도 상품이 사라지지 않음
          if (providers.length > 0) {
            setSmmProviders(providers);
          } else if (isAdmin) {
            // 어드민: Supabase 공급처가 비어있으면 localStorage 데이터를 마이그레이션
            const localProviders = safeStorage<SMMProvider[]>('site_smm_providers_v2', []);
            if (localProviders.length > 0) {
              upsertSmmProvidersAdmin(localProviders).catch(e => console.warn('smm_providers 마이그레이션 실패:', e));
            }
          }
          const localProducts = safeStorage<SMMProduct[]>('site_smm_products_v2', []);
          if (products.length > 0) {
            // DB + localStorage 머지: DB에 없는 상품(upsert 실패로 누락)도 보존
            const dbIds = new Set(products.map(p => p.id));
            const extraLocal = localProducts.filter(p => !dbIds.has(p.id));
            setSmmProducts(extraLocal.length > 0 ? [...products, ...extraLocal] : products);
          } else if (isAdmin && localProducts.length > 0) {
            // 어드민: Supabase 상품이 비어있으면 localStorage 데이터를 마이그레이션
            upsertSmmProductsAdmin(localProducts).catch(e => console.warn('smm_products 마이그레이션 실패:', e));
          }
          smmDbLoaded.current = true;
        }
      } catch (e) {
        if (!cancelled) console.warn('SNS활성화 DB 로드 실패, localStorage 사용:', e);
        smmDbLoaded.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 채널판매: 상품/주문 변경 시 DB 저장 (실패 시 콘솔에만 경고 — 새로고침 시 alert 방지)
  useEffect(() => {
    if (!channelDbLoaded.current) return;
    if (channels.length === 0) return;
    upsertChannelProducts(channels).catch((e) => {
      console.warn('channel_products 저장 실패:', e);
    });
  }, [channels]);
  useEffect(() => {
    if (!channelDbLoaded.current) return;
    upsertChannelOrders(channelOrders).catch((e) => console.warn('channel_orders 저장:', e));
  }, [channelOrders]);

  // SNS활성화: 주문/공급처/상품 변경 시 DB 저장
  // - 어드민: smm-admin Netlify 함수(service_role) 사용
  // - 일반 사용자: Supabase anon key (RLS로 본인 주문만 upsert 가능)
  useEffect(() => {
    if (!smmDbLoaded.current) return;
    if (userRef.current?.role === 'admin') {
      upsertSmmOrdersAdmin(smmOrders).catch((e) => console.warn('smm_orders 저장(admin):', e));
    } else {
      upsertSmmOrders(smmOrders).catch((e) => console.warn('smm_orders 저장:', e));
    }
  }, [smmOrders]);
  useEffect(() => {
    if (!smmDbLoaded.current) return;
    upsertSmmProvidersAdmin(smmProviders).catch((e) => console.warn('smm_providers 저장:', e));
  }, [smmProviders]);
  useEffect(() => {
    if (!smmDbLoaded.current) return;
    upsertSmmProductsAdmin(smmProducts).catch((e) => console.warn('smm_products 저장:', e));
  }, [smmProducts]);

  // /mypage, /admin 진입 시 채널/스토어 주문 재로드 (결제 직후 반영 & 웹훅 취소 상태 동기화)
  useEffect(() => {
    if (location.pathname !== '/mypage' && location.pathname !== '/admin') return;
    fetchChannelOrders()
      .then((dbOrders) => {
        // DB 주문과 로컬 상태를 병합 (DB에 아직 반영 안 된 로컬 주문 보존)
        setChannelOrders((prev) => {
          const dbIds = new Set(dbOrders.map((o) => o.id));
          const localOnly = prev.filter((o) => !dbIds.has(o.id));
          return [...dbOrders, ...localOnly];
        });
      })
      .catch((e) => console.warn('채널 주문 재로드 실패:', e));
    fetchStoreOrders()
      .then((dbOrders) => {
        // DB 주문과 로컬 상태를 병합 (DB에 아직 반영 안 된 로컬 주문 보존)
        setStoreOrders((prev) => {
          const dbIds = new Set(dbOrders.map((o) => o.id));
          const localOnly = prev.filter((o) => !dbIds.has(o.id));
          return [...dbOrders, ...localOnly];
        });
      })
      .catch((e) => console.warn('스토어 주문 재로드 실패:', e));
  }, [location.pathname]);

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

  // 채팅 알림음 - Web Audio API로 딩동 소리 생성 (외부 파일 불필요)
  const playDingDong = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const play = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      play(880, ctx.currentTime, 0.15);
      play(660, ctx.currentTime + 0.15, 0.25);
    } catch { /* 재생 차단 시 무시 */ }
  }, []);

  // unreadChatCount 변경 시 localStorage 저장
  useEffect(() => {
    try { localStorage.setItem('unread_chat_count', String(unreadChatCount)); } catch { /* ignore */ }
  }, [unreadChatCount]);

  // /chat 진입 시 미읽음 카운트 초기화 + 마지막 읽은 시각 저장
  useEffect(() => {
    if (location.pathname === '/chat') {
      setUnreadChatCount(0);
      try {
        localStorage.setItem('unread_chat_count', '0');
        if (user?.id) {
          localStorage.setItem(`chat_last_read_${user.id}`, new Date().toISOString());
        }
      } catch { /* ignore */ }
    }
  }, [location.pathname, user?.id]);

  // 로그인 시 DB에서 미읽음 채팅 수 로드 (마지막 /chat 방문 이후 받은 메시지)
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;
    (async () => {
      try {
        const lastReadKey = `chat_last_read_${userId}`;
        let lastRead = localStorage.getItem(lastReadKey);
        if (!lastRead) {
          // 최초: 24시간 이내 메시지만 확인
          lastRead = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          localStorage.setItem(lastReadKey, lastRead);
        }
        const { count, error } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .or(`room_id.like.${userId}_%,room_id.like.%_${userId}`)
          .neq('sender_id', userId)
          .gt('created_at', lastRead);
        if (cancelled || error) return;
        if ((count ?? 0) > 0) {
          setUnreadChatCount(count!);
          try { localStorage.setItem('unread_chat_count', String(count)); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // 채팅 메시지 실시간 구독 → 미읽음 카운트 + 알림음
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const channel = supabase
      .channel(`chat-unread-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as { room_id?: string; sender_id?: string; sender_nickname?: string };
        const roomId = msg.room_id || '';
        const senderId = msg.sender_id || '';
        // 내가 참여한 채팅방(room_id에 내 id 포함)에 상대방이 보낸 메시지
        // /chat 페이지에 있으면 이미 읽고 있으므로 카운트 증가 안 함
        if (roomId.includes(userId) && senderId !== userId && window.location.pathname !== '/chat') {
          setUnreadChatCount(prev => prev + 1);
          playDingDong();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, playDingDong]);

  // 채팅 미읽음 카운트 폴링 폴백 (Supabase Realtime이 비활성화된 환경 대비, 15초마다 체크)
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const poll = async () => {
      if (window.location.pathname === '/chat') return;
      try {
        const lastReadKey = `chat_last_read_${userId}`;
        const lastRead = localStorage.getItem(lastReadKey) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count, error } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .or(`room_id.like.${userId}_%,room_id.like.%_${userId}`)
          .neq('sender_id', userId)
          .gt('created_at', lastRead);
        if (error) return;
        const newCount = count ?? 0;
        setUnreadChatCount(prev => {
          if (newCount > prev) playDingDong();
          return newCount;
        });
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [user?.id, playDingDong]);

  // 전역 presence 추적 - 사이트에 로그인해 있으면 온라인으로 표시 (ChatPage에서만이 아니라 전체 사이트에서)
  useEffect(() => {
    if (!user?.id) return;
    const presenceChannel = supabase.channel('chat_presence');
    const syncOnlineIds = () => {
      const state = presenceChannel.presenceState() as Record<string, { user_id?: string }[]>;
      const ids = new Set<string>();
      Object.values(state).forEach((payloads) => {
        payloads.forEach((p) => {
          if (p.user_id && p.user_id !== user.id) ids.add(p.user_id);
        });
      });
      setOnlineUserIds(ids);
    };
    presenceChannel
      .on('presence', { event: 'sync' }, syncOnlineIds)
      .on('presence', { event: 'join' }, syncOnlineIds)
      .on('presence', { event: 'leave' }, syncOnlineIds)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id, updated_at: new Date().toISOString() });
        }
      });
    return () => { supabase.removeChannel(presenceChannel); };
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

          // 같은 이메일로 중복 프로필 제거: Supabase Auth UUID와 커스텀 ID가 공존할 때
          // (예: 'payverse' + '5bbab497-...' → 커스텀 ID 우선 유지)
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const deduped = parsed.reduce<UserProfile[]>((acc, p) => {
            if (!p.email) return [...acc, p];
            const sameEmail = acc.findIndex(e => e.email === p.email);
            if (sameEmail === -1) return [...acc, p];
            // 중복: 커스텀 ID 우선 (UUID가 아닌 것)
            const existingIsUuid = uuidPattern.test(acc[sameEmail].id);
            const currentIsUuid = uuidPattern.test(p.id);
            if (existingIsUuid && !currentIsUuid) {
              // 기존(UUID)을 커스텀 ID로 교체
              const next = [...acc];
              next[sameEmail] = p;
              return next;
            }
            // 기존이 이미 커스텀 ID이거나 둘 다 UUID면 현재 스킵
            return acc;
          }, []);

          setMembers(deduped);
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
      (fromDb.freelancerEarnings ?? 0) === (user.freelancerEarnings ?? 0) &&
      (fromDb.pointBonusActive ?? false) === (user.pointBonusActive ?? false) &&
      (fromDb.pointBonusPercent ?? 0) === (user.pointBonusPercent ?? 0);
    if (!same) setUser(prev => prev ? { ...prev, points: fromDb.points, totalPurchaseAmount: fromDb.totalPurchaseAmount, totalSalesAmount: fromDb.totalSalesAmount, freelancerEarnings: fromDb.freelancerEarnings, coupons: fromDb.coupons ?? prev.coupons, pointBonusActive: fromDb.pointBonusActive, pointBonusPercent: fromDb.pointBonusPercent } : null);
  }, [members, user?.id, user?.points, user?.totalPurchaseAmount, user?.totalSalesAmount, user?.freelancerEarnings, user?.pointBonusActive, user?.pointBonusPercent]);

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
  useEffect(() => {
    // base64 썸네일/이미지/PDF는 Supabase에 저장되므로 localStorage에는 제외해 용량 초과 방지
    const stripped = ebooks.map(({ thumbnail, attachedImages, tiers, ...rest }) => ({
      ...rest,
      thumbnail: thumbnail?.startsWith('data:') ? '' : (thumbnail ?? ''),
      attachedImages: (attachedImages ?? []).map(img => img.startsWith('data:') ? '' : img),
      tiers: (tiers ?? []).map(({ pdfFile: _pdf, ...t }) => t),
    }));
    try { localStorage.setItem('site_ebooks_v2', JSON.stringify(stripped)); } catch { /* 용량 초과 시 무시 */ }
  }, [ebooks]);
  useEffect(() => { localStorage.setItem('site_channels_v2', JSON.stringify(channels)); }, [channels]);
  useEffect(() => { localStorage.setItem('site_posts_v2', JSON.stringify(posts)); }, [posts]);
  useEffect(() => { localStorage.setItem('site_reviews_v2', JSON.stringify(reviews)); }, [reviews]);
  useEffect(() => { localStorage.setItem('site_notices_v2', JSON.stringify(notices)); }, [notices]);
  useEffect(() => { localStorage.setItem('site_smm_providers_v2', JSON.stringify(smmProviders)); }, [smmProviders]);
  useEffect(() => { localStorage.setItem('site_smm_products_v2', JSON.stringify(smmProducts)); }, [smmProducts]);

  /** 상품 인벤토리에서 삭제 시 DB에서 즉시 삭제 (새로고침 후에도 삭제 유지) */
  const handleDeleteSmmProducts = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    deleteSmmProductsByIdsAdmin(ids).catch((e) => console.warn('smm_products 삭제 실패:', e));
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

  useEffect(() => {
    const handleCreditRefresh = () => { refetchCurrentUserProfile(); };
    window.addEventListener('credit-refresh-profile', handleCreditRefresh);
    return () => window.removeEventListener('credit-refresh-profile', handleCreditRefresh);
  }, [refetchCurrentUserProfile]);

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
        ...userData, nickname: isAdmin ? '홍길동' : userData.nickname,
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
      const localEbooks = safeStorage<EbookProduct[]>('site_ebooks_v2', []);
      setEbooks(products.map(p => {
        if (p.thumbnail) return p;
        const local = localEbooks.find(e => e.id === p.id);
        return { ...p, thumbnail: local?.thumbnail || '', attachedImages: p.attachedImages?.length ? p.attachedImages : (local?.attachedImages || []) };
      }));
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
      <Header user={user} wishlistCount={wishlist.length} notifications={notifications} unreadChatCount={unreadChatCount} onLogout={handleLogout} onOpenLoginModal={() => setShowAuthModal(true)} />
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
            onlineUserIds={onlineUserIds}
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
