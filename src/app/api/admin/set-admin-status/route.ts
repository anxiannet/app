
import { type NextRequest, NextResponse } from 'next/server';

// This API route is intentionally non-functional as the
// Firebase Admin SDK and related admin management features have been removed.

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { message: 'Admin status management functionality has been removed.' },
    { status: 404 }
  );
}
