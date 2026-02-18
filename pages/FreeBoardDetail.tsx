
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Post, UserProfile, BoardComment, GradeConfig } from '@/types';

interface Props {
  user: UserProfile;
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
}

const FreeBoardDetail: React.FC<Props> = ({ user, posts, setPosts, members = [], gradeConfigs = [] }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [commentInput, setCommentInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentInput, setEditCommentInput] = useState('');
  
  // 답글 관련 상태
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');

  // 삭제 확인 모달을 위한 상태
  const [isPostDeleteModalOpen, setIsPostDeleteModalOpen] = useState(false);
  const [commentToDeleteId, setCommentToDeleteId] = useState<string | null>(null);

  // ID 타입 불일치 방지를 위해 String 변환 후 검색
  const post = posts.find(p => String(p.id) === String(id));

  useEffect(() => {
    if (post) {
      setPosts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, views: p.views + 1 } : p));
    }
  }, [id, setPosts]);

  if (!post) {
    return (
      <div className="max-w-[1600px] mx-auto py-40 text-center animate-in fade-in duration-500">
        <div className="bg-white p-20 rounded-[48px] shadow-sm border border-gray-100">
          <div className="text-6xl mb-6">🚫</div>
          <h2 className="text-2xl font-black text-gray-900 italic mb-4">삭제되었거나 존재하지 않는 게시글입니다.</h2>
          <button onClick={() => navigate('/board')} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black italic shadow-lg">목록으로 돌아가기</button>
        </div>
      </div>
    );
  }

  const isAuthor = user && (String(user.id) === String(post.authorId) || user.nickname === post.author);
  const isAdmin = user && user.role === 'admin';

  const handleLike = () => {
    setPosts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, likes: p.likes + 1 } : p));
  };

  // 게시글 최종 삭제 실행
  const executePostDelete = () => {
    setPosts(currentPosts => currentPosts.filter(p => String(p.id) !== String(id)));
    setIsPostDeleteModalOpen(false);
    navigate('/board', { replace: true });
  };

  // 댓글 최종 삭제 실행
  const executeCommentDelete = () => {
    if (!commentToDeleteId) return;
    setPosts(currentPosts => currentPosts.map(p => {
      if (String(p.id) === String(id)) {
        return {
          ...p,
          comments: p.comments.filter(c => String(c.id) !== String(commentToDeleteId))
        };
      }
      return p;
    }));
    setCommentToDeleteId(null);
  };

  const handleAddComment = (parentId?: string) => {
    const input = parentId ? replyInput : commentInput;
    if (!input.trim()) return;

    const newComment: BoardComment = {
      id: `comm_${Date.now()}`,
      author: user.nickname,
      authorId: user.id,
      content: input,
      date: new Date().toLocaleString(),
      isDeleted: false,
      parentId: parentId // 부모 ID 설정
    };

    setPosts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, comments: [...p.comments, newComment] } : p));
    
    if (parentId) {
      setReplyInput('');
      setReplyingToId(null);
    } else {
      setCommentInput('');
    }
  };

  const startEditComment = (c: BoardComment) => {
    setEditingCommentId(c.id);
    setEditCommentInput(c.content);
  };

  const saveEditComment = () => {
    setPosts(prev => prev.map(p => String(p.id) === String(id) ? { 
      ...p, 
      comments: p.comments.map(c => String(c.id) === String(editingCommentId) ? { ...c, content: editCommentInput } : c) 
    } : p));
    setEditingCommentId(null);
  };

  const renderContentWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-700 transition-colors break-all font-black">
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const activeComments = post.comments.filter(c => !c.isDeleted);
  
  // 부모 댓글(parentId가 없는 것)만 먼저 필터링
  const rootComments = activeComments.filter(c => !c.parentId);

  return (
    <div className="max-w-[1600px] mx-auto pb-32 animate-in fade-in duration-700 px-8 relative">
      {/* 상단 액션 바 */}
      <div className="mb-10 flex items-center justify-between relative z-[50]">
        <button onClick={() => navigate('/board')} className="flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          자유게시판 목록으로
        </button>
        
        {(isAuthor || isAdmin) && (
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => navigate('/board/write', { state: { post } })}
              className="bg-white border-2 border-blue-50 text-blue-500 px-8 py-3 rounded-2xl font-black text-sm italic shadow-sm hover:bg-blue-50 transition-all active:scale-95 cursor-pointer"
            >
              🛠️ 수정하기
            </button>
            <button 
              type="button"
              onClick={() => setIsPostDeleteModalOpen(true)}
              className="bg-red-500 text-white px-8 py-3 rounded-2xl font-black text-sm italic shadow-xl shadow-red-100 hover:bg-black transition-all active:scale-90 cursor-pointer pointer-events-auto"
            >
              🗑️ 삭제하기
            </button>
          </div>
        )}
      </div>

      {/* 메인 게시글 카드 */}
      <div className="bg-white rounded-[56px] shadow-sm border border-gray-100 overflow-hidden mb-12 relative z-[10]">
        <div className="p-10 md:p-20 border-b border-gray-50 bg-gray-50/20">
           <div className="flex gap-3 mb-10">
              <span className={`text-[12px] font-black px-5 py-2 rounded-full italic tracking-widest uppercase shadow-sm ${post.category === '공지' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                {post.category}
              </span>
           </div>
           
           <h1 className="text-4xl md:text-6xl font-black text-gray-900 italic tracking-tighter leading-tight mb-16">
             {post.title}
           </h1>

           <div className="flex justify-between items-center pt-8 border-t border-gray-100/50">
             <div className="flex items-center gap-6">
               <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white shadow-xl bg-gray-100 flex items-center justify-center">
                  <img src={post.authorImage || 'https://picsum.photos/seed/user/200/200'} alt="author" className="w-full h-full object-cover" />
               </div>
               <div className="flex flex-col gap-1">
                  <p className="font-black text-gray-900 text-3xl tracking-tight">{post.author}</p>
                  <p className="text-[13px] font-bold text-gray-400 italic uppercase tracking-[0.2em]">{post.date}</p>
               </div>
             </div>
             
             <div className="flex gap-12 items-center">
                <div className="flex flex-col items-center">
                   <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1 italic">Views</span>
                   <span className="text-gray-900 text-2xl font-black italic tracking-tighter">{post.views.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                   <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1 italic">Likes</span>
                   <span className="text-gray-900 text-2xl font-black italic tracking-tighter">{post.likes}</span>
                </div>
             </div>
           </div>
        </div>

        <div className="p-10 md:p-20 space-y-20">
           <div className="text-2xl font-bold text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[400px]">
             {renderContentWithLinks(post.content)}
           </div>

           {post.images && post.images.length > 0 && (
             <div className="flex flex-col gap-16 pt-20 border-t border-gray-50">
               {post.images.map((img, i) => (
                 <div key={i} className="w-full max-w-5xl mx-auto rounded-[60px] overflow-hidden shadow-2xl border border-gray-100 bg-black/5 group">
                   <img src={img} className="w-full object-contain transition-transform duration-1000 group-hover:scale-105" alt="content attachment" />
                 </div>
               ))}
             </div>
           )}

           <div className="flex justify-center pt-20 border-t border-gray-50">
              <button type="button" onClick={handleLike} className="group flex flex-col items-center gap-5 transition-all">
                <div className="w-32 h-32 rounded-[48px] bg-red-50 text-red-500 flex items-center justify-center text-6xl shadow-2xl shadow-red-100 group-hover:scale-110 group-active:scale-90 transition-all border-8 border-white">❤️</div>
                <span className="font-black text-gray-900 italic text-3xl tracking-tighter uppercase">좋아요: {post.likes}</span>
              </button>
           </div>
        </div>
      </div>

      {/* 댓글 섹션 */}
      <div className="bg-white rounded-[56px] shadow-sm border border-gray-100 p-10 md:p-20 space-y-20 relative z-[5]">
        <h3 className="text-4xl font-black text-gray-900 italic flex items-center gap-5 tracking-tighter">
          <span className="w-4 h-12 bg-blue-600 rounded-full shadow-lg shadow-blue-200"></span> 
          COMMENTS ({activeComments.length})
        </h3>

        <div className="space-y-8">
           <div className="bg-gray-50 p-8 rounded-[48px] border-4 border-transparent focus-within:border-blue-100 focus-within:bg-white transition-all shadow-inner">
             <textarea 
               value={commentInput}
               onChange={e => setCommentInput(e.target.value)}
               placeholder="비방이나 욕설은 차단의 사유가 됩니다. 클린한 게시판 문화를 만들어주세요!"
               className="w-full p-6 bg-transparent outline-none font-bold text-gray-700 text-xl resize-none no-scrollbar"
               rows={4}
             />
             <div className="flex justify-end p-4">
                <button type="button" onClick={() => handleAddComment()} className="bg-blue-600 text-white px-16 py-5 rounded-[32px] font-black text-xl shadow-2xl shadow-blue-200 hover:bg-black transition-all active:scale-95 italic tracking-tighter uppercase">Post Comment</button>
             </div>
           </div>
        </div>

        <div className="space-y-12">
           {rootComments.length === 0 ? (
             <div className="py-32 text-center border-4 border-dashed border-gray-100 rounded-[60px]">
                <p className="text-gray-300 font-black italic text-2xl">아직 댓글이 없습니다. 첫 의견을 남겨주세요!</p>
             </div>
           ) : (
             rootComments.map(c => {
               // 현재 댓글의 답글들 필터링
               const replies = activeComments.filter(r => r.parentId === c.id);

               return (
                 <div key={c.id} className="space-y-4">
                   {/* 메인 댓글 */}
                   <div className="flex gap-8 p-10 bg-gray-50/30 border border-transparent hover:border-gray-100 hover:bg-white rounded-[50px] transition-all group relative">
                     <div className="w-20 h-20 bg-white rounded-[24px] shrink-0 flex items-center justify-center text-4xl shadow-md border border-gray-50">💬</div>
                     <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-6">
                              <span className="font-black text-gray-900 text-2xl italic tracking-tight">{c.author}</span>
                              <span className="text-xs font-bold text-gray-300 italic uppercase tracking-widest">{c.date}</span>
                           </div>
                           <div className="flex gap-6">
                              <button 
                                type="button" 
                                onClick={() => setReplyingToId(replyingToId === c.id ? null : c.id)}
                                className="text-[13px] font-black text-blue-500 hover:text-blue-700 italic underline underline-offset-4"
                              >
                                답글쓰기
                              </button>
                              {(String(c.authorId) === String(user.id) || user.nickname === c.author || isAdmin) && (
                                <>
                                  <button type="button" onClick={() => startEditComment(c)} className="text-[13px] font-black text-blue-400 hover:text-blue-600 italic underline underline-offset-4">수정</button>
                                  <button type="button" onClick={() => setCommentToDeleteId(c.id)} className="text-[13px] font-black text-red-300 hover:text-red-600 italic underline underline-offset-4">삭제</button>
                                </>
                              )}
                           </div>
                        </div>
                        {editingCommentId === c.id ? (
                          <div className="space-y-6">
                             <textarea value={editCommentInput} onChange={e => setEditCommentInput(e.target.value)} className="w-full p-8 bg-white border-2 border-blue-100 rounded-[32px] text-xl font-bold shadow-inner outline-none" />
                             <div className="flex gap-4">
                                <button type="button" onClick={saveEditComment} className="px-10 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black italic shadow-lg shadow-blue-100">수정 완료</button>
                                <button type="button" onClick={() => setEditingCommentId(null)} className="px-10 py-3 bg-gray-100 text-gray-400 rounded-2xl text-sm font-black italic">취소</button>
                             </div>
                          </div>
                        ) : (
                          <p className="text-xl font-bold text-gray-600 leading-relaxed">{renderContentWithLinks(c.content)}</p>
                        )}
                     </div>
                   </div>

                   {/* 답글 리스트 */}
                   {replies.length > 0 && (
                     <div className="pl-16 space-y-4">
                       {replies.map(reply => (
                         <div key={reply.id} className="flex gap-6 p-8 bg-blue-50/20 border border-blue-100/20 rounded-[40px] transition-all group relative">
                           <div className="w-12 h-12 shrink-0 flex items-center justify-center text-2xl text-blue-300">ㄴ</div>
                           <div className="flex-1 space-y-4">
                              <div className="flex justify-between items-center">
                                 <div className="flex items-center gap-6">
                                    <span className="font-black text-gray-900 text-xl italic tracking-tight">{reply.author}</span>
                                    <span className="text-xs font-bold text-gray-300 italic uppercase tracking-widest">{reply.date}</span>
                                 </div>
                                 {(String(reply.authorId) === String(user.id) || user.nickname === reply.author || isAdmin) && (
                                   <div className="flex gap-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button type="button" onClick={() => startEditComment(reply)} className="text-[13px] font-black text-blue-400 hover:text-blue-600 italic underline underline-offset-4">수정</button>
                                      <button type="button" onClick={() => setCommentToDeleteId(reply.id)} className="text-[13px] font-black text-red-300 hover:text-red-600 italic underline underline-offset-4">삭제</button>
                                   </div>
                                 )}
                              </div>
                              {editingCommentId === reply.id ? (
                                <div className="space-y-6">
                                   <textarea value={editCommentInput} onChange={e => setEditCommentInput(e.target.value)} className="w-full p-8 bg-white border-2 border-blue-100 rounded-[32px] text-xl font-bold shadow-inner outline-none" />
                                   <div className="flex gap-4">
                                      <button type="button" onClick={saveEditComment} className="px-10 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black italic shadow-lg shadow-blue-100">수정 완료</button>
                                      <button type="button" onClick={() => setEditingCommentId(null)} className="px-10 py-3 bg-gray-100 text-gray-400 rounded-2xl text-sm font-black italic">취소</button>
                                   </div>
                                </div>
                              ) : (
                                <p className="text-lg font-bold text-gray-600 leading-relaxed">{renderContentWithLinks(reply.content)}</p>
                              )}
                           </div>
                         </div>
                       ))}
                     </div>
                   )}

                   {/* 답글 입력창 (토글 시 노출) */}
                   {replyingToId === c.id && (
                     <div className="pl-24 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-white p-6 rounded-[32px] border-4 border-blue-50 shadow-xl space-y-4">
                           <div className="flex items-center gap-3 text-blue-600 font-black italic text-sm mb-2">
                             <span>↳</span> {c.author}님에게 답글 남기기
                           </div>
                           <textarea 
                             value={replyInput}
                             onChange={e => setReplyInput(e.target.value)}
                             placeholder="답글을 입력하세요..."
                             className="w-full p-5 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 text-lg outline-none shadow-inner resize-none no-scrollbar"
                             rows={3}
                           />
                           <div className="flex justify-end gap-3">
                              <button type="button" onClick={() => setReplyingToId(null)} className="px-8 py-3 bg-gray-100 text-gray-400 rounded-2xl font-black text-sm italic transition-all">취소</button>
                              <button type="button" onClick={() => handleAddComment(c.id)} className="px-12 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm italic shadow-lg shadow-blue-100 hover:bg-black transition-all">답글 등록</button>
                           </div>
                        </div>
                     </div>
                   )}
                 </div>
               );
             })
           )}
        </div>
      </div>

      {/* 게시글 삭제 확인 모달 */}
      {isPostDeleteModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[64px] p-16 shadow-2xl text-center space-y-10 animate-in zoom-in-95 duration-300 border-8 border-red-50">
            <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-5xl mx-auto shadow-inner animate-pulse">⚠️</div>
            <div className="space-y-4">
              <h3 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-red-500 underline-offset-8 decoration-4">Delete Post?</h3>
              <p className="text-[17px] font-bold text-gray-500 leading-relaxed">
                이 게시글을 정말로 삭제하시겠습니까?<br/>
                <span className="text-red-600 font-black italic">삭제 후에는 복구가 불가능합니다.</span>
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-6">
              <button 
                onClick={executePostDelete}
                className="w-full py-6 bg-red-600 text-white rounded-[32px] font-black text-xl shadow-2xl shadow-red-200 hover:bg-black transition-all active:scale-95 italic uppercase tracking-widest"
              >
                Yes, Delete it!
              </button>
              <button 
                onClick={() => setIsPostDeleteModalOpen(false)}
                className="w-full py-6 bg-gray-100 text-gray-400 rounded-[32px] font-black text-xl hover:bg-gray-200 transition-all italic uppercase"
              >
                No, Keep it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 댓글 삭제 확인 모달 */}
      {commentToDeleteId && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[64px] p-16 shadow-2xl text-center space-y-10 animate-in zoom-in-95 duration-300 border-8 border-blue-50">
            <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center text-5xl mx-auto shadow-inner">💬</div>
            <div className="space-y-4">
              <h3 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8 decoration-4">Delete Comment?</h3>
              <p className="text-[17px] font-bold text-gray-500 leading-relaxed">
                작성하신 댓글을 정말로 삭제하시겠습니까?<br/>
                <span className="text-blue-600 font-black italic">삭제된 댓글은 복구할 수 없습니다.</span>
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-6">
              <button 
                onClick={executeCommentDelete}
                className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black text-xl shadow-2xl shadow-blue-200 hover:bg-black transition-all active:scale-95 italic uppercase tracking-widest"
              >
                Delete My Comment
              </button>
              <button 
                onClick={() => setCommentToDeleteId(null)}
                className="w-full py-6 bg-gray-100 text-gray-400 rounded-[32px] font-black text-xl hover:bg-gray-200 transition-all italic uppercase"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreeBoardDetail;
