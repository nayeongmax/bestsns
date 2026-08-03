// 커뮤니티 플랫폼 도메인 타입

export type MemberRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  nickname: string;
  /** 아바타 배경색 (해시로 생성) */
  avatarColor: string;
  createdAt: string;
  /** 데모(localStorage) 모드에서만 사용. 실제 서비스는 Supabase Auth 사용 */
  password?: string;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  /** 커버/테마 색 */
  themeColor: string;
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
}

export interface Board {
  id: string;
  communityId: string;
  name: string;
  /** 정렬 순서 */
  order: number;
  /** 공지 전용 게시판 여부 */
  isNotice?: boolean;
  createdAt: string;
}

export interface Membership {
  id: string;
  communityId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

export interface Post {
  id: string;
  communityId: string;
  boardId: string;
  authorId: string;
  title: string;
  content: string;
  views: number;
  /** 추천한 유저 id 목록 */
  likedBy: string[];
  /** 비추천한 유저 id 목록 */
  dislikedBy: string[];
  /** 상단 고정 */
  pinned?: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  /** 대댓글 부모 (없으면 최상위) */
  parentId: string | null;
  likedBy: string[];
  createdAt: string;
}

export interface DB {
  users: User[];
  communities: Community[];
  boards: Board[];
  memberships: Membership[];
  posts: Post[];
  comments: Comment[];
}

export const CATEGORIES = [
  '유머/일상',
  '게임',
  '스포츠',
  'IT/테크',
  '자동차',
  '재테크/투자',
  '취미/DIY',
  '연예/방송',
  '음식/요리',
  '반려동물',
  '여행',
  '학업/교육',
  '기타',
] as const;
