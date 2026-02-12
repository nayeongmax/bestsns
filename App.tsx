import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import PartTimeTaskDetail from './pages/PartTimeTaskDetail';
import PartTimeTaskRegister from './pages/PartTimeTaskRegister';

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
          <AppBody
            user={user}
            members={members}
            setMembers={setMembers}
            ebooks={ebooks}
            setEbooks={setEbooks}
            wishlist={wishlist}
            wishlistToggle={wishlistToggle}
            channels={channels}
            setChannels={setChannels}
            channelOrders={channelOrders}
            storeOrders={storeOrders}
            smmOrders={smmOrders}
            setSmmOrders={setSmmOrders}
            smmProducts={smmProducts}
            setSmmProducts={setSmmProducts}
            smmProviders={smmProviders}
            setSmmProviders={setSmmProviders}
            posts={posts}
            setPosts={setPosts}
            reviews={reviews}
            setReviews={setReviews}
            notices={notices}
            setNotices={setNotices}
            notifications={notifications}
            setNotifications={setNotifications}
            addNotif={addNotif}
            handleGlobalUserUpdate={handleGlobalUserUpdate}
            handleLogout={handleLogout}
            handleLoginSuccess={handleLoginSuccess}
            handleMassIssueCoupons={handleMassIssueCoupons}
          />
        </div>
      </div>
    </Router>
  );
}

