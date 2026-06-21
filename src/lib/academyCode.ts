import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

// Avoid visually ambiguous characters (0/O, 1/I) since this is read aloud
// and typed by hand.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function generateUniqueAcademyCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const snap = await getDoc(doc(db, "academyCodes", code));
    if (!snap.exists()) return code;
  }
  throw new Error("학원 코드를 생성하지 못했습니다. 다시 시도해주세요.");
}
