"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, addDoc, orderBy,
  doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment
} from "firebase/firestore";
import { Heart, MessageCircle, Send, Trash2, Users2 } from "lucide-react";

interface CommunityPost {
  id: string;
  academyId: string;
  authorId: string;
  authorName: string;
  authorRole: "parent" | "academy";
  title: string;
  content: string;
  likes: string[];
  commentCount: number;
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

const roleLabel = (r: "parent" | "academy") => (r === "academy" ? "원장" : "학부모");

export default function CommunityBoard({ academyIds, uid, displayName, role, getAcademyLabel }: Props) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postAcademyId, setPostAcademyId] = useState(academyIds[0] ?? "");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
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
    const q = query(
      collection(db, `communityPosts/${expandedPostId}/comments`),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityComment)));
    });
    return () => unsub();
  }, [expandedPostId]);

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !postAcademyId) return;
    try {
      await addDoc(collection(db, "communityPosts"), {
        academyId: postAcademyId, authorId: uid, authorName: displayName, authorRole: role,
        title: title.trim(), content: content.trim(),
        likes: [], commentCount: 0, createdAt: new Date().toISOString(),
      });
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

  return (
    <div>
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
        <div className="card-header">
          <div>
            <div className="card-title"><Users2 size={15} /> 커뮤니티에 글쓰기</div>
            <div className="card-subtitle">같은 학원 학부모·원장님과 자유롭게 소통해보세요</div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={submitPost} className="community-composer">
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
              <label className="input-label">제목</label>
              <input className="input" placeholder="제목을 입력하세요" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">내용</label>
              <textarea className="input" placeholder="자유롭게 이야기를 나눠보세요" value={content} onChange={e => setContent(e.target.value)} required rows={3} style={{ resize: "none" }} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ justifyContent: "center" }}>
              <Send size={15} /> 게시하기
            </button>
          </form>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">💬</div>
          아직 등록된 글이 없습니다. 첫 글을 남겨보세요!
        </div>
      ) : (
        posts.map(post => {
          const liked = post.likes.includes(uid);
          const isExpanded = expandedPostId === post.id;
          return (
            <div key={post.id} className="community-post">
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
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(post.createdAt)}</div>
                </div>
                {post.authorId === uid && (
                  <button className="btn btn-ghost btn-xs" onClick={() => deletePost(post.id)} title="삭제">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="community-post-title">{post.title}</div>
              <div className="community-post-content">{post.content}</div>
              <div className="community-post-actions">
                <button className={`community-action-btn ${liked ? "liked" : ""}`} onClick={() => toggleLike(post)}>
                  <Heart size={14} fill={liked ? "currentColor" : "none"} /> 좋아요 {post.likes.length > 0 ? post.likes.length : ""}
                </button>
                <button className="community-action-btn" onClick={() => setExpandedPostId(isExpanded ? null : post.id)}>
                  <MessageCircle size={14} /> 댓글 {post.commentCount > 0 ? post.commentCount : ""}
                </button>
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
                        <button className="btn btn-ghost btn-xs" onClick={() => deleteComment(post.id, c.id)} title="삭제">
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
            </div>
          );
        })
      )}
    </div>
  );
}
