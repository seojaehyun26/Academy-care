"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export type Role = "academy" | "parent" | null;

export interface UserProfile {
  email?: string;
  name?: string;
  phone?: string;
  role?: Role;
  academyId?: string;
  academyName?: string;
  approved?: boolean;
  rejected?: boolean;
  joinCode?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  role: Role;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  profile: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // A new auth transition is starting (e.g. sign-up/sign-in happening
      // without a full page reload) — drop any listener from the previous
      // transition so it can't race with this one.
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        // `loading` may already be false from an earlier resolution within
        // this same page load (e.g. the near-instant "not logged in" check
        // on initial mount, before the user submits sign-up/sign-in). Without
        // this, the role lookup below would happen silently — the page
        // would render its signed-out form for a few seconds with no
        // indication anything is happening, which looks like the screen
        // simply isn't responding to the submit.
        setLoading(true);

        // Safety net per transition: if Firestore never calls back (e.g. a
        // network or proxy silently drops the realtime listener), don't
        // leave the user stuck on the current screen forever. This must be
        // re-armed for every transition, not just the first — sign-up and
        // sign-in both trigger a fresh transition within the same page
        // load, well after the initial (near-instant, "logged out") one
        // that a mount-only timer would have already consumed.
        let resolved = false;
        const safetyTimer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.warn("Role lookup timed out; unblocking loading screen.");
            setLoading(false);
          }
        }, 8000);

        // Listen to the user's document in real-time
        unsubscribeDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
          resolved = true;
          clearTimeout(safetyTimer);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setRole((data.role as Role) ?? null);
            setProfile(data);
          } else {
            // Document might not be created yet during sign up, so we wait
            setRole(null);
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching role:", error);
          resolved = true;
          clearTimeout(safetyTimer);
          setRole(null);
          setProfile(null);
          setLoading(false);
        });

      } else {
        setUser(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
      }
    }, (error) => {
      console.error("Auth state error:", error);
      setUser(null);
      setRole(null);
      setProfile(null);
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
