import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { 
  UserProfile, SMMOrder, ChannelOrder, StoreOrder, EbookProduct, 
  ChannelProduct, SiteNotification, Notice, Post, Review, WishlistItem, Coupon, AutoCouponCampaign,
  SMMProvider, SMMProduct, NotificationType, GradeConfig
} from './types';

// Page and Component Imports
import Header from './components/Header';
import LiveNotification from './components/LiveNotification';
import SNSActivation from './pages/SNSActivation';
import ChannelSales from './pages/ChannelSales';
import EbookSales from './pages/EbookSales';
import AIConsulting from './pages/AIConsulting';
import FreeBoard from './pages/FreeBoard';
import RevenueManagement from './pages/RevenueManagement';
import ProfitManagement from './pages/ProfitManagement';
import ChatPage from './pages/ChatPage';
import MyPage from './pages/MyPage';
import AdminPanel from './pages/AdminPanel';
import NotificationsPage from './pages/NotificationsPage';
import FreeBoardWrite from './pages/FreeBoardWrite';
import FreeBoardDetail from './pages/FreeBoardDetail';
import PointPayment from './pages/PointPayment';
import CouponBox from './pages/CouponBox';
import NoticePage from './pages/NoticePage';
import ReviewWritePage from './pages/ReviewWritePage';
import AuthPage from './pages/AuthPage';
import ChannelDetail from './pages/ChannelDetail';
import EbookDetail from './pages/EbookDetail';
import EbookRegistration from './pages/EbookRegistration';
import WishlistPage from './pages/WishlistPage';
import PartTimePage from './pages/PartTimePage';

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
    const existingMember = members.find(m => m.id.toLowerCase() === userData.id.toLowerCase());
    let targetProfile: UserProfile;
    if (existingMember) {
      targetProfile = { ...existingMember };
    } else {
      const isAdmin = userData.id.toLowerCase() === 'admin';
      targetProfile = { 
        ...userData, nickname: isAdmin ? '마케터김' : userData.nickname,
        role: isAdmin ? 'admin' : 'user', sellerStatus: isAdmin ? 'approved' : 'none', 
        points: userData.id.toLowerCase() === 'test' ? 12500 : 0, 
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
          <Routes>
            <Route path="/sns" element={<SNSActivation smmProducts={smmProducts} providers={smmProviders} user={user || { id: '', nickname: 'Guest', profileImage: '', role: 'user', points: 12500 }} notices={notices} onOrderComplete={(o) => { setSmmOrders(prev => [o, ...prev]); addNotif(user!.id, 'sns_activation', '📈 SNS 활성화 주문 접수', `[${o.productName}] 주문이 접수되었습니다.`); }} onLogout={handleLogout} />} />
            <Route path="/channels" element={<ChannelSales channels={channels} wishlist={wishlist} onToggleWishlist={wishlistToggle} />} />
            <Route path="/channels/:id" element={<ChannelDetail channels={channels} wishlist={wishlist} onToggleWishlist={wishlistToggle} reviews={reviews} members={members} />} />
            <Route path="/ebooks" element={<EbookSales ebooks={ebooks} setEbooks={setEbooks} user={user || { id: '', nickname: 'Guest', profileImage: '', role: 'user' }} wishlist={wishlist} onToggleWishlist={wishlistToggle} />} />
            <Route path="/ebooks/:id" element={user ? <EbookDetail ebooks={ebooks} wishlist={wishlist} onToggleWishlist={wishlistToggle} user={user} reviews={reviews} storeOrders={storeOrders} members={members} /> : <Navigate to="/login" />} />
            <Route path="/ebooks/register" element={user ? <EbookRegistration user={user} setEbooks={setEbooks} /> : <Navigate to="/login" />} />
            <Route path="/part-time" element={<PartTimePage />} />
            <Route path="/ai" element={<AIConsulting />} />
            <Route path="/board" element={<FreeBoard posts={posts} notices={notices} />} />
            <Route path="/board/:id" element={user ? <FreeBoardDetail user={user} posts={posts} setPosts={setPosts} /> : <Navigate to="/login" />} />
            <Route path="/board/write" element={user ? <FreeBoardWrite user={user} posts={posts} setPosts={setPosts} /> : <Navigate to="/login" />} />
            <Route path="/revenue" element={user ? <RevenueManagement /> : <Navigate to="/login" />} />
            <Route path="/profit-mgmt" element={user ? <ProfitManagement user={user} storeOrders={storeOrders} /> : <Navigate to="/login" />} />
            <Route path="/chat" element={user ? <ChatPage user={user} members={members} addNotif={addNotif} /> : <Navigate to="/login" />} />
            <Route path="/mypage" element={user ? <MyPage user={user} onUpdate={handleGlobalUserUpdate} ebooks={ebooks} setEbooks={setEbooks} channels={channels} smmOrders={smmOrders} channelOrders={channelOrders} storeOrders={storeOrders} onAddReview={(r)=>setReviews(p=>[r,...p])} onUpdateReview={(r)=>setReviews(p=>p.map(i=>i.id===r.id?r:i))} reviews={reviews} addNotif={addNotif} onRefetchProfile={() => {}} /> : <Navigate to="/login" />} />
            <Route path="/notifications" element={user ? <NotificationsPage notifications={notifications} setNotifications={setNotifications} user={user} /> : <Navigate to="/login" />} />
            <Route path="/wishlist" element={<WishlistPage wishlist={wishlist} onToggleWishlist={wishlistToggle} channels={channels} ebooks={ebooks} />} />
            <Route path="/coupons" element={user ? <CouponBox user={user} /> : <Navigate to="/login" />} />
            <Route path="/payment/point" element={user ? <PointPayment user={user} ebooks={ebooks} members={members} onUpdateUser={handleGlobalUserUpdate} addNotif={addNotif} /> : <Navigate to="/login" />} />
            <Route path="/review/write" element={user ? <ReviewWritePage user={user} onAddReview={(r)=>setReviews(p=>[r,...p])} /> : <Navigate to="/login" />} />
            <Route path="/admin" element={user ? <AdminPanel user={user} ebooks={ebooks} setEbooks={setEbooks} channels={channels} setChannels={setChannels} setNotifications={setNotifications} smmProviders={smmProviders} setSmmProviders={setSmmProviders} smmProducts={smmProducts} setSmmProducts={setSmmProducts} smmOrders={smmOrders} members={members} setMembers={setMembers} channelOrders={channelOrders} storeOrders={storeOrders} onIssueCoupons={handleMassIssueCoupons} addNotif={addNotif} /> : <Navigate to="/login" />} />
            <Route path="/notices" element={<NoticePage notices={notices} setNotices={setNotices} user={user || { id: '', nickname: 'Guest', role: 'user', profileImage: '', points: 0 }} />} />
            <Route path="/login" element={<AuthPage onLoginSuccess={handleLoginSuccess} />} />
            <Route path="/" element={<Navigate to="/sns" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
