import * as admin from 'firebase-admin';

// Initialize the Firebase Admin SDK lazily to prevent Next.js build errors
export function getAdminDb() {
    if (!admin.apps.length) {
        const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID;

        if (!clientEmail || !privateKey) {
            throw new Error(`FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY is missing in the Vercel environment! Please add them to your Vercel project settings.`);
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: projectId,
                clientEmail: clientEmail,
                // Handle the case where private keys have literal \n embedded in string
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
        });
    }
    return admin.firestore();
}


