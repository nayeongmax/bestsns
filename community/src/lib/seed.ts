import { DB, User } from './types';
import { colorFromString, uid } from './utils';

/**
 * 최초 실행 시 데모 데이터를 채웁니다.
 * 데모 계정 3개 + 커뮤니티 3개 + 게시판/글/댓글.
 * 데모 계정 비밀번호는 모두 "1234".
 */
export function seedDB(db: DB): DB {
  const now = Date.now();
  const iso = (offsetMin: number) => new Date(now - offsetMin * 60000).toISOString();

  const mkUser = (nickname: string, email: string): User => ({
    id: uid('u_'),
    email,
    nickname,
    password: '1234',
    avatarColor: colorFromString(nickname),
    createdAt: iso(60 * 24 * 30),
  });

  const admin = mkUser('운영자', 'admin@demo.com');
  const gamja = mkUser('감자도리', 'gamja@demo.com');
  const bung = mkUser('붕어빵', 'bung@demo.com');
  db.users.push(admin, gamja, bung);

  interface SeedCommunity {
    name: string;
    slug: string;
    description: string;
    category: string;
    ownerId: string;
    boards: string[];
    posts: {
      board: number;
      author: string;
      title: string;
      content: string;
      views: number;
      likes: string[];
      ageMin: number;
      comments?: { author: string; content: string; ageMin: number }[];
    }[];
  }

  const seedCommunities: SeedCommunity[] = [
    {
      name: '오늘의 유머',
      slug: 'humor',
      description: '웃긴 짤과 일상 이야기를 나누는 곳. 눈팅 환영, 첫 글 대환영!',
      category: '유머/일상',
      ownerId: admin.id,
      boards: ['공지사항', '자유게시판', '유머짤방', '오늘있었던일'],
      posts: [
        {
          board: 0,
          author: admin.id,
          title: '📢 오늘의 유머 커뮤니티 이용 규칙 안내',
          content:
            '안녕하세요! 즐거운 커뮤니티를 위해 아래 규칙을 지켜주세요.\n\n1. 서로 존중하기\n2. 무단 광고/도배 금지\n3. 저작권 주의\n\n즐겁게 활동해요 😊',
          views: 342,
          likes: [gamja.id, bung.id],
          ageMin: 60 * 24 * 5,
        },
        {
          board: 2,
          author: gamja.id,
          title: '우리집 고양이 근황.jpg',
          content: '오늘도 식빵 굽는 중입니다 🍞🐱 너무 귀엽지 않나요?',
          views: 1204,
          likes: [admin.id, bung.id],
          ageMin: 120,
          comments: [
            { author: bung.id, content: '와 진짜 식빵이네요 ㅋㅋㅋ', ageMin: 90 },
            { author: admin.id, content: '개추 누르고 갑니다', ageMin: 40 },
          ],
        },
        {
          board: 3,
          author: bung.id,
          title: '오늘 지하철에서 있었던 일',
          content: '자리 양보했더니 할머니가 사탕 주셨어요. 소소하지만 기분 좋은 하루 :)',
          views: 530,
          likes: [gamja.id],
          ageMin: 240,
          comments: [{ author: gamja.id, content: '훈훈하네요 ㅎㅎ', ageMin: 200 }],
        },
      ],
    },
    {
      name: '주식·코인 라운지',
      slug: 'invest',
      description: '재테크와 투자 정보를 공유합니다. 투자는 본인 책임! 정보 공유는 자유롭게.',
      category: '재테크/투자',
      ownerId: gamja.id,
      boards: ['공지사항', '자유게시판', '종목토론', '코인'],
      posts: [
        {
          board: 2,
          author: gamja.id,
          title: '요즘 반도체주 어떻게 보시나요?',
          content: '조정 오면 분할매수 생각 중인데 다들 의견 어떠신가요?',
          views: 890,
          likes: [bung.id],
          ageMin: 300,
          comments: [
            { author: bung.id, content: '저는 관망 중입니다', ageMin: 250 },
            { author: admin.id, content: '장기로 보면 나쁘지 않을 듯', ageMin: 180 },
          ],
        },
        {
          board: 1,
          author: bung.id,
          title: '가계부 앱 추천 좀 해주세요',
          content: '지출 관리 시작해보려는데 다들 뭐 쓰시나요?',
          views: 210,
          likes: [],
          ageMin: 500,
        },
      ],
    },
    {
      name: '자취생 요리방',
      slug: 'cook',
      description: '혼밥·자취 요리 레시피와 꿀팁 공유. 초보 요리사 환영!',
      category: '음식/요리',
      ownerId: bung.id,
      boards: ['공지사항', '자유게시판', '레시피', '주방템추천'],
      posts: [
        {
          board: 2,
          author: bung.id,
          title: '3분 완성 계란볶음밥 레시피',
          content:
            '찬밥 + 계란 2개 + 대파 + 간장 한스푼. 센불에 빠르게 볶으면 끝!\n초보도 실패 없는 자취 만능 메뉴입니다.',
          views: 1580,
          likes: [admin.id, gamja.id],
          ageMin: 60,
          comments: [{ author: gamja.id, content: '오늘 저녁 이걸로 결정', ageMin: 30 }],
        },
      ],
    },
  ];

  for (const sc of seedCommunities) {
    const communityId = uid('c_');
    db.communities.push({
      id: communityId,
      slug: sc.slug,
      name: sc.name,
      description: sc.description,
      category: sc.category,
      themeColor: colorFromString(sc.name + sc.slug),
      ownerId: sc.ownerId,
      isPublic: true,
      createdAt: iso(60 * 24 * 20),
    });

    const boardIds: string[] = [];
    sc.boards.forEach((name, i) => {
      const id = uid('b_');
      boardIds.push(id);
      db.boards.push({
        id,
        communityId,
        name,
        order: i,
        isNotice: i === 0,
        createdAt: iso(60 * 24 * 20),
      });
    });

    // 개설자 owner + 나머지 데모 유저 member 가입
    db.memberships.push({
      id: uid('m_'),
      communityId,
      userId: sc.ownerId,
      role: 'owner',
      joinedAt: iso(60 * 24 * 20),
    });
    for (const u of [admin, gamja, bung]) {
      if (u.id === sc.ownerId) continue;
      db.memberships.push({
        id: uid('m_'),
        communityId,
        userId: u.id,
        role: 'member',
        joinedAt: iso(60 * 24 * 10),
      });
    }

    for (const p of sc.posts) {
      const postId = uid('p_');
      db.posts.push({
        id: postId,
        communityId,
        boardId: boardIds[p.board],
        authorId: p.author,
        title: p.title,
        content: p.content,
        views: p.views,
        likedBy: p.likes,
        dislikedBy: [],
        pinned: p.board === 0,
        createdAt: iso(p.ageMin),
      });
      for (const c of p.comments ?? []) {
        db.comments.push({
          id: uid('cm_'),
          postId,
          authorId: c.author,
          content: c.content,
          parentId: null,
          likedBy: [],
          createdAt: iso(c.ageMin),
        });
      }
    }
  }

  return db;
}
