import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, FreelancerApplication } from '@/types';
import { compressImageForStorage } from '@/utils/imageCompress';

interface Props {
  user: UserProfile;
  onClose: () => void;
  onSubmit: (app: FreelancerApplication) => void;
}

const FreelancerRegistrationModal: React.FC<Props> = ({ user, onClose, onSubmit }) => {
  const navigate = useNavigate();
  const idCardRef = useRef<HTMLInputElement>(null);
  const bankbookRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    contact: '',
    residentNumber: '',
    bankName: '',
    accountNo: '',
    ownerName: '',
    idCardImage: '' as string | undefined,
    bankbookImage: '' as string | undefined,
  });
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agree3, setAgree3] = useState(false);
  const [agree4, setAgree4] = useState(false);
  const [agree5, setAgree5] = useState(false);

  const handleImage = async (field: 'idCardImage' | 'bankbookImage', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      try {
        const compressed = await compressImageForStorage(raw);
        setForm((f) => ({ ...f, [field]: compressed }));
      } catch {
        setForm((f) => ({ ...f, [field]: raw }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.contact?.trim() || !form.residentNumber?.trim()) {
      alert('이름, 연락처, 주민등록번호를 모두 입력해 주세요.');
      return;
    }
    if (!form.bankName?.trim() || !form.accountNo?.trim() || !form.ownerName?.trim()) {
      alert('은행명, 계좌번호, 예금주를 모두 입력해 주세요.');
      return;
    }
    if (!form.idCardImage || !form.bankbookImage) {
      alert('신분증과 통장 이미지를 모두 첨부해 주세요.');
      return;
    }
    if (!agree1 || !agree2 || !agree3 || !agree4 || !agree5) {
      alert('필수 동의 항목에 모두 체크해 주세요.');
      return;
    }
    const app: FreelancerApplication = {
      appliedAt: new Date().toISOString(),
      name: form.name.trim(),
      contact: form.contact.trim(),
      residentNumber: form.residentNumber.trim(),
      bankName: form.bankName.trim(),
      accountNo: form.accountNo.trim(),
      ownerName: form.ownerName.trim(),
      idCardImage: form.idCardImage,
      bankbookImage: form.bankbookImage,
    };
    onSubmit(app);
    alert('프리랜서 등록 신청이 완료되었습니다.\n운영자가 일치하는지 확인 후 승인됩니다.\n2~3일 소요됩니다.');
    onClose();
    navigate('/mypage');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[32px] p-8 md:p-12 max-w-2xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-100 my-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-gray-900">프리랜서 등록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800 text-2xl font-bold">×</button>
        </div>

        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="font-black text-amber-800 text-sm">⚠️ 프리랜서계약이 가능한 분만 신청하세요.</p>
            <p className="text-amber-700 text-sm mt-2">투잡이 불가한 직업을 가진 프리랜서이신 분은 신중히 고민하시고 신청하세요.</p>
            <p className="text-amber-700 text-sm mt-1">투잡이 불가능한데 투잡을 하여 생기는 법적인 문제에 대해서는 전적으로 프리랜서에게 있습니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-2">실명 (이름) *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="본인 실명" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-2">연락처 *</label>
              <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="010-0000-0000" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-2">주민등록번호 *</label>
              <input value={form.residentNumber} onChange={(e) => setForm({ ...form, residentNumber: e.target.value })} placeholder="000000-0000000" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2">은행명 *</label>
                <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="은행명" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2">계좌번호 *</label>
                <input value={form.accountNo} onChange={(e) => setForm({ ...form, accountNo: e.target.value })} placeholder="- 제외" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2">예금주 *</label>
                <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="예금주명" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2">신분증 이미지 *</label>
                <input ref={idCardRef} type="file" accept="image/*" onChange={(e) => handleImage('idCardImage', e)} className="hidden" />
                <button type="button" onClick={() => idCardRef.current?.click()} className="w-full px-4 py-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 text-gray-500 font-bold text-sm">
                  {form.idCardImage ? '✓ 첨부됨' : '이미지 선택'}
                </button>
                {form.idCardImage && <img src={form.idCardImage} alt="신분증" className="mt-2 h-24 object-contain rounded-lg border" />}
              </div>
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2">통장 이미지 *</label>
                <input ref={bankbookRef} type="file" accept="image/*" onChange={(e) => handleImage('bankbookImage', e)} className="hidden" />
                <button type="button" onClick={() => bankbookRef.current?.click()} className="w-full px-4 py-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 text-gray-500 font-bold text-sm">
                  {form.bankbookImage ? '✓ 첨부됨' : '이미지 선택'}
                </button>
                {form.bankbookImage && <img src={form.bankbookImage} alt="통장" className="mt-2 h-24 object-contain rounded-lg border" />}
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agree1} onChange={(e) => setAgree1(e.target.checked)} className="mt-1 rounded" />
                <span className="text-sm">(필수) 프리랜서계약이 가능한 자만 신청가능합니다. 위 내용이 사실과 다를 경우 책임을 질 것에 동의합니다.</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agree2} onChange={(e) => setAgree2(e.target.checked)} className="mt-1 rounded" />
                <span className="text-sm">(필수) 본 건은 플랫폼으로부터 위탁받은 업무임을 인지합니다.</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agree3} onChange={(e) => setAgree3(e.target.checked)} className="mt-1 rounded" />
                <span className="text-sm">(필수) 작업이 완료된 후 대금 지급 절차를 위한 용도로만 개인정보를 수집하고 있습니다.</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agree4} onChange={(e) => setAgree4(e.target.checked)} className="mt-1 rounded" />
                <span className="text-sm">(필수) 본 작업과 관련된 작업결과물 및 게시글 및 대화 기록은 삭제할 수 없음에 동의합니다.</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agree5} onChange={(e) => setAgree5(e.target.checked)} className="mt-1 rounded" />
                <span className="text-sm">(필수) 직거래 시도 시 거래액의 10배 위약벌 청구 및 영구 제명 조치에 동의합니다.</span>
              </label>
            </div>
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={onClose} className="flex-1 py-4 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">취소</button>
              <button type="submit" className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">신청하기</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FreelancerRegistrationModal;
