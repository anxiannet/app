
import { type NextRequest, NextResponse } from 'next/server';
import { db, authAdmin } from '@/lib/firebase-admin'; // Assuming firebase-admin is set up

export async function POST(request: NextRequest) {
  try {
    // IMPORTANT: Robust production authentication/authorization is needed here.
    // This example assumes the client-side correctly restricts who can call this.
    // A proper implementation would verify the caller's ID token and check for admin custom claims.
    // For example:
    // const authorization = request.headers.get('Authorization');
    // if (authorization?.startsWith('Bearer ')) {
    //   const idToken = authorization.split('Bearer ')[1];
    //   try {
    //     const decodedToken = await authAdmin.verifyIdToken(idToken);
    //     if (!decodedToken.admin) { // Assuming an 'admin' custom claim
    //       return NextResponse.json({ message: 'Unauthorized: Caller is not an admin.' }, { status: 403 });
    //     }
    //   } catch (authError) {
    //     console.error('Error verifying auth token:', authError);
    //     return NextResponse.json({ message: 'Authentication failed.' }, { status: 401 });
    //   }
    // } else {
    //   return NextResponse.json({ message: 'Missing authorization token.' }, { status: 401 });
    // }

    const { targetUserId, makeAdmin } = await request.json();

    if (!targetUserId || typeof makeAdmin !== 'boolean') {
      return NextResponse.json({ message: 'Missing targetUserId or makeAdmin flag' }, { status: 400 });
    }

    const userDocRef = db.collection('users').doc(targetUserId);
    await userDocRef.update({
      isAdmin: makeAdmin,
    });

    return NextResponse.json({ message: `User ${targetUserId} admin status set to ${makeAdmin}` }, { status: 200 });
  } catch (error) {
    console.error('Error setting admin status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ message: 'Error setting admin status', error: errorMessage }, { status: 500 });
  }
}
