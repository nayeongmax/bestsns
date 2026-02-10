
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';

interface Props {
  user: UserProfile;
}

const CouponBox: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();

  // 유효기간이 지나지 않은 쿠폰만 필터링 (로컬 날짜 기준)
  const displayCoupons = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    return (user.coupons || []).filter(cp => cp.expiry >= now);
  }, [user.coupons]);

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 animate-in fade-in duration-500">
      <button 
        onClick={() => navigate(-1)} 
        className="mb-8 flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 transition-colors group"
      >
        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        뒤로가기
      </button>

      <div className="space-y-12">
        <div className="flex justify-between items-end px-4">
          <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-gray-900 underline-offset-8">쿠폰함</h2>
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">나의 보유 혜택 리스트</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {displayCoupons.length === 0 ? (
            <div className="bg-white p-20 rounded-[48px] border border-dashed border-gray-100 text-center">
              <p className="text-gray-300 font-black italic">보유한 쿠폰이 없거나 만료되었습니다.</p>
            </div>
          ) : displayCoupons.map((cp) => (
            <div 
              key={cp.id} 
              className={`bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 ${cp.status === 'used' ? 'opacity-60 grayscale' : ''}`}
            >
              <div className={`w-32 h-32 rounded-[32px] bg-${cp.color}-50 flex flex-col items-center justify-center shrink-0 border-2 border-${cp.color}-100`}>
                <span className={`text-2xl font-black text-${cp.color}-600 italic underline decoration-2 underline-offset-4`}>{cp.discountLabel}</span>
                <span className={`text-[10px] font-black text-${cp.color}-400 uppercase mt-1`}>Discount</span>
              </div>

              <div className="flex-1 text-center md:text-left space-y-2">
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-2">
                   <span className={`text-[9px] font-black px-2 py-0.5 rounded bg-${cp.color}-100 text-${cp.color}-600 uppercase tracking-tighter`}>{cp.type}</span>
                   {cp.status === 'used' && <span className="text-[9px] font-black px-2 py-0.5 rounded bg-gray-200 text-gray-500 uppercase tracking-tighter">사용완료</span>}
                </div>
                <h3 className="text-2xl font-black text-gray-900 italic">{cp.title}</h3>
                <p className="text-gray-400 font-bold text-sm italic">유효기간: {cp.expiry} 까지</p>
              </div>

              <button 
                disabled={cp.status === 'used'}
                onClick={() => navigate('/payment/point')}
                className={`px-10 py-4 rounded-2xl font-black text-[13px] uppercase italic transition-all ${
                  cp.status === 'used' 
                  ? 'bg-gray-100 text-gray-300' 
                  : `bg-gray-900 text-white hover:bg-blue-600 shadow-xl`
                }`}
              >
                {cp.status === 'used' ? '이미 사용함' : '쿠폰 사용하기'}
              </button>
              
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-[#F8FAFC] rounded-full border-r border-gray-100"></div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 bg-[#F8FAFC] rounded-full border-l border-gray-100"></div>
            </div>
          ))}
        </div>

        <div className="bg-white p-12 rounded-[56px] border border-gray-100 text-center space-y-6 shadow-sm">
           <h4 className="text-xl font-black text-gray-900 italic">쿠폰 등록하기</h4>
           <div className="max-w-md mx-auto flex gap-3">
              <input type="text" placeholder="쿠폰 코드를 입력하세요" className="flex-1 p-5 bg-gray-50 border-none rounded-2xl font-black text-gray-700 shadow-inner outline-none focus:ring-4 focus:ring-blue-50" />
              <button className="bg-blue-600 text-white px-8 rounded-2xl font-black shadow-lg hover:bg-black transition-all">등록</button>
           </div>
           <p className="text-[11px] text-gray-400 font-bold italic underline decoration-gray-200 underline-offset-4 uppercase tracking-widest">Marketing campaign coupons</p>
        </div>
      </div>
    </div>
  );
};

export default CouponBox;
