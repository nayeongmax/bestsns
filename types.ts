
export type StoreType = 'marketing' | 'lecture' | 'consulting' | 'template' | 'ebook';

export interface UserProfile {
  id: string;
  nickname: string;
  profileImage: string;
  role: 'user' | 'admin' | 'manager';
  email?: string;
  phone?: string;
  password?: string; // 보안상 실제 DB에서는 암호화하지만 현재는 가입 로직을 위해 추가
  points?: number;
  sellerStatus?: 'none' | 'pending' | 'approved' | 'revision';
  sellerApplication?: SellerApplication;
  pendingApplication?: SellerApplication;
  joinDate?: string;
  coupons?: Coupon[];
  totalPurchaseAmount?: number;
  totalSalesAmount?: number;
  violationCount?: number;
  isOnline?: boolean;
  manualGrade?: string;
  /** 프리랜서 수익통장 잔액 (누구나알바 작업으로 쌓인 포인트) */
  freelancerEarnings?: number;
}

/** 프리랜서 수익통장 내역 한 건 */
export interface FreelancerEarningEntry {
  id: string;
  type: 'task' | 'withdraw';
  amount: number;
  label: string;
  at: string;
}

/** 누구나알바 작업 신청자 */
export interface PartTimeApplicant {
  userId: string;
  nickname: string;
  comment: string;
  selected: boolean;
  appliedAt: string;
  /** 선정된 사람이 작업 완료 후 제출하는 작업 링크 (하위 호환) */
  workLink?: string;
  /** 작업 링크 여러 개 제출 */
  workLinks?: string[];
}

/** 게시글 한 건 (제목+내용) - 여러 개 넣을 때 사용 */
export interface PartTimePostBlock {
  제목: string;
  내용: string;
}

/** 누구나알바 작업 상세 (작업 내용 섹션) - 필요한 항목만 사용 */
export interface PartTimeTaskSections {
  제목?: string;
  내용?: string;
  /** 게시글 여러 개 (제목+내용 쌍). 있으면 단일 제목/내용 대신 사용 */
  게시글목록?: PartTimePostBlock[];
  /** 댓글 지시 1개. 댓글목록이 있으면 댓글목록 사용 */
  댓글?: string;
  /** 댓글 지시 여러 개 (댓글 1, 댓글 2, ...) */
  댓글목록?: string[];
  키워드?: string;
  /** 이미지 지시사항 텍스트 또는 단일 이미지 data URL */
  이미지?: string;
  /** 참고 이미지 최대 10개 (data URL) */
  이미지목록?: string[];
  동영상?: string;
  gif?: string;
  /** 작업 링크 관련 안내 1개. 작업링크목록이 있으면 작업링크목록 사용 */
  작업링크?: string;
  /** 작업 링크/안내 여러 개 (작업링크 1, 작업링크 2, ...) */
  작업링크목록?: string[];
  /** 작업 안내 (전체 가이드) */
  작업안내?: string;
}

/** 누구나알바 작업 */
export interface PartTimeTask {
  id: string;
  title: string;
  description: string;
  category: string;
  reward: number;
  /** 모집 인원 (0이면 제한 없음) */
  maxApplicants?: number;
  /** 작업 상세 지시 (제목, 내용, 댓글, 키워드, 이미지, 동영상, gif 등) */
  sections: PartTimeTaskSections;
  /** 신청기간 */
  applicationPeriod: { start: string; end: string };
  /** 작업기간 */
  workPeriod: { start: string; end: string };
  createdAt: string;
  createdBy?: string;
  applicants: PartTimeApplicant[];
  /** 포인트 지급 완료 여부 */
  pointPaid: boolean;
  /** 포인트를 받은 작업자 userId 목록 */
  paidUserIds?: string[];
}

export interface SellerApplication {
  sellerType: 'individual' | 'business';
  appliedAt: string;
  bankInfo: {
    bankName: string;
    accountNo: string;
    ownerName: string;
    email: string;
  };
  businessInfo?: {
    companyName: string;
    registrationNo: string;
    businessType: string;
    repName: string;
    location: string;
  };
  proofs: {
    bankbookImg?: string;
    licenseImg?: string;
  };
}

export interface SMMOrder {
  id: string;
  userId: string;
  userNickname: string;
  orderTime: string;
  platform: string;
  productName: string;
  link: string;
  quantity: number;
  initialCount: number;
  remains: number;
  providerName: string;
  costPrice: number;
  sellingPrice: number;
  profit: number;
  status: string;
  externalOrderId: string;
}

export interface ChannelOrder {
  id: string;
  userId: string;
  userNickname: string;
  orderTime: string;
  productId: string;
  productName: string;
  platform: string;
  price: number;
  status: string;
  paymentId?: string;
  paymentMethod?: string;
  paymentLog?: string;
}

