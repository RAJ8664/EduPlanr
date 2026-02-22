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

// Initialize a secondary Firebase Admin SDK instance for writing to Nexora
export function getNexoraAdminDb() {
    const NEXORA_APP_NAME = 'nexora-bridge';

    // Check if the app is already initialized
    const existingApp = admin.apps.find(app => app?.name === NEXORA_APP_NAME);
    if (existingApp) {
        return admin.firestore(existingApp);
    }

    const clientEmail = process.env.NEXORA_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.NEXORA_ADMIN_PRIVATE_KEY;
    const projectId = process.env.NEXORA_ADMIN_PROJECT_ID;

    // Fail gracefully in environments without credentials (like local dev without env)
    if (!clientEmail || !privateKey || !projectId) {
        console.warn(`NEXORA_ADMIN_CLIENT_EMAIL, NEXORA_ADMIN_PRIVATE_KEY, or NEXORA_ADMIN_PROJECT_ID is missing! Cross-project write will fail.`);
        throw new Error('Nexora Admin SDK is not properly configured.');
    }

    const app = admin.initializeApp({
        credential: admin.credential.cert({
            projectId: projectId,
            clientEmail: clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
    }, NEXORA_APP_NAME);

    return admin.firestore(app);
}
