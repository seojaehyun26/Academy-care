"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import {
  MessageCircle, Megaphone, CalendarPlus, X, CheckCircle, CreditCard,
  PhoneCall, GraduationCap, CircleDashed, BookOpen, LogOut, Bell, ClipboardList, UserPlus,
  Clock, XCircle
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  academyId: string;
  status: "none" | "arrived" | "departed";
  feeStatus?: "paid" | "unpaid";
  lastUpdated: string;
}

interface Homework {
  id: string;
  studentId: string;
  textbook: string;
  description: string;
  date: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  academyId: string;
}

export default function ParentDashboard() {
  const { user, role, profile, loading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const prevStatuses = useRef<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"status" | "homework" | "announcements" | "calendar">("status");
  const [lastSeenAnnouncementsAt, setLastSeenAnnouncementsAt] = useState("");

  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [consultStudentId, setConsultStudentId] = useState("");
  const [consultDate, setConsultDate] = useState("");
  const [consultTime, setConsultTime] = useState("");

  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildAcademyId, setNewChildAcademyId] = useState("");

  useEffect(() => {
    if (!loading && (!user || role !== "parent")) router.push("/");
  }, [user, role, loading, router]);

  useEffect(() => {
    if (user) {
      setLastSeenAnnouncementsAt(localStorage.getItem(`announcementsLastSeen_${user.uid}`) || "");
    }
  }, [user]);

  const unreadAnnouncements = announcements.filter(
    a => !lastSeenAnnouncementsAt || new Date(a.date).getTime() > new Date(lastSeenAnnouncementsAt).getTime()
  ).length;

  const selectTab = (id: "status" | "homework" | "announcements" | "calendar") => {
    setActiveTab(id);
    if (id === "announcements" && user) {
      const now = new Date().toISOString();
      localStorage.setItem(`announcementsLastSeen_${user.uid}`, now);
      setLastSeenAnnouncementsAt(now);
    }
  };

  useEffect(() => {
    if (user && role === "parent" && user.email) {
      const q = query(collection(db, "students"), where("parentEmail", "==", user.email));
      const unsubStudents = onSnapshot(q, snap => {
        const studentData: Student[] = [];
        const studentIds: string[] = [];
        const academyIds = new Set<string>();

        snap.forEach(doc => {
          const data = doc.data() as Omit<Student, "id">;
          const sid = doc.id;
          const prev = prevStatuses.current[sid];
          if (prev && prev !== data.status) {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(data.status === "arrived" ? "등원 알림" : "하원 알림", {
                body: `${data.name} 학생이 ${data.status === "arrived" ? "등원" : "하원"}했습니다.`,
                icon: "/favicon.ico"
              });
            }
          }
          prevStatuses.current[sid] = data.status;
          studentData.push({ id: sid, ...data });
          studentIds.push(sid);
          academyIds.add(data.academyId);
        });

        setStudents(studentData);

        if (studentIds.length > 0) {
          const hwq = query(collection(db, "homework"), where("studentId", "in", studentIds));
          const unsubHw = onSnapshot(hwq, hwSnap => {
            const hw = hwSnap.docs.map(d => ({ id: d.id, ...d.data() } as Homework));
            setHomeworks(hw.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
          });

          const ids = Array.from(academyIds);
          if (ids.length > 0) {
            const annq = query(collection(db, "announcements"), where("academyId", "in", ids));
            const unsubAnn = onSnapshot(annq, annSnap => {
              const ann = annSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
              setAnnouncements(ann.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            });
            return () => { unsubHw(); unsubAnn(); };
          }
          return () => unsubHw();
        }
        setHomeworks([]); setAnnouncements([]);
      });
      return () => unsubStudents();
    }
  }, [user, role]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}월 ${d.getDate()}일 ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  const submitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultStudentId || !consultDate || !consultTime || !user?.email) return;
    const student = students.find(s => s.id === consultStudentId);
    if (!student) return;
    try {
      await addDoc(collection(db, "consultations"), {
        academyId: student.academyId, studentId: student.id,
        studentName: student.name, parentEmail: user.email,
        date: `${consultDate} ${consultTime}`, status: "pending",
        createdAt: new Date().toISOString()
      });
      setIsConsultModalOpen(false);
      setConsultStudentId(""); setConsultDate(""); setConsultTime("");
      alert("상담 신청이 완료되었습니다. 원장님 확인 후 연락드리겠습니다.");
    } catch (e) { console.error(e); }
  };

  // Academies a new child can be attached to: primarily the academy this
  // parent joined via code, plus any academy already seen on an existing
  // child (covers parents created before the join-code system existed).
  const childAcademyIds = Array.from(new Set(
    [profile?.academyId, ...students.map(s => s.academyId)].filter((id): id is string => !!id)
  ));
  const academyLabel = (academyId: string) => {
    const sibling = students.find(s => s.academyId === academyId);
    return sibling ? `${sibling.name} 학생과 같은 학원` : "등록된 학원";
  };

  const openAddChildModal = () => {
    setNewChildAcademyId(childAcademyIds[0] || "");
    setIsAddChildModalOpen(true);
  };

  const submitAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    const academyId = newChildAcademyId || childAcademyIds[0];
    if (!newChildName.trim() || !academyId || !user?.email) return;
    try {
      await addDoc(collection(db, "students"), {
        academyId,
        name: newChildName.trim(),
        parentEmail: user.email,
        status: "none",
        feeStatus: "unpaid",
        lastUpdated: new Date().toISOString()
      });
      setIsAddChildModalOpen(false);
      setNewChildName("");
    } catch (e) { console.error(e); }
  };

  if (loading || !user || role !== "parent") {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #800020, #5A0016)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <GraduationCap size={28} color="white" />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  // Parents created before this approval system existed have no `approved`
  // field at all — treat that as already approved so we don't lock out
  // existing users. Only an explicit `approved: false` blocks access.
  const isRejected = profile?.rejected === true;
  const isApproved = profile?.approved !== false;

  if (isRejected) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', maxWidth: 360, padding: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #800020, #5A0016)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <XCircle size={28} color="white" />
          </div>
          <p style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>가입이 거절되었습니다</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>학원 코드를 다시 확인하시거나 원장님께 문의해주세요.</p>
          <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => signOut(auth)}>
            <LogOut size={14} /> 로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', maxWidth: 360, padding: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #800020, #5A0016)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Clock size={28} color="white" />
          </div>
          <p style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>원장님 승인 대기 중입니다</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>승인이 완료되면 자동으로 이용할 수 있어요.</p>
          <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={() => signOut(auth)}>
            <LogOut size={14} /> 로그아웃
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "status", label: "실시간 출결", icon: <CircleDashed size={17} />, mobileIcon: <CircleDashed size={20} /> },
    { id: "homework", label: "숙제 알림", icon: <ClipboardList size={17} />, mobileIcon: <ClipboardList size={20} /> },
    { id: "announcements", label: "공지사항", icon: <Bell size={17} />, mobileIcon: <Bell size={20} />, badge: unreadAnnouncements },
    { id: "calendar", label: "출결 달력", icon: <CalendarPlus size={17} />, mobileIcon: <CalendarPlus size={20} /> },
  ];

  return (
    <div className="page-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <GraduationCap size={20} />
          </div>
          <div>
            <div className="sidebar-brand-text">Academy Care</div>
            <div className="sidebar-brand-sub">학부모 포털</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">메뉴</div>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => selectTab(item.id as typeof activeTab)}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          ))}
          <div className="sidebar-section-label" style={{ marginTop: 8 }}>빠른 액션</div>
          <button className="sidebar-item" onClick={() => setIsConsultModalOpen(true)}>
            <PhoneCall size={17} /> 상담 신청
          </button>
          <button className="sidebar-item" onClick={() => setIsFeeModalOpen(true)}>
            <CreditCard size={17} /> 원비 납부 확인
          </button>
          <button className="sidebar-item" onClick={() => router.push("/chat")}>
            <MessageCircle size={17} /> 학원과 채팅
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user.email?.[0]?.toUpperCase() ?? 'P'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.email}</div>
              <div className="sidebar-user-role">학부모</div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
            onClick={() => signOut(auth)}
          >
            <LogOut size={14} /> 로그아웃
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Mobile Top Bar (inside main-content) */}
        <div className="mobile-topbar">
          <div className="mobile-topbar-brand">
            <div className="mobile-topbar-logo">
              <GraduationCap size={16} />
            </div>
            <span className="mobile-topbar-name">Academy Care</span>
          </div>
          <div className="mobile-topbar-actions">
            <button className="mobile-topbar-btn" onClick={() => setIsFeeModalOpen(true)} title="원비 납부 확인">
              <CreditCard size={16} />
            </button>
            <button className="mobile-topbar-btn" onClick={() => setIsConsultModalOpen(true)} title="상담 신청">
              <PhoneCall size={16} />
            </button>
            <button className="mobile-topbar-btn" onClick={() => signOut(auth)} title="로그아웃">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Topbar (desktop only) */}
        <div className="topbar">
          <div>
            <div className="topbar-title">
              {navItems.find(n => n.id === activeTab)?.label ?? '대시보드'}
            </div>
            <div className="topbar-sub">자녀의 학원 생활을 한눈에 확인하세요</div>
          </div>
        </div>

        <div className="page-body">

          {/* Status Tab */}
          {activeTab === "status" && (
            <div className="animate-fade-up">
              {childAcademyIds.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                  <button className="btn btn-secondary btn-sm" onClick={openAddChildModal}>
                    <UserPlus size={14} /> 자녀 추가
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {students.map(student => (
                  <div key={student.id} className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{student.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                        최근 변동: {student.status !== "none" ? formatDate(student.lastUpdated) : "기록 없음"}
                      </div>
                    </div>
                    <div>
                      {student.status === "arrived" && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 999, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontWeight: 700, fontSize: 15, boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}>
                          <BookOpen size={18} /> 등원 중
                        </span>
                      )}
                      {student.status === "departed" && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 999, background: 'linear-gradient(135deg, #800020, #5A0016)', color: 'white', fontWeight: 700, fontSize: 15, boxShadow: '0 4px 14px rgba(128,0,32,0.3)' }}>
                          <CheckCircle size={18} /> 하원 완료
                        </span>
                      )}
                      {student.status === "none" && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 999, background: 'var(--bg)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 15, border: '1px solid var(--border)' }}>
                          <CircleDashed size={18} /> 대기중
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {students.length === 0 && (
                  <div className="card empty-state">
                    <div className="empty-state-icon">👦</div>
                    등록된 자녀가 없습니다.
                    {childAcademyIds.length > 0 ? (
                      <div style={{ marginTop: 10 }}>
                        <button className="btn btn-primary btn-sm" onClick={openAddChildModal}>
                          <UserPlus size={14} /> 자녀 추가하기
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                        원장님께 첫 자녀 등록을 요청해주세요.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Homework Tab */}
          {activeTab === "homework" && (
            <div className="animate-fade-up">
              {homeworks.length === 0 ? (
                <div className="card empty-state">
                  <div className="empty-state-icon">📚</div>
                  등록된 숙제가 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {homeworks.map(hw => {
                    const studentName = students.find(s => s.id === hw.studentId)?.name || "학생";
                    return (
                      <div key={hw.id} className="card" style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{studentName}</span>
                            <span className="badge badge-brand">{hw.textbook}</span>
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(hw.date)}</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{hw.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Announcements Tab */}
          {activeTab === "announcements" && (
            <div className="animate-fade-up">
              {announcements.length === 0 ? (
                <div className="card empty-state">
                  <div className="empty-state-icon">📢</div>
                  새로운 공지사항이 없습니다.
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {announcements.map((ann, idx) => (
                    <div key={ann.id} className="announcement-item" style={{ padding: '18px 24px', borderBottom: idx < announcements.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div className="announcement-title">{ann.title}</div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 12 }}>{formatDate(ann.date)}</span>
                      </div>
                      <div className="announcement-content">{ann.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === "calendar" && (
            <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {students.map(student => (
                <div key={student.id}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>{student.name} 출결 기록</div>
                  <AttendanceCalendar
                    studentId={student.id}
                    studentName={student.name}
                    onAddConsultation={(studentId, date) => {
                      setConsultStudentId(studentId);
                      const tzDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                      setConsultDate(tzDate.toISOString().split('T')[0]);
                      setIsConsultModalOpen(true);
                    }}
                  />
                </div>
              ))}
              {students.length === 0 && (
                <div className="card empty-state">등록된 자녀가 없습니다.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Consultation Modal */}
      {isConsultModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsConsultModalOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: 'var(--brand-light)' }}>
                <PhoneCall size={22} color="var(--brand)" />
              </div>
              <div className="modal-title">원장님 1:1 상담 신청</div>
            </div>
            <form onSubmit={submitConsultation} style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">상담 대상 자녀</label>
                <select className="input" value={consultStudentId} onChange={e => setConsultStudentId(e.target.value)} required>
                  <option value="">자녀를 선택하세요</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="input-group">
                  <label className="input-label">희망 날짜</label>
                  <input className="input" type="date" value={consultDate} onChange={e => setConsultDate(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label className="input-label">희망 시간</label>
                  <input className="input" type="time" value={consultTime} onChange={e => setConsultTime(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIsConsultModalOpen(false)}>취소</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>신청하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Child Modal */}
      {isAddChildModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddChildModalOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: 'var(--brand-light)' }}>
                <UserPlus size={22} color="var(--brand)" />
              </div>
              <div className="modal-title">자녀 추가 등록</div>
            </div>
            <form onSubmit={submitAddChild} style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">자녀 이름</label>
                <input
                  className="input"
                  value={newChildName}
                  onChange={e => setNewChildName(e.target.value)}
                  required
                  placeholder="자녀의 이름을 입력하세요"
                />
              </div>
              {childAcademyIds.length > 1 && (
                <div className="input-group">
                  <label className="input-label">등록할 학원</label>
                  <select className="input" value={newChildAcademyId} onChange={e => setNewChildAcademyId(e.target.value)} required>
                    {childAcademyIds.map(id => (
                      <option key={id} value={id}>{academyLabel(id)}</option>
                    ))}
                  </select>
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                추가 등록 후 원장님이 출결·과제 관리를 시작할 수 있습니다.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIsAddChildModalOpen(false)}>취소</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>추가하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fee Modal */}
      {isFeeModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsFeeModalOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: '#EFF6FF' }}>
                <CreditCard size={22} color="#1D4ED8" />
              </div>
              <div className="modal-title">수강료 납부 안내</div>
            </div>
            <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {students.map(student => (
                <div key={student.id} style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700 }}>{student.name} 학생</span>
                    {student.feeStatus === "paid"
                      ? <span className="badge badge-success"><CheckCircle size={11} /> 납부 완료</span>
                      : <span className="badge badge-error">미납</span>
                    }
                  </div>
                  {student.feeStatus !== "paid" && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      이번 달 수강료 결제가 필요합니다.<br />
                      계좌: 국민은행 1234-56-7890 (아카데미 학원)
                    </div>
                  )}
                </div>
              ))}
              {students.length === 0 && <div className="empty-state">등록된 자녀가 없습니다.</div>}
              <button className="btn btn-secondary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={() => setIsFeeModalOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Bottom Tab Bar */}
      <div className="bottom-tab-bar">
        <div className="bottom-tab-bar-inner">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`bottom-tab-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => selectTab(item.id as typeof activeTab)}
            >
              {item.badge ? (
                <span className="bottom-tab-badge">{item.badge > 9 ? '9+' : item.badge}</span>
              ) : null}
              <div className="bottom-tab-icon" style={{ color: activeTab === item.id ? 'var(--brand)' : 'var(--text-muted)' }}>
                {item.mobileIcon}
              </div>
              <span className="bottom-tab-label">{item.label}</span>
            </button>
          ))}
          <button className="bottom-tab-item" onClick={() => router.push("/chat")}>
            <div className="bottom-tab-icon" style={{ color: 'var(--text-muted)' }}>
              <MessageCircle size={20} />
            </div>
            <span className="bottom-tab-label">채팅</span>
          </button>
        </div>
      </div>
    </div>
  );
}
