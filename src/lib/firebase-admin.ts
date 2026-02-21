import * as admin from 'firebase-admin';

// Initialize the Firebase Admin SDK lazily to prevent Next.js build errors
export function getAdminDb() {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle the case where private keys have literal \n embedded in string
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    }
    return admin.firestore();
}
