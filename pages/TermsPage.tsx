import React from 'react';
import { useNavigate } from 'react-router-dom';

const TermsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 animate-in fade-in duration-700">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">이용약관</h2>
          <p className="text-[12px] font-bold text-gray-400 mt-4 uppercase tracking-[0.2em]">THEBESTSNS 서비스 이용약관 (통합본)</p>
        </div>
        <button onClick={() => navigate(-1)} className="text-sm font-black text-gray-400 hover:text-gray-900 italic uppercase transition-colors">닫기</button>
      </div>

      <div className="bg-white rounded-[48px] p-10 md:p-14 shadow-sm border border-gray-100 space-y-8 text-gray-700">
        <p className="text-gray-600">이 약관은 플랫폼 이용 규칙과 각 서비스별 특이사항을 담고 있습니다.</p>
        <div className="space-y-6">
          <div>
            <p className="font-black text-gray-900 text-lg">제1조 (핵심 원칙: 직거래 절대 금지)</p>
            <p>THEBESTSNS 내의 모든 거래는 플랫폼 시스템을 통해 결제되어야 합니다. 플랫폼을 통하지 않고 직접 소통하거나 거래(직거래)하는 경우, 광고주와 프리랜서 모두에게 거래액의 10배를 위약벌로 청구하며 서비스 이용이 영구 제한됩니다.</p>
          </div>
          <div>
            <p className="font-black text-gray-900 text-lg">제2조 (서비스별 이용 및 환불 규정)</p>
            <p>THEBESTSNS는 상품의 특성에 따라 개별 규칙을 적용합니다.</p>
            <ul className="mt-2 space-y-2 pl-4">
              <li><strong>SNS 활성화:</strong> 작업 개시 후 중도 취소 불가. 상품에 안내된 일수만큼 수량 복구(A/S) 보장</li>
              <li><strong>채널 판매:</strong> 인도 후 10일간 본 작업 진행 금지. 해킹/회수 시 플랫폼이 A/S 진행 (양수인 과실 제외)</li>
              <li><strong>N잡 스토어:</strong> 디지털 콘텐츠 거래. 파일 다운로드 완료 후 환불 불가 (복제 방지)</li>
              <li><strong>누구나 알바:</strong> 작업 시작 전 전액 취소·환불 가능. 작업 시작 후 프리랜서 선정이 끝난 경우 작업내용 전달이 되어 환불이 어렵습니다.</li>
            </ul>
          </div>
          <div>
            <p className="font-black text-gray-900 text-lg">제3조 (채널 거래 특별 규정)</p>
            <p>구글 계정 이전 시 보안을 위해 약 7일간의 소유주 변경 기간이 소요됨을 인지해야 합니다. 채널 인도 후 안내된 10일의 대기 기간을 어기고 작업을 진행하여 발생하는 계정 문제는 플랫폼이 책임지지 않습니다.</p>
          </div>
          <div>
            <p className="font-black text-gray-900 text-lg">제4조 (저작권 및 무단 복제)</p>
            <p>N잡 스토어에서 구매한 자료를 무단 복제, 배포, 재판매하는 행위는 엄격히 금지되며 발견 시 법적 처벌과 함께 손해배상이 청구됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
