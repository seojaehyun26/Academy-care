"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { GraduationCap, Mail, Lock, User, ShieldCheck, BookOpen, Users, Bell, Phone } from "lucide-react";

export default function Home() {
  const { user, role, loading } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState<"academy" | "parent">("parent");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!loading && user) {
      if (role === "academy") window.location.href = "/academy";
      else if (role === "parent") window.location.href = "/parent";
    }
  }, [user, role, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          email, name, role: selectedRole,
          ...(selectedRole === "parent" && phone ? { phone } : {}),
          createdAt: new Date().toISOString()
        });
      }
    } catch {
      setErrorMsg("이메일 또는 비밀번호를 다시 확인해주세요.");
    }
  };

  if (loading || (user && role)) {
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

  return (
    <div className="login-page">
      {/* Left: Brand Panel */}
      <div className="login-brand-panel">
        <div className="login-brand-logo">
          <GraduationCap size={28} />
        </div>
        <div className="login-brand-eyebrow">Academy Care</div>
        <h1 className="login-brand-heading">
          스마트한 학원 관리의<br />새로운 기준
        </h1>
        <p className="login-brand-desc">
          출결 관리부터 과제 부여, 학부모 소통까지 —<br />
          하나의 플랫폼으로 모든 것을 해결하세요.
        </p>

        <div className="login-brand-features">
          <div className="login-brand-feature">
            <div className="login-brand-feature-icon"><Users size={15} /></div>
            실시간 출결 관리 및 현황 파악
          </div>
          <div className="login-brand-feature">
            <div className="login-brand-feature-icon"><BookOpen size={15} /></div>
            교재별 과제 부여 및 이력 관리
          </div>
          <div className="login-brand-feature">
            <div className="login-brand-feature-icon"><Bell size={15} /></div>
            학부모 실시간 알림 및 상담 신청
          </div>
        </div>
      </div>

      {/* Right: Form Panel */}
      <div className="login-form-panel">
        <div className="login-form-box">
          {/* Mobile logo */}
          <div className="login-form-logo-mobile">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #800020, #5A0016)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={20} color="white" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Academy Care</span>
          </div>

          <h2 className="login-form-heading">
            {isLogin ? "다시 오셨군요 👋" : "계정을 만들어보세요"}
          </h2>
          <p className="login-form-sub">
            {isLogin ? "이메일과 비밀번호로 로그인하세요." : "Academy Care를 시작하세요."}
          </p>

          {errorMsg && <div className="login-error">{errorMsg}</div>}

          <form onSubmit={handleSubmit}>
            <div className="login-form-group">
              {!isLogin && (
                <>
                  <div className="login-field">
                    <div className="login-field-icon"><User size={16} /></div>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      placeholder="이름 (실명)"
                      className="login-input"
                    />
                  </div>
                  <div className="login-field">
                    <div className="login-field-icon"><ShieldCheck size={16} /></div>
                    <select
                      value={selectedRole}
                      onChange={e => setSelectedRole(e.target.value as "academy" | "parent")}
                      className="login-input"
                      style={{ appearance: 'none' }}
                    >
                      <option value="parent">학부모 계정</option>
                      <option value="academy">학원 관리자 계정</option>
                    </select>
                  </div>
                  {selectedRole === "parent" && (
                    <div className="login-field">
                      <div className="login-field-icon"><Phone size={16} /></div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="전화번호 (예: 010-1234-5678)"
                        className="login-input"
                      />
                    </div>
                  )}
                </>
              )}
              <div className="login-field">
                <div className="login-field-icon"><Mail size={16} /></div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="이메일 주소"
                  className="login-input"
                />
              </div>
              <div className="login-field">
                <div className="login-field-icon"><Lock size={16} /></div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="비밀번호"
                  className="login-input"
                />
              </div>
            </div>

            <button type="submit" className="login-btn">
              {isLogin ? "로그인" : "가입하기"}
            </button>
          </form>

          <div className="login-divider">
            <div className="login-divider-line" />
            <span className="login-divider-text">또는</span>
            <div className="login-divider-line" />
          </div>

          <div className="login-switch">
            {isLogin ? "처음 방문하셨나요?" : "이미 계정이 있으신가요?"}
            <button className="login-switch-btn" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? " 계정 만들기" : " 로그인"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
