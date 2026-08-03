import { Board, Comment, Community, DB, Membership, MemberRole, Post, User } from './types';
import { colorFromString, slugify, uid } from './utils';
import { seedDB } from './seed';

/*
 * 데이터 접근 계층.
 *
 * 현재 구현: 브라우저 localStorage (단일 브라우저 내에서 완전 동작하는 프로토타입).
 * 모든 함수는 Promise 를 반환하므로, 추후 supabase.ts 를 사용해 동일한 시그니처로
 * 서버 백엔드(다중 사용자 공유)로 교체할 수 있습니다. UI 코드는 그대로 둡니다.
 *
 * 프로덕션 스키마는 프로젝트 루트의 supabase-schema.sql 참고.
 */

const STORAGE_KEY = 'community-platform-db-v1';

function emptyDB(): DB {
  return { users: [], communities: [], boards: [], memberships: [], posts: [], comments: [] };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch {
    /* ignore */
  }
  const seeded = seedDB(emptyDB());
  save(seeded);
  return seeded;
}

function save(db: DB): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

let _db: DB | null = null;
function db(): DB {
  if (!_db) _db = load();
  return _db;
}
function commit(): void {
  if (_db) save(_db);
}

const delay = <T>(v: T): Promise<T> => Promise.resolve(v);

// ---------------- Users ----------------

export async function createUser(email: string, nickname: string, password: string): Promise<User> {
  const d = db();
  if (d.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('이미 가입된 이메일입니다.');
  }
  if (d.users.some((u) => u.nickname === nickname)) {
    throw new Error('이미 사용 중인 닉네임입니다.');
  }
  const user: User = {
    id: uid('u_'),
    email,
    nickname,
    password,
    avatarColor: colorFromString(nickname),
    createdAt: new Date().toISOString(),
  };
  d.users.push(user);
  commit();
  return delay(user);
}

export async function authenticate(email: string, password: string): Promise<User> {
  const d = db();
  const user = d.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) {
    throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  return delay(user);
}

export async function getUser(id: string): Promise<User | undefined> {
  return delay(db().users.find((u) => u.id === id));
}

// ---------------- Communities ----------------

export async function listCommunities(): Promise<Community[]> {
  return delay([...db().communities]);
}

export async function getCommunityBySlug(slug: string): Promise<Community | undefined> {
  return delay(db().communities.find((c) => c.slug === slug));
}

export async function getCommunity(id: string): Promise<Community | undefined> {
  return delay(db().communities.find((c) => c.id === id));
}

export async function createCommunity(input: {
  name: string;
  description: string;
  category: string;
  ownerId: string;
  isPublic: boolean;
}): Promise<Community> {
  const d = db();
  let slug = slugify(input.name);
  let n = 1;
  while (d.communities.some((c) => c.slug === slug)) {
    slug = slugify(input.name) + '-' + ++n;
  }
  const community: Community = {
    id: uid('c_'),
    slug,
    name: input.name.trim(),
    description: input.description.trim(),
    category: input.category,
    themeColor: colorFromString(input.name + slug),
    ownerId: input.ownerId,
    isPublic: input.isPublic,
    createdAt: new Date().toISOString(),
  };
  d.communities.push(community);

  // 기본 게시판 2개: 공지사항, 자유게시판
  const now = Date.now();
  d.boards.push(
    {
      id: uid('b_'),
      communityId: community.id,
      name: '공지사항',
      order: 0,
      isNotice: true,
      createdAt: new Date(now).toISOString(),
    },
    {
      id: uid('b_'),
      communityId: community.id,
      name: '자유게시판',
      order: 1,
      createdAt: new Date(now + 1).toISOString(),
    }
  );

  // 개설자는 자동으로 운영자(owner) 멤버
  d.memberships.push({
    id: uid('m_'),
    communityId: community.id,
    userId: input.ownerId,
    role: 'owner',
    joinedAt: new Date().toISOString(),
  });

  commit();
  return delay(community);
}

// ---------------- Boards ----------------

export async function listBoards(communityId: string): Promise<Board[]> {
  return delay(
    db()
      .boards.filter((b) => b.communityId === communityId)
      .sort((a, b) => a.order - b.order)
  );
}

export async function createBoard(communityId: string, name: string): Promise<Board> {
  const d = db();
  const existing = d.boards.filter((b) => b.communityId === communityId);
  const board: Board = {
    id: uid('b_'),
    communityId,
    name: name.trim(),
    order: existing.length,
    createdAt: new Date().toISOString(),
  };
  d.boards.push(board);
  commit();
  return delay(board);
}

export async function deleteBoard(boardId: string): Promise<void> {
  const d = db();
  d.boards = d.boards.filter((b) => b.id !== boardId);
  d.posts = d.posts.filter((p) => p.boardId !== boardId);
  commit();
  return delay(undefined);
}

// ---------------- Memberships ----------------

export async function getMembership(
  communityId: string,
  userId: string
): Promise<Membership | undefined> {
  return delay(
    db().memberships.find((m) => m.communityId === communityId && m.userId === userId)
  );
}

export async function memberCount(communityId: string): Promise<number> {
  return delay(db().memberships.filter((m) => m.communityId === communityId).length);
}

export async function joinCommunity(communityId: string, userId: string): Promise<Membership> {
  const d = db();
  const existing = d.memberships.find(
    (m) => m.communityId === communityId && m.userId === userId
  );
  if (existing) return delay(existing);
  const m: Membership = {
    id: uid('m_'),
    communityId,
    userId,
    role: 'member',
    joinedAt: new Date().toISOString(),
  };
  d.memberships.push(m);
  commit();
  return delay(m);
}

