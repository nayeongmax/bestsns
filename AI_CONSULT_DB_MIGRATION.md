# AI 컨설팅 DB 저장 가이드

회원별 채팅 이력 보관, 상담 이력 관리, 질문/응답 기반 통계/분석을 위한 설정입니다.

---

## 실행 순서

1~5단계 실행 후:
6. **`supabase-setup-6단계-AI컨설팅.sql`** 실행

---

## 테이블 구조

### ai_consult_sessions
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | PK |
| user_id | TEXT | 회원 ID (NULL: 비로그인) |
| user_nickname | TEXT | 회원 닉네임 |
| started_at | TIMESTAMPTZ | 세션 시작 시각 |
| updated_at | TIMESTAMPTZ | 마지막 메시지 시각 |
| message_count | INTEGER | 메시지 수 |

### ai_consult_messages
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT | PK |
| session_id | TEXT | FK → ai_consult_sessions |
| role | TEXT | user \| bot |
| content | TEXT | 메시지 내용 |
| created_at | TIMESTAMPTZ | 생성 시각 |

---

## 기능

1. **로그인 회원**이 AI 컨설팅에서 질문/응답 시 DB에 자동 저장
2. **관리자** → 어드민 패널 → **AI 상담 이력** 탭에서:
   - 총 상담 세션/메시지 수
   - 인기 질문 Top 10
   - 상담 이용 회원 Top 10
   - 세션별 전체 대화 내용 조회 (펼쳐보기)

---

## 비로그인 사용자

- 상담은 가능하나 DB에 저장되지 않음
- 통계에는 포함되지 않음
