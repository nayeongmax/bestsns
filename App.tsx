import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { 
  UserProfile, SMMOrder, ChannelOrder, StoreOrder, EbookProduct, 
  ChannelProduct, SiteNotification, Notice, Post, Review, WishlistItem, Coupon, AutoCouponCampaign,
  SMMProvider, SMMProduct, NotificationType, GradeConfig
} from '@/types';

// Page and Component Imports (루트 기준 @/ 사용 - Netlify 빌드 시 해석 기준 오류 방지)
import Header from '@/components/Header';
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
import CouponBox from '@/pages/CouponBox';
import NoticePage from '@/pages/NoticePage';
import ReviewWritePage from '@/pages/ReviewWritePage';
import AuthPage from '@/pages/AuthPage';
import ChannelDetail from '@/pages/ChannelDetail';
import EbookDetail from '@/pages/EbookDetail';
import EbookRegistration from '@/pages/EbookRegistration';
import WishlistPage from '@/pages/WishlistPage';
import PartTimePage, { PartTimeTaskRegister } from '@/pages/PartTimePage';
import PartTimeTaskDetail from '@/pages/PartTimeTaskDetail';

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
      />
    );
  }
  return (
    <Routes>
      <Route path="/ebooks" element={<EbookSales ebooks={props.ebooks} setEbooks={props.setEbooks} user={props.user || { id: '', nickname: 'Guest', profileImage: '', role: 'user' }} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} />} />
      <Route path="/sns" element={<SNSActivation smmProducts={props.smmProducts} providers={props.smmProviders} user={props.user || { id: '', nickname: 'Guest', profileImage: '', role: 'user', points: 12500 }} notices={props.notices} onOrderComplete={(o) => { props.setSmmOrders(prev => [o, ...prev]); if (props.user) props.addNotif(props.user.id, 'sns_activation', '📈 SNS 활성화 주문 접수', `[${o.productName}] 주문이 접수되었습니다.`); }} onLogout={props.handleLogout} />} />
      <Route path="/channels" element={<ChannelSales channels={props.channels} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} />} />
      <Route path="/channels/:id" element={<ChannelDetail channels={props.channels} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} reviews={props.reviews} members={props.members} />} />
      <Route path="/ebooks/:id" element={props.user ? <EbookDetail ebooks={props.ebooks} wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} user={props.user} reviews={props.reviews} storeOrders={props.storeOrders} members={props.members} /> : <Navigate to="/login" />} />
      <Route path="/ebooks/register" element={props.user ? <EbookRegistration user={props.user} setEbooks={props.setEbooks} /> : <Navigate to="/login" />} />
      <Route path="/part-time" element={<PartTimePage user={props.user} onUpdateUser={props.handleGlobalUserUpdate} />} />
      <Route path="/part-time/register" element={<PartTimeTaskRegister user={props.user} />} />
      <Route path="/part-time/:taskId" element={<PartTimeTaskDetail user={props.user} onUpdateUser={props.handleGlobalUserUpdate} addNotif={props.addNotif} />} />
      <Route path="/ai" element={<AIConsulting />} />
      <Route path="/board" element={<FreeBoard posts={props.posts} notices={props.notices} />} />
      <Route path="/board/:id" element={props.user ? <FreeBoardDetail user={props.user} posts={props.posts} setPosts={props.setPosts} /> : <Navigate to="/login" />} />
      <Route path="/board/write" element={props.user ? <FreeBoardWrite user={props.user} posts={props.posts} setPosts={props.setPosts} /> : <Navigate to="/login" />} />
      <Route path="/revenue" element={props.user ? <RevenueManagement /> : <Navigate to="/login" />} />
      <Route path="/profit-mgmt" element={props.user ? <ProfitManagement user={props.user} storeOrders={props.storeOrders} /> : <Navigate to="/login" />} />
      <Route path="/chat" element={props.user ? <ChatPage user={props.user} members={props.members} addNotif={props.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/mypage" element={props.user ? <MyPage user={props.user} onUpdate={props.handleGlobalUserUpdate} ebooks={props.ebooks} setEbooks={props.setEbooks} channels={props.channels} smmOrders={props.smmOrders} channelOrders={props.channelOrders} storeOrders={props.storeOrders} onAddReview={(r)=>props.setReviews(prev=>[r,...prev])} onUpdateReview={(r)=>props.setReviews(prev=>prev.map(i=>i.id===r.id?r:i))} reviews={props.reviews} addNotif={props.addNotif} onRefetchProfile={() => {}} /> : <Navigate to="/login" />} />
      <Route path="/notifications" element={props.user ? <NotificationsPage notifications={props.notifications} setNotifications={props.setNotifications} user={props.user} /> : <Navigate to="/login" />} />
      <Route path="/wishlist" element={<WishlistPage wishlist={props.wishlist} onToggleWishlist={props.wishlistToggle} channels={props.channels} ebooks={props.ebooks} />} />
      <Route path="/coupons" element={props.user ? <CouponBox user={props.user} /> : <Navigate to="/login" />} />
      <Route path="/payment/point" element={props.user ? <PointPayment user={props.user} ebooks={props.ebooks} members={props.members} onUpdateUser={props.handleGlobalUserUpdate} addNotif={props.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/review/write" element={props.user ? <ReviewWritePage user={props.user} onAddReview={(r)=>props.setReviews(prev=>[r,...prev])} /> : <Navigate to="/login" />} />
      <Route path="/admin" element={props.user ? <AdminPanel user={props.user} ebooks={props.ebooks} setEbooks={props.setEbooks} channels={props.channels} setChannels={props.setChannels} setNotifications={props.setNotifications} smmProviders={props.smmProviders} setSmmProviders={props.setSmmProviders} smmProducts={props.smmProducts} setSmmProducts={props.setSmmProducts} smmOrders={props.smmOrders} members={props.members} setMembers={props.setMembers} channelOrders={props.channelOrders} storeOrders={props.storeOrders} onIssueCoupons={props.handleMassIssueCoupons} addNotif={props.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/notices" element={<NoticePage notices={props.notices} setNotices={props.setNotices} user={props.user || { id: '', nickname: 'Guest', role: 'user', profileImage: '', points: 0 }} />} />
      <Route path="/login" element={<AuthPage onLoginSuccess={props.handleLoginSuccess} />} />
      <Route path="/" element={<Navigate to="/sns" />} />
    </Routes>
  );
}

const App: React.FC = () => {
  // 스플래시 화면 제거로 인해 관련 상태 삭제

  const [members, setMembers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('site_members_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('user_profile_v2');
    return saved ? JSON.parse(saved) : null;
  });

  const [notifications, setNotifications] = useState<SiteNotification[]>(() => {
    const saved = localStorage.getItem('site_notifications_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [smmOrders, setSmmOrders] = useState<SMMOrder[]>(() => JSON.parse(localStorage.getItem('smm_orders_v2') || '[]'));
  const [smmProviders, setSmmProviders] = useState<SMMProvider[]>(() => JSON.parse(localStorage.getItem('site_smm_providers_v2') || '[]'));
  const [smmProducts, setSmmProducts] = useState<SMMProduct[]>(() => JSON.parse(localStorage.getItem('site_smm_products_v2') || '[]'));

  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>(() => {
    const saved = localStorage.getItem('store_orders_v2');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [channelOrders, setChannelOrders] = useState<ChannelOrder[]>(() => JSON.parse(localStorage.getItem('channel_orders_v2') || '[]'));
  const [ebooks, setEbooks] = useState<EbookProduct[]>(() => JSON.parse(localStorage.getItem('site_ebooks_v2') || '[]'));
  const [channels, setChannels] = useState<ChannelProduct[]>(() => JSON.parse(localStorage.getItem('site_channels_v2') || '[]'));
  const [posts, setPosts] = useState<Post[]>(() => JSON.parse(localStorage.getItem('site_posts_v2') || '[]'));
  const [reviews, setReviews] = useState<Review[]>(() => JSON.parse(localStorage.getItem('site_reviews_v2') || '[]'));
  const [notices, setNotices] = useState<Notice[]>(() => JSON.parse(localStorage.getItem('site_notices_v2') || '[]'));
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);

  useEffect(() => { localStorage.setItem('site_members_v2', JSON.stringify(members)); }, [members]);
  useEffect(() => { localStorage.setItem('user_profile_v2', JSON.stringify(user)); }, [user]);
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

  const handleGlobalUserUpdate = useCallback((updated: UserProfile) => {
    setUser(updated);
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
  }, []);

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
    const newNotif: SiteNotification = {
      id: `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId, type, title, message, reason, isRead: false, createdAt: new Date().toISOString()
    };
    setNotifications(prev => [newNotif, ...prev]);
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
          return { ...m, coupons: [...(m.coupons || []), newCoupon] };
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

  const handleLoginSuccess = (userData: UserProfile) => {
    const isAdminLogin = userData.role === 'admin' || userData.id?.toLowerCase() === 'admin';
    const existingMember = members.find(m => m.id.toLowerCase() === userData.id.toLowerCase());
    let targetProfile: UserProfile;
    if (existingMember) {
      targetProfile = { ...existingMember, role: isAdminLogin ? 'admin' : existingMember.role };
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
    setUser(targetProfile);
  };

  const handleLogout = () => setUser(null);

  const wishlistToggle = (i: WishlistItem) => setWishlist(p => p.some(w => w.data.id === i.data.id) ? p.filter(w => w.data.id !== i.data.id) : [...p, i]);

  return (
    <Router>
      <div className="min-h-screen bg-[#F8FAFC]">
        <Header user={user} wishlistCount={wishlist.length} notifications={notifications} unreadChatCount={0} onLogout={handleLogout} />
        <LiveNotification />
        <div className="container mx-auto py-10 px-4">
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
            setNotices={setNotices}
            handleMassIssueCoupons={handleMassIssueCoupons}
          />
        </div>
      </div>
    </Router>
  );
}

export default App;
