"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, onSnapshot, updateDoc, doc, where, setDoc, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import {
  Search, Users, CheckCircle, XCircle, LogOut, MessageCircle, BookOpen, Plus,
  Clock, UserCheck, CircleDashed, X, Trash2, Calendar as CalendarIcon, Megaphone,
  CalendarCheck, User, Book, FileText, Library, GraduationCap, Phone, Mail
} from "lucide-react";
import AttendanceCalendar from "@/components/AttendanceCalendar";

interface Student {
  id: string;
  name: string;
  parentEmail: string;
  status: "none" | "arrived" | "departed";
  feeStatus?: "paid" | "unpaid";
  lastUpdated: string;
}

interface Homework {
  id: string;
  textbook: string;
  description: string;
  date: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
}

interface Consultation {
  id: string;
  parentEmail: string;
  studentName: string;
  date: string;
  status: "pending" | "confirmed";
  createdAt: string;
}

interface ParentInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  students: string[]; // student names
}

export default function AcademyDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newParentEmail, setNewParentEmail] = useState("");
  const [textbooks, setTextbooks] = useState(["개념원리 수학", "쎈 수학", "능률 보카"]);
  const [newTextbook, setNewTextbook] = useState("");
  const [selectedTextbook, setSelectedTextbook] = useState("");
  const [deletingTextbook, setDeletingTextbook] = useState<string | null>(null);
  const [homeworkDesc, setHomeworkDesc] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [recentHomeworks, setRecentHomeworks] = useState<Homework[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementContent, setNewAnnouncementContent] = useState("");
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [parents, setParents] = useState<ParentInfo[]>([]);
  const [parentSearch, setParentSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"students" | "parents" | "homework" | "announcements" | "consultations">("students");

  useEffect(() => {
    if (!loading && (!user || role !== "academy")) router.push("/");
  }, [user, role, loading, router]);

  useEffect(() => {
    if (user && role === "academy") {
      const q = query(collection(db, "students"), where("academyId", "==", user.uid));
      const unsubStudents = onSnapshot(q, snap => {
        setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
      });
      const settingsRef = doc(db, "academySettings", user.uid);
      const unsubSettings = onSnapshot(settingsRef, snap => {
        if (snap.exists() && snap.data().textbooks) setTextbooks(snap.data().textbooks);
      });
      const aq = query(collection(db, "announcements"), where("academyId", "==", user.uid));
      const unsubAnn = onSnapshot(aq, snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
        setAnnouncements(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      });
      const cq = query(collection(db, "consultations"), where("academyId", "==", user.uid));
      const unsubCons = onSnapshot(cq, snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Consultation));
        setConsultations(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      });

      // Fetch parent info from users collection
      const fetchParents = async () => {
        const studSnap = await getDocs(query(collection(db, "students"), where("academyId", "==", user.uid)));
        const emailToStudents: Record<string, string[]> = {};
        studSnap.docs.forEach(d => {
          const email = d.data().parentEmail;
          const name = d.data().name;
          if (!emailToStudents[email]) emailToStudents[email] = [];
          emailToStudents[email].push(name);
        });
        const emails = Object.keys(emailToStudents);
        if (emails.length === 0) return;
        const uq = query(collection(db, "users"), where("role", "==", "parent"));
        const uSnap = await getDocs(uq);
        const parentList: ParentInfo[] = [];
        uSnap.docs.forEach(d => {
          const u = d.data();
          if (emailToStudents[u.email]) {
            parentList.push({
              id: d.id,
              name: u.name || u.email,
              email: u.email,
              phone: u.phone,
              students: emailToStudents[u.email] || [],
            });
          }
        });
        setParents(parentList);
      };
      fetchParents();

      return () => { unsubStudents(); unsubSettings(); unsubAnn(); unsubCons(); };
    }
  }, [user, role]);

  useEffect(() => {
    if (selectedStudent) {
      const q = query(collection(db, "homework"), where("studentId", "==", selectedStudent));
      const unsub = onSnapshot(q, snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Homework));
        setRecentHomeworks(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5));
      });
      return () => unsub();
    } else setRecentHomeworks([]);
  }, [selectedStudent]);

  const updateStatus = async (studentId: string, status: "arrived" | "departed" | "none") => {
    try {
      const now = new Date();
      const ts = now.toISOString();
      await updateDoc(doc(db, "students", studentId), { status, lastUpdated: ts });
      if (status !== "none") {
        const ds = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        await addDoc(collection(db, "attendance_logs"), { studentId, type: status, timestamp: ts, dateString: ds });
      }
    } catch (e) { console.error(e); }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newParentEmail || !user) return;
    try {
      await addDoc(collection(db, "students"), {
        academyId: user.uid, name: newStudentName,
        parentEmail: newParentEmail.trim().toLowerCase(),
        status: "none", feeStatus: "unpaid", lastUpdated: new Date().toISOString()
      });
      setNewStudentName(""); setNewParentEmail("");
    } catch (e) { console.error(e); }
  };

  const handleAssignHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedTextbook || !homeworkDesc) return;
    try {
      await addDoc(collection(db, "homework"), {
        studentId: selectedStudent, academyId: user?.uid,
        textbook: selectedTextbook, description: homeworkDesc, date: new Date().toISOString()
      });
      setHomeworkDesc("");
    } catch (e) { console.error(e); }
  };

  const handleAddTextbook = async () => {
    if (newTextbook && !textbooks.includes(newTextbook) && user) {
      const updated = [...textbooks, newTextbook];
      setTextbooks(updated); setNewTextbook("");
      try { await setDoc(doc(db, "academySettings", user.uid), { textbooks: updated }, { merge: true }); }
      catch (e) { console.error(e); }
    }
  };

  const handleRemoveTextbook = async (tb: string) => {
    if (!user) return;
    const updated = textbooks.filter(t => t !== tb);
    setTextbooks(updated); setDeletingTextbook(null);
    try { await setDoc(doc(db, "academySettings", user.uid), { textbooks: updated }, { merge: true }); }
    catch (e) { console.error(e); }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncementTitle || !newAnnouncementContent || !user) return;
    try {
      await addDoc(collection(db, "announcements"), {
        academyId: user.uid, title: newAnnouncementTitle,
        content: newAnnouncementContent, date: new Date().toISOString()
      });
      setNewAnnouncementTitle(""); setNewAnnouncementContent("");
    } catch (e) { console.error(e); }
  };

  const toggleFeeStatus = async (studentId: string, current: "paid" | "unpaid" | undefined) => {
    try {
      await updateDoc(doc(db, "students", studentId), { feeStatus: current === "paid" ? "unpaid" : "paid" });
    } catch (e) { console.error(e); }
  };

  const confirmConsultation = async (id: string) => {
    try { await updateDoc(doc(db, "consultations", id), { status: "confirmed" }); }
    catch (e) { console.error(e); }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  if (loading || !user || role !== "academy") {
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

  const filteredStudents = students.filter(s => s.name.includes(searchTerm));
  const totalStudents = students.length;
  const arrivedStudents = students.filter(s => s.status === "arrived").length;
  const departedStudents = students.filter(s => s.status === "departed").length;
  const absentStudents = students.filter(s => s.status === "none").length;
  const pendingConsults = consultations.filter(c => c.status === "pending").length;

  const navItems = [
    { id: "students", label: "원생 출결", icon: <Users size={17} />, mobileIcon: <Users size={20} /> },
    { id: "parents", label: "학부모 목록", icon: <User size={17} />, mobileIcon: <User size={20} /> },
    { id: "homework", label: "과제·교재", icon: <BookOpen size={17} />, mobileIcon: <BookOpen size={20} /> },
    { id: "announcements", label: "공지사항", icon: <Megaphone size={17} />, mobileIcon: <Megaphone size={20} /> },
    { id: "consultations", label: "상담 신청", icon: <CalendarCheck size={17} />, mobileIcon: <CalendarCheck size={20} />, badge: pendingConsults },
  ];

  const filteredParents = parents.filter(p =>
    p.name.toLowerCase().includes(parentSearch.toLowerCase()) ||
    p.email.toLowerCase().includes(parentSearch.toLowerCase()) ||
    (p.phone || "").includes(parentSearch)
  );

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
            <div className="sidebar-brand-sub">원장 관리자</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">메뉴</div>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id as typeof activeTab)}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#800020', color: 'white', borderRadius: 999, padding: '2px 7px' }}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
          <div className="sidebar-section-label" style={{ marginTop: 8 }}>도구</div>
          <button className="sidebar-item" onClick={() => router.push("/chat")}>
            <MessageCircle size={17} />
            AI 채팅
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.email}</div>
              <div className="sidebar-user-role">학원 관리자</div>
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
            <div className="topbar-sub">오늘 현황을 확인하세요</div>
          </div>
        </div>

        {/* Body */}
        <div className="page-body">

          {/* Stats Row */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label"><Users size={13} /> 전체 원생</div>
              <div className="stat-value">{totalStudents}<span className="stat-unit">명</span></div>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #059669' }}>
              <div className="stat-label" style={{ color: 'var(--success)' }}><UserCheck size={13} /> 등원 완료</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{arrivedStudents}<span className="stat-unit">명</span></div>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #800020' }}>
              <div className="stat-label" style={{ color: 'var(--brand)' }}><CheckCircle size={13} /> 하원 완료</div>
              <div className="stat-value" style={{ color: 'var(--brand)' }}>{departedStudents}<span className="stat-unit">명</span></div>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid var(--border-strong)' }}>
              <div className="stat-label"><CircleDashed size={13} /> 미등원</div>
              <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{absentStudents}<span className="stat-unit">명</span></div>
            </div>
          </div>

          {/* Students Tab */}
          {activeTab === "students" && (
            <div className="two-col-grid animate-fade-up">
              {/* Add student */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title"><Plus size={15} /> 원생 추가</div>
                    <div className="card-subtitle">새로운 원생을 등록하세요</div>
                  </div>
                </div>
                <div className="card-body">
                  <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="input-group">
                      <label className="input-label">이름</label>
                      <input className="input" type="text" placeholder="원생 이름" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} required />
                    </div>
                    <div className="input-group">
                      <label className="input-label">학부모 이메일</label>
                      <input className="input" type="email" placeholder="학부모 이메일" value={newParentEmail} onChange={e => setNewParentEmail(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }}>
                      <Plus size={16} /> 원생 추가
                    </button>
                  </form>
                </div>
              </div>

              {/* Student list */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title"><Users size={15} /> 원생 명부</div>
                    <div className="card-subtitle">출결 상태를 관리하세요</div>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ position: 'relative', marginBottom: 14 }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="input" style={{ paddingLeft: 36 }} placeholder="이름으로 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 420, overflowY: 'auto' }}>
                    {filteredStudents.map(student => (
                      <div key={student.id} className="student-row">
                        <div className="student-row-info">
                          <div className="student-row-name">
                            {student.name}
                            {student.status === "arrived" && <span className="status-chip-arrived">등원중</span>}
                            {student.status === "departed" && <span className="status-chip-departed">하원완료</span>}
                            {student.status === "none" && <span className="status-chip-none">대기중</span>}
                          </div>
                          <div className="student-row-meta">
                            <Clock size={11} />
                            {student.status !== "none" ? formatDate(student.lastUpdated) : "기록 없음"}
                            <span>·</span>
                            {student.parentEmail}
                            <span>·</span>
                            <button
                              className={student.feeStatus === "paid" ? "fee-paid" : "fee-unpaid"}
                              onClick={() => toggleFeeStatus(student.id, student.feeStatus)}
                            >
                              {student.feeStatus === "paid" ? "원비 납부됨" : "원비 미납"}
                            </button>
                          </div>
                        </div>
                        <div className="student-row-actions">
                          <button
                            className={`btn btn-sm ${student.status === "arrived" ? "btn-primary" : "btn-secondary"}`}
                            style={student.status === "arrived" ? { background: 'var(--success)', boxShadow: 'none' } : {}}
                            onClick={() => updateStatus(student.id, "arrived")}
                          >등원</button>
                          <button
                            className={`btn btn-sm ${student.status === "departed" ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => updateStatus(student.id, "departed")}
                          >하원</button>
                          {student.status !== "none" && (
                            <button className="btn btn-ghost btn-sm" title="초기화" onClick={() => updateStatus(student.id, "none")}>
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredStudents.length === 0 && (
                      <div className="empty-state">
                        <div className="empty-state-icon">👤</div>
                        표시할 학생이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Parents Tab */}
          {activeTab === "parents" && (
            <div className="card animate-fade-up" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-header">
                <div>
                  <div className="card-title"><User size={15} /> 학부모 목록</div>
                  <div className="card-subtitle">등록된 학부모 연락처 및 자녀 목록</div>
                </div>
              </div>
              <div className="card-body">
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input className="input" style={{ paddingLeft: 36 }} placeholder="이름, 이메일, 전화번호로 검색..." value={parentSearch} onChange={e => setParentSearch(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 500, overflowY: 'auto' }}>
                  {filteredParents.map(parent => (
                    <div key={parent.id} className="student-row">
                      <div className="student-row-info">
                        <div className="student-row-name" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span>{parent.name}</span>
                          {parent.phone ? (
                            <span style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Phone size={12} />
                              {parent.phone}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>전화번호 미등록</span>
                          )}
                        </div>
                        <div className="student-row-meta">
                          <Mail size={11} />
                          <span>{parent.email}</span>
                          <span>·</span>
                          <span>자녀: {parent.students.join(", ") || "없음"}</span>
                        </div>
                      </div>
                      <div className="student-row-actions">
                        {parent.phone && (
                          <a href={`tel:${parent.phone}`} className="btn btn-secondary btn-sm" style={{ gap: 4, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                            <Phone size={12} /> 전화 걸기
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredParents.length === 0 && (
                    <div className="empty-state">
                      <div className="empty-state-icon">👤</div>
                      표시할 학부모가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Homework Tab */}
          {activeTab === "homework" && (
            <div className="two-col-grid animate-fade-up">
              {/* Textbook Library */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title"><Library size={15} /> 교재 라이브러리</div>
                    <div className="card-subtitle">사용 중인 교재 목록</div>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ position: 'relative', marginBottom: 16 }}>
                    <input
                      className="input"
                      style={{ paddingRight: 48 }}
                      placeholder="새로운 교재 이름 입력..."
                      value={newTextbook}
                      onChange={e => setNewTextbook(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddTextbook()}
                    />
                    <button
                      type="button"
                      onClick={handleAddTextbook}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 8, background: '#800020', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {textbooks.map((tb, i) => (
                      <span key={i} className="textbook-chip">
                        <span>{tb}</span>
                        <button className="textbook-chip-del" onClick={() => setDeletingTextbook(tb)}>
                          <X size={11} strokeWidth={3} />
                        </button>
                      </span>
                    ))}
                    {textbooks.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>등록된 교재가 없습니다.</span>}
                  </div>
                </div>
              </div>

              {/* Homework Assignment */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title"><BookOpen size={15} /> 과제 부여하기</div>
                    <div className="card-subtitle">원생에게 숙제를 부여하세요</div>
                  </div>
                </div>
                <div className="card-body">
                  <form onSubmit={handleAssignHomework} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="input-group">
                      <label className="input-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />대상 원생</label>
                      <select
                        className="input"
                        value={selectedStudent}
                        onChange={e => setSelectedStudent(e.target.value)}
                        required
                      >
                        <option value="">학생을 선택하세요</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label"><Book size={12} style={{ display: 'inline', marginRight: 4 }} />교재 선택</label>
                      <select
                        className="input"
                        value={selectedTextbook}
                        onChange={e => setSelectedTextbook(e.target.value)}
                        required
                      >
                        <option value="">교재를 선택하세요</option>
                        {textbooks.map(tb => <option key={tb} value={tb}>{tb}</option>)}
                      </select>
                    </div>

                    {selectedStudent && recentHomeworks.length > 0 && (
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>최근 과제 기록</div>
                        <div className="hw-timeline">
                          {recentHomeworks.map(hw => (
                            <div key={hw.id} className="hw-timeline-item">
                              <div className="hw-timeline-dot" />
                              <div className="hw-timeline-card">
                                <div className="hw-timeline-book">{hw.textbook}</div>
                                <div className="hw-timeline-desc">{hw.description}</div>
                                <div className="hw-timeline-date">{formatDate(hw.date)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="input-group">
                      <label className="input-label"><FileText size={12} style={{ display: 'inline', marginRight: 4 }} />과제 상세 내용</label>
                      <textarea
                        className="input"
                        placeholder="예: 15~20페이지 문제 풀고 오답노트 작성"
                        value={homeworkDesc}
                        onChange={e => setHomeworkDesc(e.target.value)}
                        required
                        rows={3}
                        style={{ resize: 'none' }}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                      <CheckCircle size={15} /> 과제 부여하기
                    </button>
                  </form>
                </div>

                {selectedStudent && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarIcon size={14} /> 출결 달력
                    </div>
                    <AttendanceCalendar
                      studentId={selectedStudent}
                      studentName={students.find(s => s.id === selectedStudent)?.name || ""}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Announcements Tab */}
          {activeTab === "announcements" && (
            <div className="two-col-grid animate-fade-up">
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="card-header">
                  <div className="card-title"><Plus size={15} /> 공지사항 등록</div>
                </div>
                <div className="card-body">
                  <form onSubmit={handleAddAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="input-group">
                      <label className="input-label">제목</label>
                      <input className="input" placeholder="공지사항 제목" value={newAnnouncementTitle} onChange={e => setNewAnnouncementTitle(e.target.value)} required />
                    </div>
                    <div className="input-group">
                      <label className="input-label">내용</label>
                      <textarea className="input" placeholder="공지사항 내용" value={newAnnouncementContent} onChange={e => setNewAnnouncementContent(e.target.value)} required rows={5} style={{ resize: 'none' }} />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                      <Megaphone size={15} /> 공지사항 등록
                    </button>
                  </form>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="card-header">
                  <div className="card-title"><Megaphone size={15} /> 등록된 공지사항</div>
                </div>
                <div className="card-body" style={{ maxHeight: 500, overflowY: 'auto' }}>
                  {announcements.map(ann => (
                    <div key={ann.id} className="announcement-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div className="announcement-title">{ann.title}</div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 12 }}>{formatDate(ann.date)}</span>
                      </div>
                      <div className="announcement-content">{ann.content}</div>
                    </div>
                  ))}
                  {announcements.length === 0 && <div className="empty-state">등록된 공지사항이 없습니다.</div>}
                </div>
              </div>
            </div>
          )}

          {/* Consultations Tab */}
          {activeTab === "consultations" && (
            <div className="card animate-fade-up" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-header">
                <div className="card-title">
                  <CalendarCheck size={15} /> 접수된 상담 신청
                </div>
                {pendingConsults > 0 && (
                  <span className="badge badge-error">{pendingConsults}건 대기중</span>
                )}
              </div>
              <div className="card-body">
                {consultations.length === 0 ? (
                  <div className="empty-state">접수된 상담 신청이 없습니다.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {consultations.map(cons => (
                      <div key={cons.id} className="consult-item">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 600 }}>{cons.studentName} 학부모님</span>
                            {cons.status === "pending"
                              ? <span className="badge badge-error">대기중</span>
                              : <span className="badge badge-success">확인완료</span>
                            }
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{cons.parentEmail}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', marginTop: 4 }}>희망 일시: {cons.date}</div>
                        </div>
                        {cons.status === "pending" && (
                          <button className="btn btn-primary btn-sm" onClick={() => confirmConsultation(cons.id)}>
                            확인
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Textbook Modal */}
      {deletingTextbook && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-icon" style={{ background: 'var(--error-bg)' }}>
                <Trash2 size={22} color="var(--error)" />
              </div>
              <div className="modal-title">교재 삭제</div>
              <div className="modal-desc">
                정말로 <strong>'{deletingTextbook}'</strong> 교재를 삭제하시겠습니까?<br />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>삭제 후에는 되돌릴 수 없습니다.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeletingTextbook(null)}>취소</button>
              <button className="btn btn-danger" onClick={() => handleRemoveTextbook(deletingTextbook)}>삭제하기</button>
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
              onClick={() => setActiveTab(item.id as typeof activeTab)}
            >
              {item.badge ? (
                <span className="bottom-tab-badge">{item.badge}</span>
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
            <span className="bottom-tab-label">AI 채팅</span>
          </button>
        </div>
      </div>
    </div>
  );
}