export interface StoreOrder {
  id: string;
  userId: string;
  userNickname: string;
  sellerNickname: string;
  orderTime: string;
  confirmedAt?: string;
  productId: string;
  productName: string;
  tierName: string;
  price: number;
  storeType: StoreType;
  status: '결제완료' | '작업중' | '배송완료' | '구매확정' | '취소';
  paymentId?: string;
  downloadedAt?: string;
  buyerTaxInfo?: string;
  reviewId?: string;
}

export interface EbookTier {
  name: string;
  price: number;
  description: string;
  pageCount: number;
  pdfFile?: string;
}

export interface EbookProduct {
  id: string;
  storeType: StoreType;
  title: string;
  category: string;
  subCategory: string;
  author: string;
  authorId: string;
  thumbnail: string;
  price: number;
  tiers: EbookTier[];
  description: string;
  index?: string;
  serviceMethod?: string;
  faqs?: { question: string, answer: string }[];
  attachedImages?: string[];
  status: 'pending' | 'approved' | 'revision' | 'rejected';
  createdAt: string;
  isPaused?: boolean;
  isPrime?: boolean;
  isHot?: boolean;
  isNew?: boolean;
  rejectionReason?: string;
  snapshot?: Partial<EbookProduct>;
}

export interface ChannelProduct {
  id: string;
  platform: string;
  title: string;
  category: string;
  subscribers: number;
  income: number;
  expense: number;
  price: number;
  thumbnail: string;
  attachedImages?: string[];
  isSoldOut: boolean;
  description?: string;
  isApproved?: boolean;
  isHot?: boolean;
  sourceLink?: string;
  publicLink?: string;
  /** 채널 운영자(문의하기 대상) */
  sellerId?: string;
  sellerNickname?: string;
  sellerImage?: string;
}

export type NotificationType = 'chat' | 'ebook' | 'channel' | 'sns_activation' | 'approval' | 'payment' | 'prohibited' | 'notice' | 'coupon' | 'revenue' | 'review' | 'revision' | 'freelancer';

export interface SiteNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  reason?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  images?: string[];
  date: string;
  isHidden: boolean;
}

export interface Post {
  id: string;
  category: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  authorImage?: string;
  date: string;
  views: number;
  likes: number;
  comments: BoardComment[];
  images?: string[];
  isDeleted?: boolean;
}

export interface BoardComment {
  id: string;
  author: string;
  authorId: string;
  content: string;
  date: string;
  isDeleted: boolean;
  parentId?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  author: string;
  rating: number;
  content: string;
  date: string;
  reply?: string;
  replyDate?: string;
}

export interface WishlistItem {
  type: 'channel' | 'ebook';
  data: ChannelProduct | EbookProduct;
}

export interface Coupon {
  id: string;
  title: string;
  discount: number;
  discountLabel: string;
  type: string;
  expiry: string;
  color: string;
  status: 'available' | 'used';
}

export interface AutoCouponCampaign extends Omit<Coupon, 'id' | 'status' | 'expiry'> {
  id: string;
  targetType: 'all' | 'buyer' | 'seller';
  isActive: boolean;
  expiryDays: number;
}

export interface SMMProvider {
  id: string;
  name: string;
  apiUrl: string;
  isHidden: boolean;
}

export interface SMMSource {
  providerId: string;
  serviceId: string;
  costPrice: number;
}

export interface SMMProduct {
  id: string;
  name: string;
  platform: string;
  category: string;
  sellingPrice: number;
  minQuantity: number;
  maxQuantity: number;
  sources: SMMSource[];
  isHidden?: boolean;
}

export interface SelectedOption {
  id: string;
  serviceId: string;
  serviceName: string;
  link: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export type WorkType = '카페관리' | '블로그대행' | '블로그체험단' | '유튜브' | '인스타그램' | '기타작업';
export type ExpenseCategory = '운영비' | '인건비' | '식비' | '집기구입비' | '구독비' | '기타비용';

export interface OperatingCompany {
  id: string;
  name: string;
  openingDate: string;
  type: '개인사업자' | '법인사업자' | '기타';
  taxBusinessNames: string[];
}

export interface RevenueProject {
  id: string;
  operatingCompanyId: string;
  type: WorkType;
  clientName: string;
  cafeName?: string;
  workLink?: string;
  paymentAmount: number;
  settlementAmount: number;
  taxInvoice: '발행' | '미발행';
  channel: string;
  round: number;
  startDate: string;
  endDate: string;
  status: '진행중' | '완료';
  deadlineType: 'weekday' | 'fixed' | 'specific';
  duration?: number;
  fixedDay?: number;
  createdAt: string;
}

export interface RevenueTodo {
  id: string;
  text: string;
  startDate: string;
  endDate: string;
  completed: boolean;
}

export interface GeneralExpense {
  id: string;
  date: string;
  category: ExpenseCategory;
  note: string;
  amount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  senderImage: string;
  content: string;
  timestamp: string;
  dateStr?: string;
}

export interface GradeConfig {
  id: string;
  name: string;
  minSales: number;
  color: string;
}
