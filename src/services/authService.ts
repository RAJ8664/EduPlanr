/**
 * Authentication Service
 * Handles all Firebase authentication operations including
 * Google sign-in, email/password, and anonymous authentication
 */

import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updateProfile,
  linkWithCredential,
  EmailAuthProvider,
  UserCredential,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile, UserPreferences } from "@/types";

// Default preferences for new users
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  defaultStudyDuration: 45,
  breakDuration: 10,
  dailyGoalHours: 4,
  notifications: true,
  soundEnabled: true,
};

/**
 * Creates or updates user profile in Firestore after authentication
 */
async function createUserProfile(user: User): Promise<UserProfile> {
  if (!db) {
    throw new Error("Firebase not initialized");
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Create new user profile
    const newProfile: Omit<UserProfile, "createdAt" | "updatedAt"> = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      preferences: DEFAULT_PREFERENCES,
    };

    await setDoc(userRef, {
      ...newProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      ...newProfile,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Return existing profile
  const data = userSnap.data();
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as UserProfile;
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<UserProfile> {
  if (!auth) throw new Error("Firebase not initialized");

  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");

  const result = await signInWithPopup(auth, provider);
  return createUserProfile(result.user);
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserProfile> {
  if (!auth) throw new Error("Firebase not initialized");

  const result = await signInWithEmailAndPassword(auth, email, password);
  return createUserProfile(result.user);
}

/**
 * Create new account with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<UserProfile> {
  if (!auth) throw new Error("Firebase not initialized");

  const result = await createUserWithEmailAndPassword(auth, email, password);

  // Update display name if provided
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }

  return createUserProfile(result.user);
}

/**
 * Sign in anonymously for quick access without account
 */
export async function signInAnonymouslyUser(): Promise<UserProfile> {
  if (!auth) throw new Error("Firebase not initialized");

  const result = await signInAnonymously(auth);
  return createUserProfile(result.user);
}

/**
 * Convert anonymous account to permanent account
 */
export async function convertAnonymousAccount(
  email: string,
  password: string,
): Promise<UserCredential> {
  if (!auth) throw new Error("Firebase not initialized");

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.isAnonymous) {
    throw new Error("No anonymous user to convert");
  }

  const credential = EmailAuthProvider.credential(email, password);
  return linkWithCredential(currentUser, credential);
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  if (!auth) throw new Error("Firebase not initialized");

  await sendPasswordResetEmail(auth, email);
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  if (!auth) throw new Error("Firebase not initialized");

  await firebaseSignOut(auth);
}

/**
 * Subscribe to authentication state changes
 */
export function subscribeToAuthChanges(
  callback: (user: User | null) => void,
): () => void {
  if (!auth) {
    // Return no-op function if Firebase not initialized
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): User | null {
  if (!auth) return null;
  return auth.currentUser;
}

/**
 * Check if current user is anonymous
 */
export function isAnonymousUser(): boolean {
  if (!auth) return false;
  return auth.currentUser?.isAnonymous ?? false;
}

/**
 * Update user display name
 */
export async function updateUserDisplayName(
  displayName: string,
): Promise<void> {
  if (!auth) throw new Error("Firebase not initialized");

  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  if (!db) throw new Error("Firebase not initialized");

  await updateProfile(user, { displayName });

  // Update Firestore profile
  const userRef = doc(db, "users", user.uid);
  await setDoc(
    userRef,
    { displayName, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) throw new Error("Firebase not initialized");

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return null;

  const data = userSnap.data();
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as UserProfile;
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  uid: string,
  preferences: Partial<UserPreferences>,
): Promise<void> {
  if (!db) throw new Error("Firebase not initialized");

  const userRef = doc(db, "users", uid);
  await setDoc(
    userRef,
    {
      preferences,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/* Compress image and convert to Base64 */
export function compressImage(
  file: File,
  maxWidth = 500,
  quality = 0.7,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth * height) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

/* Update profile picture in Firestore (Base64) */
export async function updateProfilePicture(
  base64Image: string,
  uid: string,
): Promise<void> {
  if (!db) throw new Error("Firebase not initialized");

  const userRef = doc(db, "users", uid);
  await setDoc(
    userRef,
    { photoURL: base64Image, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
