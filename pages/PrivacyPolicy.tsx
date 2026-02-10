
import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: "1. 수집하는 개인정보 항목",
      icon: "👤",
      content: "회사는 회원가입, 원활한 고객상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.\n• 수집항목: 이메일 주소, 닉네임, 프로필 이미지, SNS 계정 정보(연동 시), 결제 기록, 정산 계좌 정보(전문가 회원 한정)."
    },
    {
      title: "2. 개인정보의 수집 및 이용목적",
      icon: "🎯",
      content: "수집한 개인정보를 다음의 목적을 위해 활용합니다.\n• 서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산\n• 회원 관리: 회원제 서비스 이용에 따른 본인확인, 개인 식별, 불량회원의 부정 이용 방지와 비인가 사용 방지\n• 마케팅 및 광고에 활용: 신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공."
    },
    {
      title: "3. 개인정보의 보유 및 이용기간",
      icon: "⏳",
      content: "회사는 회원 탈퇴 시까지 사용자의 개인정보를 보유하며, 탈퇴 즉시 파기하는 것을 원칙으로 합니다. 단, 전자상거래 등에서의 소비자보호에 관한 법률 등 관계법령의 규정에 의하여 보존할 필요가 있는 경우 일정 기간 보존합니다.\n• 계약 또는 청약철회 등에 관한 기록: 5년\n• 대금결제 및 재화 등의 공급에 관한 기록: 5년"
    },
    {
      title: "4. 개인정보의 제3자 제공 및 위탁",
      icon: "🔒",
      content: "회사는 원활한 서비스 제공을 위해 아래와 같은 외부 솔루션을 이용하며 보안을 철저히 관리합니다.\n• 사용자 인증 및 보안: Clerk (Global Auth Engine)\n• 결제 및 보안 전송: PortOne (Safe Payment Gateway)"
    },
    {
      title: "5. 이용자 및 법정대리인의 권리와 그 행사방법",
      icon: "⚖️",
      content: "이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며 가입해지(동의철회)를 요청할 수도 있습니다. '마이페이지 > 계정 관리' 메뉴를 통해 직접 처리하거나 고객센터를 통해 요청하실 수 있습니다."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 animate-in fade-in duration-700">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">Privacy Policy</h2>
          <p className="text-[12px] font-bold text-gray-400 mt-4 uppercase tracking-[0.2em]">더베스트SNS 개인정보처리방침</p>
        </div>
        <button onClick={() => navigate(-1)} className="text-sm font-black text-gray-400 hover:text-gray-900 italic uppercase transition-colors">Back</button>
      </div>

      <div className="bg-white rounded-[56px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-10 md:p-16 space-y-16">
          <div className="bg-blue-50 p-8 rounded-[32px] border border-blue-100 italic">
            <p className="text-blue-700 font-bold leading-relaxed text-[15px]">
              "THEBESTSNS는 사용자의 개인정보를 최우선 가치로 생각하며, 관련 법령을 준수하고 최첨단 보안 솔루션(Clerk & PortOne)을 통해 안전하게 보호하고 있습니다. 본 방침은 서비스 이용자가 신뢰할 수 있는 환경을 제공하기 위해 마련되었습니다."
            </p>
          </div>

          <div className="space-y-12">
            {sections.map((section, idx) => (
              <div key={idx} className="space-y-4 group">
                <div className="flex items-center gap-4">
                  <span className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg group-hover:bg-blue-600 transition-colors">{section.icon}</span>
                  <h3 className="text-xl font-black text-gray-900 italic">{section.title}</h3>
                </div>
                <div className="pl-16">
                  <p className="text-gray-600 font-bold leading-relaxed whitespace-pre-wrap text-[15px]">
                    {section.content}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-16 border-t border-gray-50 text-center">
            <p className="text-[11px] text-gray-300 font-bold uppercase tracking-widest mb-2">Last Updated: 2026. 01. 20</p>
            <p className="text-[11px] text-gray-300 font-bold uppercase tracking-widest italic">THEBESTSNS Security Compliance Team</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
