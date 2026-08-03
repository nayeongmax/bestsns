-- ============================================================
-- 커뮤니티 플랫폼 · Supabase 스키마
-- ------------------------------------------------------------
-- 현재 앱은 백엔드 없이 localStorage 로 완전히 동작하는 프로토타입입니다.
-- 여러 사용자가 공유하는 실제 서비스로 전환하려면:
--   1) Supabase 프로젝트 생성 후 이 SQL 을 SQL Editor 에서 실행
--   2) .env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 입력
--   3) src/lib/store.ts 의 각 함수 내부를 supabase 쿼리로 교체
--      (함수 시그니처는 그대로이므로 UI 는 수정 불필요)
-- ============================================================

-- ---------- 프로필 (auth.users 확장) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null,
  avatar_color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- ---------- 커뮤니티 ----------
create table if not exists communities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  category text not null default '기타',
  theme_color text not null default '#6366f1',
  owner_id uuid not null references profiles(id) on delete cascade,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 게시판 ----------
create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  name text not null,
  "order" int not null default 0,
  is_notice boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 멤버십 ----------
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  unique (community_id, user_id)
);

-- ---------- 게시글 ----------
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  content text not null default '',
  views int not null default 0,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 댓글 ----------
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  parent_id uuid references comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- 추천/비추천 (게시글) ----------
create table if not exists post_reactions (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('like','dislike')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------- 댓글 좋아요 ----------
create table if not exists comment_likes (
  comment_id uuid not null references comments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (comment_id, user_id)
);

-- 조회 성능용 인덱스
create index if not exists idx_posts_community on posts(community_id, created_at desc);
create index if not exists idx_posts_board on posts(board_id, created_at desc);
create index if not exists idx_comments_post on comments(post_id, created_at);
create index if not exists idx_memberships_community on memberships(community_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
alter table profiles         enable row level security;
alter table communities      enable row level security;
alter table boards           enable row level security;
alter table memberships      enable row level security;
alter table posts            enable row level security;
alter table comments         enable row level security;
alter table post_reactions   enable row level security;
alter table comment_likes    enable row level security;

-- 읽기: 공개 데이터는 누구나 열람
create policy "read profiles"     on profiles       for select using (true);
create policy "read communities"  on communities    for select using (true);
create policy "read boards"       on boards         for select using (true);
create policy "read memberships"  on memberships    for select using (true);
create policy "read posts"        on posts          for select using (true);
create policy "read comments"     on comments       for select using (true);
create policy "read reactions"    on post_reactions for select using (true);
create policy "read comment_likes" on comment_likes for select using (true);

-- 프로필: 본인만 생성/수정
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- 커뮤니티: 로그인 유저가 개설, 개설자만 수정/삭제
create policy "create community" on communities for insert with check (auth.uid() = owner_id);
create policy "update own community" on communities for update using (auth.uid() = owner_id);
create policy "delete own community" on communities for delete using (auth.uid() = owner_id);

-- 게시판: 커뮤니티 운영자만 생성/삭제
create policy "manage boards" on boards for all using (
  exists (select 1 from communities c where c.id = boards.community_id and c.owner_id = auth.uid())
);

-- 멤버십: 본인 가입/탈퇴
create policy "join community"  on memberships for insert with check (auth.uid() = user_id);
create policy "leave community" on memberships for delete using (auth.uid() = user_id);

-- 게시글: 로그인 유저 작성, 작성자만 수정/삭제
create policy "create post"     on posts for insert with check (auth.uid() = author_id);
create policy "update own post" on posts for update using (auth.uid() = author_id);
create policy "delete own post" on posts for delete using (auth.uid() = author_id);

-- 댓글: 로그인 유저 작성, 작성자만 삭제
create policy "create comment"     on comments for insert with check (auth.uid() = author_id);
create policy "delete own comment" on comments for delete using (auth.uid() = author_id);

-- 반응/좋아요: 본인 것만
create policy "react post"   on post_reactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "like comment" on comment_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