type AppBodyProps = {
  user: UserProfile | null;
  members: UserProfile[];
  setMembers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  ebooks: EbookProduct[];
  setEbooks: React.Dispatch<React.SetStateAction<EbookProduct[]>>;
  wishlist: WishlistItem[];
  wishlistToggle: (i: WishlistItem) => void;
  channels: ChannelProduct[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelProduct[]>>;
  channelOrders: ChannelOrder[];
  storeOrders: StoreOrder[];
  smmOrders: SMMOrder[];
  setSmmOrders: React.Dispatch<React.SetStateAction<SMMOrder[]>>;
  smmProducts: SMMProduct[];
  setSmmProducts: React.Dispatch<React.SetStateAction<SMMProduct[]>>;
  smmProviders: SMMProvider[];
  setSmmProviders: React.Dispatch<React.SetStateAction<SMMProvider[]>>;
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  reviews: Review[];
  setReviews: React.Dispatch<React.SetStateAction<Review[]>>;
  notices: Notice[];
  setNotices: React.Dispatch<React.SetStateAction<Notice[]>>;
  notifications: SiteNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<SiteNotification[]>>;
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
  handleGlobalUserUpdate: (updated: UserProfile) => void;
  handleLogout: () => void;
  handleLoginSuccess: (userData: UserProfile) => void;
  handleMassIssueCoupons: (targetIds: string[], couponData: Omit<Coupon, 'id' | 'status'>) => void;
};

function AppBody(p: AppBodyProps) {
  const location = useLocation();
  const isEbooksList = location.pathname === '/ebooks';

  if (isEbooksList) {
    return (
      <EbookSales
        ebooks={p.ebooks}
        setEbooks={p.setEbooks}
        user={p.user || { id: '', nickname: 'Guest', profileImage: '', role: 'user' }}
        wishlist={p.wishlist}
        onToggleWishlist={p.wishlistToggle}
      />
    );
  }

  return (
    <Routes>
      <Route path="/sns" element={<SNSActivation smmProducts={p.smmProducts} providers={p.smmProviders} user={p.user || { id: '', nickname: 'Guest', profileImage: '', role: 'user', points: 12500 }} notices={p.notices} onOrderComplete={(o) => { p.setSmmOrders(prev => [o, ...prev]); if (p.user) p.addNotif(p.user.id, 'sns_activation', '📈 SNS 활성화 주문 접수', `[${o.productName}] 주문이 접수되었습니다.`); }} onLogout={p.handleLogout} />} />
      <Route path="/channels" element={<ChannelSales channels={p.channels} wishlist={p.wishlist} onToggleWishlist={p.wishlistToggle} />} />
      <Route path="/channels/:id" element={<ChannelDetail channels={p.channels} wishlist={p.wishlist} onToggleWishlist={p.wishlistToggle} reviews={p.reviews} members={p.members} />} />
      <Route path="/ebooks" element={<EbookSales ebooks={p.ebooks} setEbooks={p.setEbooks} user={p.user || { id: '', nickname: 'Guest', profileImage: '', role: 'user' }} wishlist={p.wishlist} onToggleWishlist={p.wishlistToggle} />} />
      <Route path="/ebooks/:id" element={p.user ? <EbookDetail ebooks={p.ebooks} wishlist={p.wishlist} onToggleWishlist={p.wishlistToggle} user={p.user} reviews={p.reviews} storeOrders={p.storeOrders} members={p.members} /> : <Navigate to="/login" />} />
      <Route path="/ebooks/register" element={p.user ? <EbookRegistration user={p.user} setEbooks={p.setEbooks} /> : <Navigate to="/login" />} />
      <Route path="/part-time" element={<PartTimePage user={p.user} onUpdateUser={p.handleGlobalUserUpdate} />} />
      <Route path="/part-time/register" element={<PartTimeTaskRegister user={p.user} />} />
      <Route path="/part-time/:taskId" element={<PartTimeTaskDetail user={p.user} onUpdateUser={p.handleGlobalUserUpdate} />} />
      <Route path="/ai" element={<AIConsulting />} />
      <Route path="/board" element={<FreeBoard posts={p.posts} notices={p.notices} />} />
      <Route path="/board/:id" element={p.user ? <FreeBoardDetail user={p.user} posts={p.posts} setPosts={p.setPosts} /> : <Navigate to="/login" />} />
      <Route path="/board/write" element={p.user ? <FreeBoardWrite user={p.user} posts={p.posts} setPosts={p.setPosts} /> : <Navigate to="/login" />} />
      <Route path="/revenue" element={p.user ? <RevenueManagement /> : <Navigate to="/login" />} />
      <Route path="/profit-mgmt" element={p.user ? <ProfitManagement user={p.user} storeOrders={p.storeOrders} /> : <Navigate to="/login" />} />
      <Route path="/chat" element={p.user ? <ChatPage user={p.user} members={p.members} addNotif={p.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/mypage" element={p.user ? <MyPage user={p.user} onUpdate={p.handleGlobalUserUpdate} ebooks={p.ebooks} setEbooks={p.setEbooks} channels={p.channels} smmOrders={p.smmOrders} channelOrders={p.channelOrders} storeOrders={p.storeOrders} onAddReview={(r)=>p.setReviews(prev=>[r,...prev])} onUpdateReview={(r)=>p.setReviews(prev=>prev.map(i=>i.id===r.id?r:i))} reviews={p.reviews} addNotif={p.addNotif} onRefetchProfile={() => {}} /> : <Navigate to="/login" />} />
      <Route path="/notifications" element={p.user ? <NotificationsPage notifications={p.notifications} setNotifications={p.setNotifications} user={p.user} /> : <Navigate to="/login" />} />
      <Route path="/wishlist" element={<WishlistPage wishlist={p.wishlist} onToggleWishlist={p.wishlistToggle} channels={p.channels} ebooks={p.ebooks} />} />
      <Route path="/coupons" element={p.user ? <CouponBox user={p.user} /> : <Navigate to="/login" />} />
      <Route path="/payment/point" element={p.user ? <PointPayment user={p.user} ebooks={p.ebooks} members={p.members} onUpdateUser={p.handleGlobalUserUpdate} addNotif={p.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/review/write" element={p.user ? <ReviewWritePage user={p.user} onAddReview={(r)=>p.setReviews(prev=>[r,...prev])} /> : <Navigate to="/login" />} />
      <Route path="/admin" element={p.user ? <AdminPanel user={p.user} ebooks={p.ebooks} setEbooks={p.setEbooks} channels={p.channels} setChannels={p.setChannels} setNotifications={p.setNotifications} smmProviders={p.smmProviders} setSmmProviders={p.setSmmProviders} smmProducts={p.smmProducts} setSmmProducts={p.setSmmProducts} smmOrders={p.smmOrders} members={p.members} setMembers={p.setMembers} channelOrders={p.channelOrders} storeOrders={p.storeOrders} onIssueCoupons={p.handleMassIssueCoupons} addNotif={p.addNotif} /> : <Navigate to="/login" />} />
      <Route path="/notices" element={<NoticePage notices={p.notices} setNotices={p.setNotices} user={p.user || { id: '', nickname: 'Guest', role: 'user', profileImage: '', points: 0 }} />} />
      <Route path="/login" element={<AuthPage onLoginSuccess={p.handleLoginSuccess} />} />
      <Route path="/" element={<Navigate to="/sns" />} />
    </Routes>
  );
};

export default App;
