import React from 'react';
import { useNavigate } from 'react-router-dom';

const MarketingConsentPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 animate-in fade-in duration-700">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">마케팅 정보 수신 동의</h2>
          <p className="text-[12px] font-bold text-gray-400 mt-4 uppercase tracking-[0.2em]">BESTSNS 마케팅 정보 수신 동의서</p>
        </div>
        <button onClick={() => navigate(-1)} className="text-sm font-black text-gray-400 hover:text-gray-900 italic uppercase transition-colors">닫기</button>
      </div>

      <div className="bg-white rounded-[48px] p-10 md:p-14 shadow-sm border border-gray-100 space-y-8 text-gray-700">

        <div className="bg-blue-50 rounded-2xl px-6 py-4">
          <p className="text-sm text-blue-800 font-bold">
            개인정보보호법 제22조 제4항에 의해 선택정보 사항에 대해서는 기재하지 않으셔도 서비스를 이용하실 수 있습니다.
          </p>
        </div>

        <div>
          <p className="font-black text-gray-900 text-lg">1. 마케팅 및 광고에의 활용</p>
          <ul className="mt-3 space-y-2 pl-2 text-sm text-gray-700">
            <li>• 신규 기능 개발 및 맞춤 서비스 제공</li>
            <li>• 뉴스레터 발송, 새로운 기능(제품)의 안내</li>
            <li>• 할인 및 쿠폰 등 이벤트 등의 광고성 정보 제공</li>
          </ul>
        </div>

        <div>
          <p className="font-black text-gray-900 text-lg">2. 마케팅 정보 제공</p>
          <p className="mt-2 text-sm">
            서비스를 운용하는 과정에서 각종 정보를 서비스 화면, 이메일 등의 방법으로 회원에게 제공할 수 있으며, 결제 안내 등 의무적으로 안내해야 하는 정보성 내용 및 일부 혜택성 정보는 수신동의 여부와 무관하게 제공합니다.
          </p>
        </div>

        <div>
          <p className="font-black text-gray-900 text-lg">3. 수신 동의 및 철회</p>
          <p className="mt-2 text-sm">
            더베스트[THEBEST]에서 제공하는 마케팅 정보를 원하지 않을 경우 사이트 고객센터로 문의하셔서 철회를 요청할 수 있습니다. 또한 향후 마케팅 활용에 새롭게 동의하고자 하는 경우 문의하여 동의하실 수 있습니다.
          </p>
        </div>

        <div className="border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-400 font-bold">
            고객센터: 070-4571-9555 &nbsp;|&nbsp; 더베스트[THEBEST] &nbsp;|&nbsp; 대구광역시 달성군 현풍로6길 5
          </p>
        </div>

      </div>
    </div>
  );
};

export default MarketingConsentPage;
