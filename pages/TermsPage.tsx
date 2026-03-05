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

          <div>
            <p className="font-black text-gray-900 text-lg">제9조 (포인트 환불)</p>
            <p>환불수수료는 환불 금액이 1만원 이하인 경우 1,000원을, 1만원 초과 시 환불 금액의 10%를 반영합니다.</p>
            <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-1 text-sm text-gray-600">
              <p className="font-bold">[환불 수수료 예시]</p>
              <p>남은 잔액이 6천원인 경우 환불 수수료 1,000원 제외하고 환불 가능</p>
              <p>남은 잔액이 24,000원인 경우 환불 수수료 2,400원 제외하고 환불 가능</p>
            </div>
            <ul className="mt-3 space-y-3 pl-2">
              <li>
                <p>4. 3항에도 불구하고 승전에 해당되는 결제수단의 결제 승인의 취소 또는 해당 결제수단으로 결제금액을 재 환원하는 것으로 환불을 대신할 수 있는 때에는 위약금을 징수하지 않습니다.</p>
                <div className="mt-1 pl-4 border-l-2 border-gray-200 text-sm text-gray-600">
                  <p className="font-bold">[수수료 차감 없이 취소 가능 예시]</p>
                  <p>1) 카드결제 이후 3일 내</p>
                </div>
              </li>
              <li>5. 아래의 내용에 해당하는 경우 환불 신청을 통하여 포인트가 정한 절차에 의거 환불을 받을 수 있습니다.
                <ul className="mt-1 pl-4 space-y-1 text-sm text-gray-600">
                  <li>1) 포인트를 충전했으나 포인트를 사용할 수 있는 서비스가 전무하며 그에 대한 책임이 전적으로 플랫폼에 있는 경우 (단, 시스템의 정기점검 등 불가피한 경우는 제외)</li>
                </ul>
              </li>
              <li>6. 환불 절차는 아래와 같습니다.
                <ul className="mt-1 pl-4 space-y-1 text-sm text-gray-600">
                  <li>1) 제9조 6항의 각 호에 해당하는 경우 고객은 환불 신청을 할 수 있으며, 환불 신청을 접수 받은 포인트는 고객의 환불 신청 사유가 정당하다고 판단된 경우에 한해 환불합니다.</li>
                  <li>2) 각 호의 규정에 의거하여 포인트는 고객의 환불 신청을 확인한 시점에서 10일 이내에 직접 환불 처리합니다.</li>
                  <li>3) 위의 제 9조 6항 2호에 의한 이유로 이용자가 환불을 신청하면, 환불 수수료를 제외한 금액을 환불 받게 되며, 환불 대상 금액이 환불 수수료 미만인 경우에는 환불 받으실 수 없습니다.</li>
                </ul>
              </li>
              <li>7. 3항 및 4항의 규정에도 불구하고, 아래에 해당하는 경우 포인트는 환불이 불가합니다.
                <ul className="mt-1 pl-4 space-y-1 text-sm text-gray-600">
                  <li>1) 타인에게 양도된 포인트</li>
                  <li>2) 이벤트 등으로 받은 포인트</li>
                  <li>3) 이용자가 직접 충전하지 않은 포인트</li>
                </ul>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제11조 (개인정보 수집 및 보호)</p>
            <ul className="mt-2 space-y-3 pl-2 text-sm text-gray-700">
              <li>1. 더베스트[THEBEST]는 서비스 제공을 위한 목적으로 이용자의 동의를 얻어 수집한 개인정보를 본인의 승낙 없이 타인에게 누설할 수 없으며, 서비스 제공 목적 이외의 용도로 사용하지 않습니다. 다만, 관련 법령에 의한 수사상의 목적 등으로 관계 기관으로부터 요구 받은 경우나 방송통신심의위원회의 요청이 있는 경우 등 법령에 따른 적법한 절차에 의한 경우에는 그러하지 아니합니다.</li>
              <li>2. 더베스트[THEBEST]는 필요한 경우 이용자의 동의를 얻어 이용자의 개인정보를 이용하거나 제3자에게 제공할 수 있습니다. 이 경우 그 개인정보의 이용 목적, 제공받는 자, 제공하는 개인정보 항목, 제공 목적, 제공 시기 등에 대해 개별적으로 이용자의 동의를 받습니다.</li>
              <li>3. 더베스트[THEBEST]는 이용자의 개인정보 보호와 관련하여 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 통신비밀보호법, 전기통신사업법 등 관련 법령을 준수합니다.</li>
              <li>4. 이용자의 개인정보 열람 요청은 관련 법령에 따라 수사기관의 수사 자료제공 절차에 의해서 가능하며 이용자는 자신의 개인정보 도용 등을 이유로 타인의 개인정보를 열람할 수 없습니다.</li>
              <li>5. 본 조에서 정한 사항 이외의 이용자의 개인정보 보호에 관한 사항은 더베스트[THEBEST]가 제정한 '개인정보 처리방침'에서 정한 바에 의합니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
