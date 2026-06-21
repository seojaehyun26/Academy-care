"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export type Role = "academy" | "parent" | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;
    let resolved = false;
    const markResolved = () => { resolved = true; };

    // Safety net: if auth/Firestore never calls back (e.g. a network or
    // proxy silently drops the realtime listener), don't leave the user
    // stuck on the loading screen forever.
    const safetyTimer = setTimeout(() => {
      if (!resolved) {
        markResolved();
        console.warn("Auth/role lookup timed out; unblocking loading screen.");
        setLoading(false);
      }
    }, 8000);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Listen to the user's document in real-time
        unsubscribeDoc = onSnapshot(doc(db, "users", firebaseUser.uid), (docSnap) => {
          markResolved();
          if (docSnap.exists()) {
            setRole(docSnap.data().role as Role);
          } else {
            // Document might not be created yet during sign up, so we wait
            setRole(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user role:", error);
          markResolved();
          setRole(null);
          setLoading(false);
        });

      } else {
        markResolved();
        setUser(null);
        setRole(null);
        setLoading(false);
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
      }
    }, (error) => {
      console.error("Auth state error:", error);
      markResolved();
      setUser(null);
      setRole(null);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
