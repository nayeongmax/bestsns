import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Post, UserProfile } from '@/types';

/** 데스크톱 레이아웃 고정. 폰/태블릿 대응 시 데스크톱용 스타일은 수정하지 말 것. */
interface Props {
  user: UserProfile;
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
}

const CATEGORIES = ['유튜브', '수익화', '마케팅', '자유'];
// 로컬 스토리지 용량 한계를 고려하여 파일당 최대 용량을 1MB로 하향 조정 (GIF 먹통 방지 핵심)
const MAX_FILE_SIZE = 1 * 1024 * 1024;

const FreeBoardWrite: React.FC<Props> = ({ user, posts, setPosts }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const editPost = location.state?.post as Post | undefined;

  const [title, setTitle] = useState(editPost?.title || '');
  const [content, setContent] = useState(editPost?.content || '');
  const [category, setCategory] = useState(editPost?.category || '자유');
  const [images, setImages] = useState<string[]>(editPost?.images || []);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editPost && String(editPost.authorId) !== String(user.id) && user.role !== 'admin') {
      alert('권한이 없습니다.');
      navigate('/board');
    }
  }, [editPost, user, navigate]);

  const boardImageCompressor = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
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
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.onerror = () => reject('이미지 로드 실패');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject('파일 읽기 실패');
      reader.readAsDataURL(file);
    });
  };

  const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || isUploading) return;

    const selectedFiles = Array.from(files);

    if (images.length + selectedFiles.length > 5) {
      alert('이미지 및 GIF는 최대 5장까지만 등록 가능합니다.');
      return;
    }

    setIsUploading(true);
    const processed: string[] = [];

    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`파일 [${file.name}]의 용량이 너무 큽니다. 1MB 이하의 파일만 업로드 가능합니다.`);
        continue;
      }

      try {
        if (file.type === 'image/gif') {
          const base64 = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = rej;
            r.readAsDataURL(file);
          });
          processed.push(base64);
        } else if (file.type.startsWith('image/')) {
          const compressed = await boardImageCompressor(file);
          processed.push(compressed);
        } else {
          alert('이미지 또는 GIF 파일만 업로드 가능합니다.');
        }
      } catch (err) {
        console.error("파일 처리 중 오류:", err);
      }
    }

    setImages(prev => [...prev, ...processed]);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const moveImage = (idx: number, direction: 'left' | 'right') => {
    const newImages = [...images];
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newImages.length) return;
    [newImages[idx], newImages[targetIdx]] = [newImages[targetIdx], newImages[idx]];
    setImages(newImages);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return alert('제목과 내용을 입력해 주세요.');
    if (isUploading) return alert('파일 처리가 완료될 때까지 기다려 주세요.');

    const totalDataSize = JSON.stringify(images).length;
    if (totalDataSize > 4 * 1024 * 1024) {
      return alert('첨부된 미디어 전체 용량이 너무 큽니다. GIF 개수를 줄이거나 이미지를 교체해 주세요.');
    }

    try {
      if (editPost) {
        setPosts(prev => prev.map(p => String(p.id) === String(editPost.id) ? {
          ...p, title, content, category, images
        } : p));
        alert('수정되었습니다.');
        navigate(`/board/${editPost.id}`);
      } else {
        const newPost: Post = {
          id: (posts.length > 0 ? Math.max(...posts.map(p => Number(p.id))) + 1 : 1).toString(),
          category,
          title,
          content,
          author: user.nickname,
          authorId: user.id,
          authorImage: user.profileImage,
          date: new Date().toISOString().split('T')[0],
          views: 0,
          likes: 0,
          comments: [],
          images
        };
        setPosts(prev => [newPost, ...prev]);
        alert('등록되었습니다.');
        navigate('/board');
      }
    } catch (err) {
      console.error(err);
      alert('저장 공간이 부족하여 게시글을 등록할 수 없습니다. 첨부파일 개수를 줄여주세요.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32 animate-in slide-in-from-bottom-4 duration-700 px-4">
      <div className="mb-10 flex items-center justify-between">
        <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">
          {editPost ? '게시글 수정' : '새로운 글 작성'}
        </h2>
        <button onClick={() => navigate(-1)} className="text-sm font-black text-gray-400 hover:text-gray-900 uppercase italic">취소하기</button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 md:p-12 rounded-[56px] shadow-2xl border border-gray-100 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
             <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-4">카테고리 선택</label>
             <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-black text-gray-700 outline-none shadow-inner cursor-pointer"
             >
               {user.role === 'admin' && <option value="공지">공지사항 (운영자 전용)</option>}
               {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
        </div>

        <div className="space-y-4">
           <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-4">글 제목</label>
           <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-gray-900 text-xl outline-none shadow-inner focus:ring-4 focus:ring-blue-50 transition-all"
           />
        </div>

        <div className="space-y-4">
           <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-4">본문 내용</label>
           <textarea
            rows={12}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="당신의 지식과 질문을 자유롭게 공유해 주세요."
            className="w-full p-8 bg-gray-50 border-none rounded-[40px] font-bold text-gray-700 text-lg outline-none shadow-inner focus:bg-white transition-all leading-relaxed no-scrollbar"
           />
        </div>

        <div className="space-y-6">
           <div className="flex justify-between items-center px-4">
              <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest italic text-sm">
                미디어 첨부 <span className="text-blue-500 font-black ml-1">(이미지, gif 가능)</span>
                {isUploading && <span className="text-blue-500 animate-pulse ml-2">처리 중...</span>}
              </label>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className={`bg-white border border-gray-200 text-gray-400 px-6 py-2 rounded-xl text-[11px] font-black transition-all shadow-sm ${isUploading ? 'opacity-50' : 'hover:bg-blue-50 hover:text-blue-500'}`}
              >
                + 미디어 추가
              </button>
           </div>
           <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/gif" multiple onChange={handleMediaChange} />

           <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
             {images.map((img, i) => (
               <div key={i} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm group border border-gray-100 bg-black/5 flex items-center justify-center">
                  <img src={img} className="w-full h-full object-cover" alt="upload preview" />

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                     <div className="flex gap-1">
                        <button type="button" onClick={() => moveImage(i, 'left')} className="p-1.5 bg-white rounded-lg text-gray-900 hover:bg-blue-50 disabled:opacity-30" disabled={i === 0}>◀</button>
                        <button type="button" onClick={() => moveImage(i, 'right')} className="p-1.5 bg-white rounded-lg text-gray-900 hover:bg-blue-50 disabled:opacity-30" disabled={i === images.length - 1}>▶</button>
                     </div>
                     <button
                        type="button"
                        onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                        className="bg-white text-red-500 font-black text-[10px] px-3 py-1 rounded-full"
                      >
                        삭제
                      </button>
                  </div>
                  {img.startsWith('data:image/gif') && <div className="absolute top-2 left-2 bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded italic shadow-md">GIF</div>}
               </div>
             ))}
           </div>
           <p className="text-[10px] text-gray-400 px-4 leading-relaxed">
             * 로컬 스토리지 안정성을 위해 파일당 최대 1MB, 총 5장까지만 업로드 가능합니다.<br/>
             * 고용량 GIF 파일은 시스템 먹통의 원인이 될 수 있으니 주의해 주세요.
           </p>
        </div>

        <button
          type="submit"
          disabled={isUploading}
          className={`w-full py-8 text-white rounded-[40px] font-black text-2xl italic uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${isUploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-black shadow-blue-200'}`}
        >
          {isUploading ? '파일 처리 중...' : editPost ? '게시글 수정 완료' : '게시글 등록하기'}
        </button>
      </form>
    </div>
  );
};

export default FreeBoardWrite;
