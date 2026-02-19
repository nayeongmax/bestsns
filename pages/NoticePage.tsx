
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notice, UserProfile } from '@/types';
import { deleteNotice } from '../siteDb';
import { useConfirm } from '@/contexts/ConfirmContext';

interface Props {
  notices: Notice[];
  setNotices: React.Dispatch<React.SetStateAction<Notice[]>>;
  user: UserProfile;
}

const NoticePage: React.FC<Props> = ({ notices, setNotices, user }) => {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useConfirm();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  
  // 작성 폼 상태
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user.role === 'admin';

  // 이미지 압축 유틸리티 함수
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // 웹 공지사항에 적합한 최대 너비
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // 품질을 0.7(70%)로 조정하여 용량을 대폭 줄임
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 10 - newImages.length;
    if (remainingSlots <= 0) return void showAlert({ description: '이미지는 최대 10장까지만 첨부 가능합니다.' });

    // Added explicit cast to File[] to resolve TypeScript argument type error in the loop
    const selectedFiles = Array.from(files).slice(0, remainingSlots) as File[];
    
    for (const file of selectedFiles) {
      const compressedDataUrl = await compressImage(file);
      setNewImages(prev => [...prev, compressedDataUrl]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeNewImage = (idx: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveNotice = () => {
    if (!newTitle.trim() || !newContent.trim()) return void showAlert({ description: '제목과 내용을 모두 입력해주세요.' });

    const newNotice: Notice = {
      id: Date.now().toString(),
      title: newTitle,
      content: newContent,
      images: newImages,
      date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      isHidden: false
    };

    setNotices(prev => [newNotice, ...prev]);
    setIsWriting(false);
    setNewTitle('');
    setNewContent('');
    setNewImages([]);
    showAlert({ description: '공지사항이 등록되었습니다.' });
  };

  const toggleVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotices(prev => prev.map(n => n.id === id ? { ...n, isHidden: !n.isHidden } : n));
  };

  const displayNotices = isAdmin ? notices : notices.filter(n => !n.isHidden);

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 animate-in fade-in duration-500">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-orange-500 underline-offset-8">Official Notice</h2>
          <p className="text-[12px] font-bold text-gray-400 mt-4 uppercase tracking-[0.2em]">공식 소식과 중요 안내를 전해드립니다.</p>
        </div>
        <div className="flex gap-4">
          {isAdmin && !isWriting && (
            <button 
              onClick={() => setIsWriting(true)}
              className="bg-black text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-orange-600 transition-all shadow-xl italic uppercase tracking-tighter"
            >
              🖋️ 공지사항 작성
            </button>
          )}
          <button onClick={() => navigate(-1)} className="text-sm font-black text-gray-400 hover:text-gray-900 italic uppercase">Back</button>
        </div>
      </div>

      {/* 작성 모드 UI */}
      {isWriting && (
        <div className="mb-12 bg-white rounded-[48px] p-10 shadow-2xl border-4 border-orange-500/10 space-y-8 animate-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xl font-black text-gray-900 italic uppercase underline decoration-orange-200 underline-offset-4">New Announcement</h3>
            <button onClick={() => setIsWriting(false)} className="text-gray-300 hover:text-gray-900 font-black text-xl">✕</button>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-4 uppercase italic">Title</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="공지사항 제목을 입력하세요" 
                className="w-full p-6 bg-gray-50 border-none rounded-[28px] font-black text-lg outline-none shadow-inner focus:ring-4 focus:ring-orange-50 transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-400 px-4 uppercase italic">Content</label>
              <textarea 
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={10}
                placeholder="공지 내용을 상세히 입력하세요" 
                className="w-full p-8 bg-gray-50 border-none rounded-[40px] font-bold text-gray-700 leading-relaxed outline-none shadow-inner focus:ring-4 focus:ring-orange-50 transition-all resize-none"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <label className="text-[11px] font-black text-gray-400 uppercase italic">Images ({newImages.length}/10)</label>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white border border-gray-200 text-gray-400 px-5 py-2 rounded-xl text-[10px] font-black hover:text-orange-500 hover:border-orange-200 transition-all shadow-sm"
                >
                  + 이미지 추가
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
              </div>
              
              {newImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-2">
                  {newImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-md group">
                      <img src={img} className="w-full h-full object-cover" alt="upload" />
                      <button 
                        onClick={() => removeNewImage(idx)}
                        className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <button onClick={() => setIsWriting(false)} className="flex-1 py-5 bg-gray-50 text-gray-400 rounded-[24px] font-black text-lg hover:bg-gray-100 transition-all uppercase italic">Cancel</button>
            <button onClick={handleSaveNotice} className="flex-[2] py-5 bg-black text-white rounded-[24px] font-black text-lg shadow-xl hover:bg-blue-600 transition-all uppercase italic tracking-widest">Publish Notice</button>
          </div>
        </div>
      )}

      {/* 리스트 출력 */}
      <div className="space-y-4">
        {displayNotices.length === 0 ? (
          <div className="bg-white p-20 rounded-[48px] border border-dashed text-center">
            <p className="text-gray-300 font-black italic">현재 등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          displayNotices.map((n) => (
            <div key={n.id} className={`bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm transition-all ${n.isHidden ? 'bg-gray-50' : 'bg-white'}`}>
              <div 
                onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                className="p-8 cursor-pointer hover:bg-gray-50/50 flex justify-between items-center"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`${n.isHidden ? 'bg-gray-400' : 'bg-orange-500'} text-white text-[10px] font-black px-2 py-0.5 rounded italic shadow-sm`}>
                      {n.isHidden ? '숨김' : '공지'}
                    </span>
                    <span className="text-[11px] font-bold text-gray-300 italic">{n.date}</span>
                  </div>
                  <h3 className={`text-lg font-black truncate pr-4 ${expandedId === n.id ? 'text-blue-600' : 'text-gray-900'} ${n.isHidden ? 'text-gray-400' : ''}`}>
                    {n.title}
                  </h3>
                </div>
                
                <div className="flex items-center gap-6">
                  {isAdmin && (
                    <div className="flex items-center gap-3 mr-4 border-r border-gray-100 pr-6">
                       <span className={`text-[10px] font-black uppercase italic ${n.isHidden ? 'text-gray-400' : 'text-green-500'}`}>
                         {n.isHidden ? 'Hidden' : 'Visible'}
                       </span>
                       <div 
                         onClick={(e) => toggleVisibility(n.id, e)}
                         className={`w-10 h-5 rounded-full relative cursor-pointer transition-all ${n.isHidden ? 'bg-gray-200' : 'bg-green-500'}`}
                       >
                         <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${n.isHidden ? 'left-0.5' : 'left-5.5'}`} style={{ left: n.isHidden ? '2px' : '22px' }}></div>
                       </div>
                    </div>
                  )}
                  <svg className={`w-6 h-6 text-gray-300 transition-transform ${expandedId === n.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              {expandedId === n.id && (
                <div className="px-8 pb-10 border-t border-gray-50 pt-8 animate-in slide-in-from-top-2">
                  <div className="text-[15px] text-gray-600 font-bold leading-relaxed whitespace-pre-wrap mb-10 min-h-[100px]">
                    {n.content}
                  </div>

                  {/* 이미지 갤러리 - 한 줄에 1장 노출 처리 */}
                  {n.images && n.images.length > 0 && (
                    <div className="space-y-8 pt-10 border-t border-gray-50">
                       <h4 className="text-[11px] font-black text-gray-300 uppercase tracking-widest italic">Attachments ({n.images.length})</h4>
                       <div className="flex flex-col gap-8">
                          {n.images.map((img, i) => (
                            <div key={i} className="space-y-2">
                              <img 
                                src={img} 
                                className="w-full rounded-[32px] border border-gray-100 shadow-md hover:shadow-2xl transition-all cursor-zoom-in" 
                                alt={`Notice detail ${i + 1}`} 
                                onClick={(e) => { e.stopPropagation(); window.open(img, '_blank'); }}
                              />
                              <p className="text-center text-[10px] font-black text-gray-300 italic uppercase">Image #{i + 1}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                  )}
                  
                  {isAdmin && (
                    <div className="mt-12 pt-8 border-t border-gray-50 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-black text-gray-400 italic">ADMIN PRIVILEGE:</span>
                        <button onClick={(e) => { e.stopPropagation(); showAlert({ description: '수정 기능 준비중' }); }} className="bg-gray-100 px-6 py-2 rounded-xl text-[11px] font-black text-gray-500 hover:bg-gray-900 hover:text-white transition-all">EDIT</button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm({
                              title: '공지 삭제',
                              description: '정말로 이 공지사항을 영구 삭제하시겠습니까?',
                              dangerLine: '삭제 후에는 복구할 수 없습니다.',
                              confirmLabel: '삭제하기',
                              cancelLabel: '취소',
                              danger: true,
                              onConfirm: async () => {
                                try {
                                  await deleteNotice(n.id);
                                  setNotices(prev => prev.filter(notice => notice.id !== n.id));
                                } catch (err) {
                                  console.error(err);
                                  showAlert({ description: '삭제에 실패했습니다.' });
                                }
                              },
                            });
                          }}
                          className="bg-red-50 px-6 py-2 rounded-xl text-[11px] font-black text-red-400 hover:bg-red-500 hover:text-white transition-all"
                        >
                          DELETE
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black text-gray-400 uppercase italic">Visibility Status</span>
                        <div 
                          onClick={(e) => toggleVisibility(n.id, e)}
                          className={`w-12 h-6 rounded-full relative cursor-pointer transition-all ${n.isHidden ? 'bg-gray-200' : 'bg-green-500'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${n.isHidden ? 'left-1' : 'left-7'}`}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NoticePage;
