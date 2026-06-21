"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  addDoc, orderBy, getDocs
} from "firebase/firestore";
import {
  ArrowLeft, Send, GraduationCap, Users, MessageSquare,
  CheckCheck, Smile, Paperclip, Search, MoreVertical
} from "lucide-react";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

interface ChatRoom {
  id: string;
  academyId: string;
  parentId: string;
  parentEmail: string;
  parentName: string;
  lastMessage?: string;
  lastTime?: string;
}

// Quick reply templates
const QUICK_REPLIES_ACADEMY = [
  "안녕하세요! 무엇을 도와드릴까요?",
  "확인 후 연락드리겠습니다.",
  "출결 관련 문의는 대시보드에서 확인 가능합니다.",
  "다음 수업은 정상 진행됩니다.",
  "원비 납부 감사합니다!",
];

const QUICK_REPLIES_PARENT = [
  "안녕하세요, 학부모입니다.",
  "자녀 출결 관련 문의드립니다.",
  "상담 신청하고 싶습니다.",
  "원비 관련 문의드립니다.",
  "감사합니다!",
];

function formatTime(ts: string) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h >= 12 ? "오후" : "오전"} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m}`;
}

function formatDate(ts: string) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function ChatPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showRoomList, setShowRoomList] = useState(true);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !role) return;
    const setup = async () => {
      if (role === "academy") {
        const q = query(collection(db, "students"), where("academyId", "==", user.uid));
        const snap = await getDocs(q);
        const parentEmails = new Set<string>();
        snap.forEach(d => parentEmails.add(d.data().parentEmail));
        if (parentEmails.size > 0) {
          const uq = query(collection(db, "users"), where("role", "==", "parent"));
          const unsub = onSnapshot(uq, uSnap => {
            const data: ChatRoom[] = [];
            uSnap.forEach(d => {
              const u = d.data();
              if (parentEmails.has(u.email)) {
                data.push({
                  id: `${user.uid}_${d.id}`,
                  academyId: user.uid,
                  parentId: d.id,
                  parentEmail: u.email,
                  parentName: u.name || u.email,
                });
              }
            });
            setRooms(data);
          });
          return () => unsub();
        }
      } else if (role === "parent" && user.email) {
        const q = query(collection(db, "students"), where("parentEmail", "==", user.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const academyId = snap.docs[0].data().academyId;
          const room: ChatRoom = {
            id: `${academyId}_${user.uid}`,
            academyId,
            parentId: user.uid,
            parentEmail: user.email,
            parentName: "나",
          };
          setRooms([room]);
          setSelectedRoom(room);
          if (isMobileView) setShowRoomList(false);
        }
      }
    };
    setup();
  }, [user, role]);

  useEffect(() => {
    if (!selectedRoom) return;
    const q = query(
      collection(db, `chats/${selectedRoom.id}/messages`),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      const data: ChatMessage[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      setMessages(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    });
    return () => unsub();
  }, [selectedRoom]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !selectedRoom || !user) return;
    setNewMessage("");
    setShowQuickReplies(false);
    try {
      await addDoc(collection(db, `chats/${selectedRoom.id}/messages`), {
        senderId: user.uid,
        senderName: role === "academy" ? "학원" : "학부모",
        text: text.trim(),
        timestamp: new Date().toISOString(),
      });
    } catch (e) { console.error(e); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage);
  };

  const selectRoom = (room: ChatRoom) => {
    setSelectedRoom(room);
    if (isMobileView) setShowRoomList(false);
    inputRef.current?.focus();
  };

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #800020, #5A0016)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <MessageSquare size={28} color="white" />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  const quickReplies = role === "academy" ? QUICK_REPLIES_ACADEMY : QUICK_REPLIES_PARENT;
  const filteredRooms = rooms.filter(r =>
    r.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.parentEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  messages.forEach(msg => {
    const date = formatDate(msg.timestamp);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else groupedMessages.push({ date, msgs: [msg] });
  });

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      overflow: 'hidden'
    }}>
      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', maxWidth: 1100, width: '100%', margin: '0 auto', boxShadow: '0 0 40px rgba(0,0,0,0.08)', background: 'var(--surface)' }}>

        {/* ── Room List Panel ── */}
        {(!isMobileView || showRoomList) && (
          <div style={{
            width: isMobileView ? '100%' : 300,
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface)',
          }}>
            {/* Panel Header */}
            <div style={{
              padding: '20px 20px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => router.push(role === "academy" ? "/academy" : "/parent")}
                  style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>메시지</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rooms.length}개 대화방</div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 14, outline: 'none', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                  placeholder="대화 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Room List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredRooms.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  {searchQuery ? "검색 결과가 없습니다." : "대화 가능한 상대가 없습니다."}
                </div>
              ) : (
                filteredRooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: selectedRoom?.id === room.id ? 'var(--brand-light)' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { if (selectedRoom?.id !== room.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
                    onMouseLeave={e => { if (selectedRoom?.id !== room.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: selectedRoom?.id === room.id ? 'var(--brand)' : 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 16, fontWeight: 700, flexShrink: 0,
                    }}>
                      {room.parentName[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: selectedRoom?.id === room.id ? 'var(--brand)' : 'var(--text-primary)' }}>
                          {room.parentName} 학부모님
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {room.parentEmail}
                      </div>
                    </div>
                    {selectedRoom?.id === room.id && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Chat Panel ── */}
        {(!isMobileView || !showRoomList) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F7F8FC' }}>
            {selectedRoom ? (
              <>
                {/* Chat Header */}
                <div style={{
                  padding: '14px 20px',
                  background: 'var(--surface)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexShrink: 0,
                  boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
                }}>
                  {isMobileView && (
                    <button
                      onClick={() => setShowRoomList(true)}
                      style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}
                    >
                      <ArrowLeft size={17} />
                    </button>
                  )}
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, flexShrink: 0 }}>
                    {role === "academy" ? selectedRoom.parentName[0]?.toUpperCase() : <GraduationCap size={18} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {role === "academy" ? `${selectedRoom.parentName} 학부모님` : "학원 선생님"}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>● 활성</div>
                  </div>
                  <button style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <MoreVertical size={16} />
                  </button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {groupedMessages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12 }}>
                      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageSquare size={26} style={{ opacity: 0.3 }} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>아직 메시지가 없습니다.</div>
                      <div style={{ fontSize: 13 }}>먼저 인사를 건네보세요! 👋</div>
                    </div>
                  ) : (
                    groupedMessages.map(group => (
                      <div key={group.date}>
                        {/* Date separator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
                          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '3px 12px', background: 'var(--surface)', borderRadius: 999, border: '1px solid var(--border)' }}>{group.date}</span>
                          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        </div>
                        {/* Messages in group */}
                        {group.msgs.map((msg, idx) => {
                          const isMe = msg.senderId === user.uid;
                          const prevMsg = group.msgs[idx - 1];
                          const nextMsg = group.msgs[idx + 1];
                          const showSender = !prevMsg || prevMsg.senderId !== msg.senderId;
                          const isLast = !nextMsg || nextMsg.senderId !== msg.senderId;

                          return (
                            <div key={msg.id} style={{
                              display: 'flex',
                              flexDirection: isMe ? 'row-reverse' : 'row',
                              alignItems: 'flex-end',
                              gap: 8,
                              marginBottom: isLast ? 12 : 2,
                              marginTop: showSender && !isMe ? 4 : 0,
                            }}>
                              {/* Avatar (other side) */}
                              {!isMe && (
                                <div style={{
                                  width: 32, height: 32, borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #800020, #5A0016)',
                                  display: isLast ? 'flex' : 'none',
                                  alignItems: 'center', justifyContent: 'center',
                                  color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0,
                                }}>
                                  {msg.senderName[0]}
                                </div>
                              )}
                              {!isMe && !isLast && <div style={{ width: 32, flexShrink: 0 }} />}

                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
                                {showSender && !isMe && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{msg.senderName}</span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                  <div style={{
                                    padding: '10px 14px',
                                    borderRadius: isMe
                                      ? `18px 18px ${isLast ? '4px' : '18px'} 18px`
                                      : `18px 18px 18px ${isLast ? '4px' : '18px'}`,
                                    background: isMe ? 'linear-gradient(135deg, #800020, #5A0016)' : 'var(--surface)',
                                    color: isMe ? 'white' : 'var(--text-primary)',
                                    fontSize: 14,
                                    lineHeight: 1.5,
                                    boxShadow: isMe ? '0 2px 8px rgba(128,0,32,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
                                    border: isMe ? 'none' : '1px solid var(--border)',
                                    wordBreak: 'break-word',
                                  }}>
                                    {msg.text}
                                  </div>
                                  {isLast && (
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginBottom: 2, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 1 }}>
                                      {isMe && <CheckCheck size={12} style={{ color: 'var(--success)' }} />}
                                      <span>{formatTime(msg.timestamp)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Replies */}
                {showQuickReplies && (
                  <div style={{ padding: '8px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
                    {quickReplies.map((qr, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(qr)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 999,
                          background: 'var(--brand-light)',
                          border: '1px solid rgba(128,0,32,0.15)',
                          color: 'var(--brand)',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          fontFamily: 'inherit',
                          flexShrink: 0,
                        }}
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Bar */}
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--surface)',
                  borderTop: '1px solid var(--border)',
                  flexShrink: 0,
                  paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
                }}>
                  <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Quick reply toggle */}
                    <button
                      type="button"
                      onClick={() => setShowQuickReplies(!showQuickReplies)}
                      style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: showQuickReplies ? 'var(--brand-light)' : 'var(--bg)',
                        border: `1px solid ${showQuickReplies ? 'rgba(128,0,32,0.2)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: showQuickReplies ? 'var(--brand)' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}
                      title="빠른 답장"
                    >
                      <Smile size={18} />
                    </button>

                    {/* Input field */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        style={{
                          width: '100%',
                          padding: '11px 16px',
                          borderRadius: 24,
                          background: 'var(--bg)',
                          border: '1.5px solid var(--border)',
                          fontSize: 15,
                          outline: 'none',
                          color: 'var(--text-primary)',
                          fontFamily: 'inherit',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                        onFocus={e => {
                          e.target.style.borderColor = 'var(--brand)';
                          e.target.style.boxShadow = '0 0 0 3px rgba(128,0,32,0.08)';
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = 'var(--border)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </div>

                    {/* Send button */}
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: newMessage.trim() ? 'linear-gradient(135deg, #800020, #5A0016)' : 'var(--bg)',
                        border: newMessage.trim() ? 'none' : '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: newMessage.trim() ? 'pointer' : 'default',
                        color: newMessage.trim() ? 'white' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                        boxShadow: newMessage.trim() ? '0 4px 12px rgba(128,0,32,0.35)' : 'none',
                        transform: newMessage.trim() ? 'scale(1)' : 'scale(0.95)',
                      }}
                    >
                      <Send size={17} style={{ transform: 'translateX(1px)' }} />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              /* No room selected (desktop) */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 16 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={36} style={{ opacity: 0.25 }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 6 }}>대화방을 선택해주세요</div>
                  <div style={{ fontSize: 14, textAlign: 'center' }}>왼쪽 목록에서 대화할 상대를 선택하세요.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
