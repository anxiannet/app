
import { NextResponse, type NextRequest } from 'next/server';
import { db, admin } from '@/lib/firebase-admin'; // Adjust path as necessary

// Define a type for our item for better type safety
type Item = {
  id?: string; // Firestore ID will be auto-generated
  name: string;
  description: string;
  createdAt: FirebaseFirestore.Timestamp;
};

/**
 * GET /api/items
 * Retrieves all items from the Firestore "items" collection.
 */
export async function GET() {
  try {
    const itemsCollection = db.collection('items');
    const snapshot = await itemsCollection.orderBy('createdAt', 'desc').get();

    if (snapshot.empty) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const items: Item[] = [];
    snapshot.forEach(doc => {
      items.push({ id: doc.id, ...doc.data() } as Item);
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ message: 'Error fetching items', error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/items
 * Creates a new item in the Firestore "items" collection.
 * Expected request body: { name: string, description: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || !description) {
      return NextResponse.json({ message: 'Missing name or description' }, { status: 400 });
    }

    const newItem: Omit<Item, 'id'> = {
      name,
      description,
      createdAt: admin.firestore.Timestamp.now(), // Use admin.firestore for Timestamp
    };

    const itemsCollection = db.collection('items');
    const docRef = await itemsCollection.add(newItem);

    return NextResponse.json({ message: 'Item created successfully', id: docRef.id, item: { id: docRef.id, ...newItem } }, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ message: 'Error creating item', error: (error as Error).message }, { status: 500 });
  }
}
