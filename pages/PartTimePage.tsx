
import React from 'react';
import { useNavigate } from 'react-router-dom';

const PartTimePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto py-20 px-4 text-center animate-in fade-in duration-700">
      <div className="bg-white rounded-[60px] p-12 md:p-24 shadow-2xl border border-gray-100 space-y-10 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600"></div>
        
        <div className="w-32 h-32 bg-gray-50 rounded-[40px] flex items-center justify-center text-6xl mx-auto shadow-inner border border-gray-100 transform -rotate-6 hover:rotate-0 transition-transform duration-500">
          🚧
        </div>

        <div className="space-y-6">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 italic tracking-tighter uppercase">
            누구나<span className="text-blue-600">알바</span>
          </h2>
          <div className="h-1 w-24 bg-blue-600 mx-auto rounded-full"></div>
        </div>

        <div className="space-y-4">
          <h3 className="text-2xl md:text-3xl font-black text-gray-800">
            프리랜서 소통방 오픈 준비중
          </h3>
          <p className="text-lg md:text-xl font-bold text-gray-400 italic leading-relaxed">
            보다 전문적이고 신속한 프리랜서 매칭을 위해<br/>
            현재 시스템 고도화 작업이 진행 중입니다.
          </p>
        </div>

        <div className="bg-blue-50/50 p-8 rounded-[32px] border border-blue-100">
           <p className="text-blue-600 font-black text-xl italic animate-pulse">
             " 빠른 시일내에 돌아오겠습니다 "
           </p>
        </div>

        <button 
          onClick={() => navigate('/sns')}
          className="bg-gray-900 text-white px-14 py-6 rounded-[30px] font-black text-xl hover:bg-blue-600 transition-all shadow-xl active:scale-95 italic uppercase tracking-widest"
        >
          돌아가기
        </button>
      </div>

      <p className="mt-12 text-[11px] font-bold text-gray-300 uppercase tracking-[0.4em] italic">
        The Best Social Marketing Platform Business Ecosystem
      </p>
    </div>
  );
};

export default PartTimePage;
