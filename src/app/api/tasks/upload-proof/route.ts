export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to submit proof.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'submissions';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    // Validate size (max 12MB)
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 12MB limit.' }, { status: 400 });
    }

    // Validate mime type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    const isImage =
      validTypes.includes(file.type.toLowerCase()) ||
      Boolean(file.name.match(/\.(jpe?g|png|webp|gif)$/i));

    if (!isImage) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPG, WEBP, and GIF images are allowed.' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanUserId = user.id.replace(/[^a-zA-Z0-9]/g, '');
    const cleanFolder = folder === 'rejections' ? 'rejections' : 'submissions';
    const filePath = `${cleanFolder}/${cleanUserId}-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload using service role admin client to bypass storage RLS
    const { error: uploadError } = await adminSupabase.storage
      .from('temutask-proofs')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Admin storage upload error:', uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = adminSupabase.storage
      .from('temutask-proofs')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      proofUrl: urlData.publicUrl,
    });
  } catch (err: any) {
    console.error('Proof upload server error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error during proof upload.' },
      { status: 500 }
    );
  }
}
