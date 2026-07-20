"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, increment } from "firebase/firestore";
import { Image as ImageIcon, Plus, Send, Trash2, X, Eye, Megaphone } from "lucide-react";
import Reveal from "@/components/Reveal";

interface PromoPost {
  id: string;
  academyId: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  coverImage?: string;
  views?: number;
  createdAt: string;
}

interface Props {
  academyId: string;
  isOwner: boolean;
  uid?: string;
  authorName?: string;
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function AcademyPromoBoard({ academyId, isOwner, uid, authorName }: Props) {
  const [posts, setPosts] = useState<PromoPost[]>([]);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!academyId) { setPosts([]); return; }
    const q = query(collection(db, "academyPosts"), where("academyId", "==", academyId));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as PromoPost));
      setPosts(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return () => unsub();
  }, [academyId]);

  const openCompose = () => {
    setTitle(""); setContent(""); setCoverImage("");
    setIsComposeOpen(true);
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !title.trim() || !uid || !academyId) return;
    try {
      await addDoc(collection(db, "academyPosts"), {
        academyId, authorId: uid, authorName: authorName || "학원",
        title: title.trim(), content: content.trim(),
        coverImage: coverImage.trim() || null,
        views: 0, createdAt: new Date().toISOString(),
      });
      setIsComposeOpen(false);
      setTitle(""); setContent(""); setCoverImage("");
    } catch (e) { console.error(e); }
  };

  const deletePost = async (postId: string) => {
    if (!confirm("이 소개글을 삭제할까요?")) return;
    try {
      await deleteDoc(doc(db, "academyPosts", postId));
      if (expandedPostId === postId) setExpandedPostId(null);
    } catch (e) { console.error(e); }
  };

  const toggleExpand = (postId: string) => {
    const next = expandedPostId === postId ? null : postId;
    setExpandedPostId(next);
    if (next && !viewedPostIds.has(next)) {
      setViewedPostIds(prev => new Set(prev).add(next));
      updateDoc(doc(db, "academyPosts", next), { views: increment(1) }).catch(() => {});
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {posts.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">📝</div>
          {isOwner ? "아직 작성한 소개글이 없습니다. 학원을 홍보하는 첫 글을 남겨보세요!" : "아직 등록된 학원 소개글이 없습니다."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {posts.map(post => {
            const isExpanded = expandedPostId === post.id;
            return (
              <Reveal key={post.id} className="card promo-post-card" style={{ padding: 0, overflow: "hidden" }} onClick={() => toggleExpand(post.id)}>
                {post.coverImage && (
                  <div className="promo-post-cover" style={{ backgroundImage: `url(${post.coverImage})` }} />
                )}
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div className="promo-post-title">{post.title}</div>
                    {isOwner && post.authorId === uid && (
                      <button
                        className="btn btn-ghost btn-xs btn-icon"
                        onClick={e => { e.stopPropagation(); deletePost(post.id); }}
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="promo-post-meta">
                    <span>{timeAgo(post.createdAt)}</span>
                    <span className="promo-post-views"><Eye size={12} /> {post.views ?? 0}</span>
                  </div>
                  <div className={`promo-post-content ${isExpanded ? "expanded" : ""}`}>{post.content}</div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}

      {isOwner && (
        <button className="community-fab" onClick={openCompose} title="소개글 쓰기">
          <Plus size={24} />
        </button>
      )}

      {isComposeOpen && (
        <div className="modal-backdrop" onClick={() => setIsComposeOpen(false)}>
          <div className="modal-box modal-box-md" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}><Megaphone size={16} style={{ verticalAlign: -2, marginRight: 4 }} />학원 소개글 쓰기</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setIsComposeOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={submitPost} style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="input-group">
                <label className="input-label">제목</label>
                <input className="input" placeholder="예) 겨울방학 특강 안내" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
              </div>
              <div className="input-group">
                <label className="input-label"><ImageIcon size={13} style={{ verticalAlign: -2, marginRight: 3 }} />대표 이미지 URL (선택)</label>
                <input className="input" placeholder="https://..." value={coverImage} onChange={e => setCoverImage(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">내용</label>
                <textarea className="input" placeholder="우리 학원만의 특징, 커리큘럼, 강사진 등을 자유롭게 소개해보세요" value={content} onChange={e => setContent(e.target.value)} required rows={6} style={{ resize: "none" }} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ justifyContent: "center" }} disabled={!content.trim() || !title.trim()}>
                <Send size={15} /> 게시하기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
