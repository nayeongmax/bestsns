export interface UserProfile {
  id: string;
  nickname: string;
  profileImage: string;
  role: 'user' | 'admin' | 'manager';
  email?: string;
  phone?: string;
  points?: number;
  joinDate?: string;
  sellerStatus?: 'none' | 'pending' | 'approved';
  freelancerStatus?: 'none' | 'pending' | 'approved';
  freelancerEarnings?: number;
  totalPurchaseAmount?: number;
  totalSalesAmount?: number;
}

export interface Post {
  id: string;
  category: string;
  title: string;
  content: string;
  author: string;
  author_id: string;
  author_image?: string | null;
  date: string;
  views: number;
  likes_count: number;
  images: string[];
  is_deleted?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  author: string;
  author_id: string;
  author_image?: string | null;
  content: string;
  created_at: string;
  likes?: number;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  category?: string;
  isPinned?: boolean;
}

export interface SMMProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  minQuantity?: number;
  maxQuantity?: number;
  isActive: boolean;
}

export interface SMMOrder {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  targetUrl: string;
  quantity: number;
  price: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'partial';
  createdAt: string;
  note?: string;
}

export interface ChannelProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  isActive: boolean;
  sellerId: string;
  sellerNickname: string;
  rating?: number;
  reviewCount?: number;
}

export interface EbookProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  coverImageUrl?: string;
  isActive: boolean;
  sellerId: string;
  sellerNickname: string;
  rating?: number;
  reviewCount?: number;
  fileUrl?: string;
}

export interface PartTimeTask {
  id: string;
  title: string;
  description: string;
  reward: number;
  category: string;
  deadline: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  creatorId: string;
  creatorNickname: string;
  maxApplicants?: number;
  currentApplicants?: number;
  createdAt: string;
}

export interface SiteNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
