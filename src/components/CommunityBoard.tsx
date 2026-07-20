"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, addDoc, orderBy,
  doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment
} from "firebase/firestore";
import { Heart, MessageCircle, Send, Trash2, Plus, Eye, X } from "lucide-react";
import Reveal from "@/components/Reveal";

type CategoryId = "free" | "question" | "info" | "praise" | "suggest";

const CATEGORIES: { id: CategoryId; label: string; badgeClass: string; chipClass: string }[] = [
  { id: "free", label: "자유", badgeClass: "badge-brand", chipClass: "brand" },
  { id: "question", label: "질문", badgeClass: "badge-charcoal", chipClass: "charcoal" },
  { id: "info", label: "정보공유", badgeClass: "badge-rust-deep", chipClass: "rust-deep" },
  { id: "praise", label: "칭찬해요", badgeClass: "badge-charcoal-deep", chipClass: "charcoal-deep" },
  { id: "suggest", label: "건의사항", badgeClass: "badge-rust", chipClass: "rust" },
];

const categoryMeta = (id?: string) => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0];

interface CommunityPost {
  id: string;
  academyId: string;
  authorId: string;
  authorName: string;
  authorRole: "parent" | "academy";
  category?: CategoryId;
  title: string;
  content: string;
  likes: string[];
  commentCount: number;
  views?: number;
  createdAt: string;
}

interface CommunityComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: "parent" | "academy";
  content: string;
  createdAt: string;
}