export async function leaveCommunity(communityId: string, userId: string): Promise<void> {
  const d = db();
  d.memberships = d.memberships.filter(
    (m) => !(m.communityId === communityId && m.userId === userId && m.role !== 'owner')
  );
  commit();
  return delay(undefined);
}

export async function listMyCommunities(userId: string): Promise<Community[]> {
  const d = db();
  const ids = new Set(
    d.memberships.filter((m) => m.userId === userId).map((m) => m.communityId)
  );
  return delay(d.communities.filter((c) => ids.has(c.id)));
}

export async function listMembers(
  communityId: string
): Promise<{ user: User; role: MemberRole; joinedAt: string }[]> {
  const d = db();
  const out: { user: User; role: MemberRole; joinedAt: string }[] = [];
  for (const m of d.memberships.filter((x) => x.communityId === communityId)) {
    const user = d.users.find((u) => u.id === m.userId);
    if (user) out.push({ user, role: m.role, joinedAt: m.joinedAt });
  }
  return delay(out);
}

// ---------------- Posts ----------------

export interface PostView extends Post {
  authorNickname: string;
  authorColor: string;
  boardName: string;
  commentCount: number;
}

function toPostView(d: DB, p: Post): PostView {
  const author = d.users.find((u) => u.id === p.authorId);
  const board = d.boards.find((b) => b.id === p.boardId);
  return {
    ...p,
    authorNickname: author?.nickname ?? '(탈퇴)',
    authorColor: author?.avatarColor ?? '#94a3b8',
    boardName: board?.name ?? '',
    commentCount: d.comments.filter((c) => c.postId === p.id).length,
  };
}

export async function listPosts(opts: {
  communityId: string;
  boardId?: string;
  limit?: number;
}): Promise<PostView[]> {
  const d = db();
  let posts = d.posts.filter((p) => p.communityId === opts.communityId);
  if (opts.boardId) posts = posts.filter((p) => p.boardId === opts.boardId);
  posts = posts.sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  if (opts.limit) posts = posts.slice(0, opts.limit);
  return delay(posts.map((p) => toPostView(d, p)));
}

export async function getPost(id: string): Promise<PostView | undefined> {
  const d = db();
  const p = d.posts.find((x) => x.id === id);
  return delay(p ? toPostView(d, p) : undefined);
}

export async function incrementViews(id: string): Promise<void> {
  const d = db();
  const p = d.posts.find((x) => x.id === id);
  if (p) {
    p.views += 1;
    commit();
  }
  return delay(undefined);
}

export async function createPost(input: {
  communityId: string;
  boardId: string;
  authorId: string;
  title: string;
  content: string;
}): Promise<Post> {
  const d = db();
  const post: Post = {
    id: uid('p_'),
    communityId: input.communityId,
    boardId: input.boardId,
    authorId: input.authorId,
    title: input.title.trim(),
    content: input.content,
    views: 0,
    likedBy: [],
    dislikedBy: [],
    createdAt: new Date().toISOString(),
  };
  d.posts.push(post);
  commit();
  return delay(post);
}

export async function deletePost(id: string): Promise<void> {
  const d = db();
  d.posts = d.posts.filter((p) => p.id !== id);
  d.comments = d.comments.filter((c) => c.postId !== id);
  commit();
  return delay(undefined);
}

export async function togglePostReaction(
  postId: string,
  userId: string,
  kind: 'like' | 'dislike'
): Promise<Post | undefined> {
  const d = db();
  const p = d.posts.find((x) => x.id === postId);
  if (!p) return delay(undefined);
  p.likedBy = p.likedBy.filter((id) => id !== userId);
  p.dislikedBy = p.dislikedBy.filter((id) => id !== userId);
  if (kind === 'like') p.likedBy.push(userId);
  else p.dislikedBy.push(userId);
  commit();
  return delay(p);
}

// ---------------- Comments ----------------

export interface CommentView extends Comment {
  authorNickname: string;
  authorColor: string;
}

export async function listComments(postId: string): Promise<CommentView[]> {
  const d = db();
  return delay(
    d.comments
      .filter((c) => c.postId === postId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((c) => {
        const author = d.users.find((u) => u.id === c.authorId);
        return {
          ...c,
          authorNickname: author?.nickname ?? '(탈퇴)',
          authorColor: author?.avatarColor ?? '#94a3b8',
        };
      })
  );
}

export async function createComment(input: {
  postId: string;
  authorId: string;
  content: string;
  parentId?: string | null;
}): Promise<Comment> {
  const d = db();
  const c: Comment = {
    id: uid('cm_'),
    postId: input.postId,
    authorId: input.authorId,
    content: input.content.trim(),
    parentId: input.parentId ?? null,
    likedBy: [],
    createdAt: new Date().toISOString(),
  };
  d.comments.push(c);
  commit();
  return delay(c);
}

export async function deleteComment(id: string): Promise<void> {
  const d = db();
  d.comments = d.comments.filter((c) => c.id !== id && c.parentId !== id);
  commit();
  return delay(undefined);
}

export async function toggleCommentLike(id: string, userId: string): Promise<void> {
  const d = db();
  const c = d.comments.find((x) => x.id === id);
  if (c) {
    if (c.likedBy.includes(userId)) c.likedBy = c.likedBy.filter((u) => u !== userId);
    else c.likedBy.push(userId);
    commit();
  }
  return delay(undefined);
}

// ---------------- Stats ----------------

export interface CommunityStat extends Community {
  members: number;
  posts: number;
}

export async function listCommunitiesWithStats(): Promise<CommunityStat[]> {
  const d = db();
  return delay(
    d.communities.map((c) => ({
      ...c,
      members: d.memberships.filter((m) => m.communityId === c.id).length,
      posts: d.posts.filter((p) => p.communityId === c.id).length,
    }))
  );
}
