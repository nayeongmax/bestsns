
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, Review } from '../types';

interface Props {
  user: UserProfile;
  onAddReview: (review: Review) => void;
}

const ReviewWritePage: React.FC<Props> = ({ user, onAddReview }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const order = location.state?.order;

  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-32 text-center">
        <p className="text-gray-400 font-black italic">잘못된 접근입니다.</p>
        <button onClick={() => navigate('/mypage')} className="mt-4 px-8 py-3 bg-gray-900 text-white rounded-xl">마이페이지로</button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return alert('리뷰 내용을 입력해주세요.');

    const newReview: Review = {
      id: `rev_${Date.now()}`,
      productId: order.productId,
      userId: user.id,
      author: user.nickname,
      rating,
      content,
      date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/ /g, '')
    };

    onAddReview(newReview);
    alert('소중한 리뷰가 등록되었습니다!');
    navigate('/mypage');
  };

  return (
    <div className="max-w-2xl mx-auto pb-32 animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-orange-500 underline-offset-8">리뷰 작성하기</h2>
        <p className="text-sm font-bold text-gray-400 mt-4 uppercase tracking-widest italic">Product Review & Satisfaction</p>
      </div>

      <div className="bg-white rounded-[48px] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-10 border-b border-gray-50 bg-gray-50/30 flex items-center gap-6">
           <img src={order.thumbnail || 'https://picsum.photos/seed/p1/200/200'} className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-lg" alt="thumb" />
           <div>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic">#{order.id}</span>
              <h3 className="text-xl font-black text-gray-900 leading-tight mt-1">{order.productName}</h3>
           </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 md:p-14 space-y-12">
           <div className="flex flex-col items-center gap-4">
              <span className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em] italic">서비스 만족도는 어떠셨나요?</span>
              <div className="flex gap-4">
                 {[1, 2, 3, 4, 5].map(star => (
                   <button 
                    key={star} 
                    type="button" 
                    onClick={() => setRating(star)}
                    className={`text-5xl transition-all hover:scale-125 ${star <= rating ? 'text-yellow-400 drop-shadow-md' : 'text-gray-200'}`}
                   >
                     ★
                   </button>
                 ))}
              </div>
              <span className="text-lg font-black text-gray-900 italic">{rating} / 5</span>
           </div>

           <div className="space-y-4">
              <label className="text-[12px] font-black text-gray-400 px-4 uppercase italic">Review Content</label>
              <textarea 
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="전문가의 서비스 품질, 속도, 친절도 등을 상세하게 작성해 주시면 다른 구매자들에게 큰 도움이 됩니다."
                rows={8}
                className="w-full p-8 bg-gray-50 border-none rounded-[40px] font-bold text-gray-700 outline-none shadow-inner focus:ring-4 focus:ring-orange-50 transition-all resize-none leading-relaxed"
              />
           </div>

           <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-6 bg-gray-100 text-gray-400 rounded-[28px] font-black text-lg uppercase italic transition-all hover:bg-gray-200"
              >
                취소
              </button>
              <button 
                type="submit"
                className="flex-[2] py-6 bg-orange-500 text-white rounded-[28px] font-black text-xl shadow-2xl shadow-orange-100 hover:bg-black transition-all italic uppercase tracking-widest active:scale-95"
              >
                리뷰 등록하기 🚀
              </button>
           </div>
        </form>
      </div>
      
      <div className="mt-10 bg-blue-50/50 p-8 rounded-[32px] border border-blue-100 space-y-3">
         <h5 className="font-black text-blue-900 text-sm italic">💡 작성 안내</h5>
         <ul className="text-[12.5px] text-blue-700 font-bold space-y-1 opacity-70">
            <li>• 욕설, 비방, 광고 등 커뮤니티 가이드에 어긋나는 내용은 삭제될 수 있습니다.</li>
            <li>• 사진을 포함한 상세 리뷰는 전문가에게 큰 힘이 됩니다.</li>
         </ul>
      </div>
    </div>
  );
};

export default ReviewWritePage;