interface Props {
  academyIds: string[];
  uid: string;
  displayName: string;
  role: "parent" | "academy";
  getAcademyLabel?: (academyId: string) => string;
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

const roleLabel = (r: "parent" | "academy") => (r === "academy" ? "원장" : "학부모");

export default function CommunityBoard({ academyIds, uid, displayName, role, getAcademyLabel }: Props) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryId | "all">("all");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeCategory, setComposeCategory] = useState<CategoryId>("free");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postAcademyId, setPostAcademyId] = useState(academyIds[0] ?? "");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");

  // Firestore's `in` operator caps at 30 values, well above any realistic
  // number of academies a single parent connects to.
  const idsKey = academyIds.join(",");

  useEffect(() => {
    if (academyIds.length === 0) { setPosts([]); return; }
    if (!academyIds.includes(postAcademyId)) setPostAcademyId(academyIds[0]);
    const q = query(collection(db, "communityPosts"), where("academyId", "in", academyIds));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityPost));
      setPosts(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    if (!expandedPostId) {
      setComments([]);
      return;
    }
    if (!viewedPostIds.has(expandedPostId)) {
      setViewedPostIds(prev => new Set(prev).add(expandedPostId));
      updateDoc(doc(db, "communityPosts", expandedPostId), { views: increment(1) }).catch(() => {});
    }
    const q = query(
      collection(db, `communityPosts/${expandedPostId}/comments`),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityComment)));
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedPostId]);

  const openCompose = () => {
    setComposeCategory("free");
    setTitle(""); setContent("");
    setIsComposeOpen(true);
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !postAcademyId) return;
    try {
      await addDoc(collection(db, "communityPosts"), {
        academyId: postAcademyId, authorId: uid, authorName: displayName, authorRole: role,
        category: composeCategory, title: title.trim(), content: content.trim(),
        likes: [], commentCount: 0, views: 0, createdAt: new Date().toISOString(),
      });
      setIsComposeOpen(false);
      setTitle(""); setContent("");
    } catch (e) { console.error(e); }
  };

  const toggleLike = async (post: CommunityPost) => {
    try {
      await updateDoc(doc(db, "communityPosts", post.id), {
        likes: post.likes.includes(uid) ? arrayRemove(uid) : arrayUnion(uid),
      });
    } catch (e) { console.error(e); }
  };

  const deletePost = async (postId: string) => {
    if (!confirm("이 글을 삭제할까요?")) return;
    try {
      await deleteDoc(doc(db, "communityPosts", postId));
      if (expandedPostId === postId) setExpandedPostId(null);
    } catch (e) { console.error(e); }
  };

  const submitComment = async (postId: string) => {
    if (!commentDraft.trim()) return;
    try {
      await addDoc(collection(db, `communityPosts/${postId}/comments`), {
        authorId: uid, authorName: displayName, authorRole: role,
        content: commentDraft.trim(), createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "communityPosts", postId), { commentCount: increment(1) });
      setCommentDraft("");
    } catch (e) { console.error(e); }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    try {
      await deleteDoc(doc(db, `communityPosts/${postId}/comments`, commentId));
      await updateDoc(doc(db, "communityPosts", postId), { commentCount: increment(-1) });
    } catch (e) { console.error(e); }
  };

  if (academyIds.length === 0) {
    return <div className="card empty-state">학원과 연결한 후 커뮤니티를 이용할 수 있습니다.</div>;
  }

  const filteredPosts = activeCategory === "all" ? posts : posts.filter(p => (p.category ?? "free") === activeCategory);

  return (
    <div style={{ position: "relative" }}>
      <div className="category-filter-row">
        <button
          className={`category-chip ${activeCategory === "all" ? "active" : ""}`}
          onClick={() => setActiveCategory("all")}
        >
          전체
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            className={`category-chip ${activeCategory === c.id ? "active" : ""}`}
            onClick={() => setActiveCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filteredPosts.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">💬</div>
          {activeCategory === "all" ? "아직 등록된 글이 없습니다. 첫 글을 남겨보세요!" : "이 카테고리에 등록된 글이 없습니다."}
        </div>
      ) : (
        filteredPosts.map(post => {
          const liked = post.likes.includes(uid);
          const isExpanded = expandedPostId === post.id;
          const cat = categoryMeta(post.category);
          return (
            <Reveal key={post.id} className="community-post">
              <div className="community-post-head">
                <div className="community-avatar">{post.authorName?.[0]?.toUpperCase() ?? "?"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{post.authorName}</span>
                    <span className="badge badge-neutral">{roleLabel(post.authorRole)}</span>
                    {academyIds.length > 1 && getAcademyLabel && (
                      <span className="badge badge-brand">{getAcademyLabel(post.academyId)}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <span className={`badge ${cat.badgeClass}`}>{cat.label}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{timeAgo(post.createdAt)}</span>
                  </div>
                </div>
                {post.authorId === uid && (
                  <button className="btn btn-ghost btn-xs btn-icon" onClick={() => deletePost(post.id)} title="삭제">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {post.title && <div className="community-post-title">{post.title}</div>}
              <div className="community-post-content">{post.content}</div>
              <div className="community-post-actions">
                <button className={`community-action-btn ${liked ? "liked" : ""}`} onClick={() => toggleLike(post)}>
                  <Heart size={14} fill={liked ? "currentColor" : "none"} /> 좋아요 {post.likes.length > 0 ? post.likes.length : ""}
                </button>
                <button className="community-action-btn" onClick={() => setExpandedPostId(isExpanded ? null : post.id)}>
                  <MessageCircle size={14} /> 댓글 {post.commentCount > 0 ? post.commentCount : ""}
                </button>
                <span className="community-view-count">
                  <Eye size={13} /> {post.views ?? 0}
                </span>
              </div>

              {isExpanded && (
                <div className="community-comments">
                  {comments.map(c => (
                    <div key={c.id} className="community-comment">
                      <div className="community-avatar" style={{ width: 26, height: 26, fontSize: 11 }}>{c.authorName?.[0]?.toUpperCase() ?? "?"}</div>
                      <div className="community-comment-bubble">
                        <span className="community-comment-name">{c.authorName}</span>
                        <span className="community-comment-text">{c.content}</span>
                      </div>
                      {c.authorId === uid && (
                        <button className="btn btn-ghost btn-xs btn-icon" onClick={() => deleteComment(post.id, c.id)} title="삭제">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <form
                    onSubmit={e => { e.preventDefault(); submitComment(post.id); }}
                    style={{ display: "flex", gap: 8 }}
                  >
                    <input
                      className="input"
                      placeholder="댓글을 입력하세요"
                      value={commentDraft}
                      onChange={e => setCommentDraft(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={!commentDraft.trim()}>
                      <Send size={13} />
                    </button>
                  </form>
                </div>
              )}
            </Reveal>
          );
        })
      )}

      <button className="community-fab" onClick={openCompose} title="글쓰기">
        <Plus size={24} />
      </button>

      {isComposeOpen && (
        <div className="modal-backdrop" onClick={() => setIsComposeOpen(false)}>
          <div className="modal-box modal-box-md" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>글쓰기</div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setIsComposeOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={submitPost} style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="input-group">
                <label className="input-label">카테고리</label>
                <div className="category-filter-row" style={{ marginBottom: 0 }}>
                  {CATEGORIES.map(c => (
                    <button
                      type="button"
                      key={c.id}
                      className={`category-chip ${composeCategory === c.id ? "active" : ""}`}
                      onClick={() => setComposeCategory(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              {academyIds.length > 1 && (
                <div className="input-group">
                  <label className="input-label">게시할 학원</label>
                  <select className="input" value={postAcademyId} onChange={e => setPostAcademyId(e.target.value)} required>
                    {academyIds.map(id => (
                      <option key={id} value={id}>{getAcademyLabel ? getAcademyLabel(id) : id}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="input-group">
                <label className="input-label">제목 (선택)</label>
                <input className="input" placeholder="제목을 입력하세요" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">내용</label>
                <textarea className="input" placeholder="자유롭게 이야기를 나눠보세요" value={content} onChange={e => setContent(e.target.value)} required rows={4} style={{ resize: "none" }} autoFocus />
              </div>
              <button type="submit" className="btn btn-primary" style={{ justifyContent: "center" }} disabled={!content.trim()}>
                <Send size={15} /> 게시하기
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
